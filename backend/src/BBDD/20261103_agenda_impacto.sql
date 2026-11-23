-- Aplicar antes de desplegar la API. No modifica tablas ni datos existentes.
BEGIN;

-- Un único predicado para previsualización y protección al guardar.
CREATE OR REPLACE FUNCTION public.agenda_turnos_afectados(p_tipo text, p_datos jsonb)
RETURNS SETOF public.turnos LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE h public.horarios_atencion; b public.bloqueos_agenda;
BEGIN
  IF p_tipo = 'horario' THEN
    h := jsonb_populate_record(NULL::public.horarios_atencion, p_datos);
    RETURN QUERY
    WITH evaluacion AS (
      SELECT t.id_turno, t.fecha_hora_inicio, t.fecha_hora_fin, (
      NOT h.activo OR t.id_profesional <> h.id_profesional
      OR t.id_especialidad <> h.id_especialidad OR t.id_salita <> h.id_salita
      OR extract(isodow FROM t.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires') <> h.dia_semana
      OR (t.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date < h.vigencia_desde
      OR (t.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date > h.vigencia_hasta
      OR (t.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::time < h.hora_inicio
      OR (t.fecha_hora_fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::time > h.hora_fin
      OR (t.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date <>
         (t.fecha_hora_fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
      OR extract(epoch FROM t.fecha_hora_fin - t.fecha_hora_inicio) <> h.duracion_turno_minutos * 60
      OR mod(extract(epoch FROM ((t.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::time - h.hora_inicio)),
        nullif(h.duracion_turno_minutos * 60, 0)) <> 0
      ) AS incompatible
      FROM public.turnos t WHERE t.id_horario = h.id_horario AND t.ocupa_agenda
    ), ocupacion AS (
      SELECT e.*, sum(CASE WHEN e.fecha_hora_fin > now() AND e.incompatible THEN 0 ELSE 1 END) OVER (
        PARTITION BY (e.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
        ORDER BY e.fecha_hora_inicio, e.id_turno) AS posicion
      FROM evaluacion e
    )
    SELECT t.* FROM public.turnos t JOIN ocupacion o USING (id_turno)
    WHERE t.fecha_hora_fin > now() AND (o.incompatible OR o.posicion > h.cupo_maximo_diario);
  ELSIF p_tipo = 'bloqueo' THEN
    b := jsonb_populate_record(NULL::public.bloqueos_agenda, p_datos);
    RETURN QUERY SELECT t.* FROM public.turnos t
    WHERE b.activo AND t.ocupa_agenda AND t.fecha_hora_fin > now()
      AND t.id_salita = b.id_salita
      AND (b.id_profesional IS NULL OR t.id_profesional = b.id_profesional)
      AND (b.id_especialidad IS NULL OR t.id_especialidad = b.id_especialidad)
      AND (t.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = b.fecha
      AND (b.dia_completo OR (
        (t.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::time < b.hora_fin AND
        (t.fecha_hora_fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::time > b.hora_inicio));
  ELSE RAISE EXCEPTION 'Tipo de agenda inválido';
  END IF;
END;
$$;

-- Serializa las escrituras de agenda ANTES de tomar locks de filas. Incluye
-- reservas normales, cambios de estado, horarios y bloqueos, también vía SQL.
-- Es deliberadamente global: transacciones breves; no abarca HTTP ni correos.
CREATE OR REPLACE FUNCTION public.serializar_agenda()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(20261103, 1);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS tr_agenda_serializar ON public.turnos;
CREATE TRIGGER tr_agenda_serializar BEFORE INSERT OR UPDATE OR DELETE ON public.turnos
FOR EACH STATEMENT EXECUTE FUNCTION public.serializar_agenda();
DROP TRIGGER IF EXISTS tr_agenda_serializar ON public.horarios_atencion;
CREATE TRIGGER tr_agenda_serializar BEFORE INSERT OR UPDATE OR DELETE ON public.horarios_atencion
FOR EACH STATEMENT EXECUTE FUNCTION public.serializar_agenda();
DROP TRIGGER IF EXISTS tr_agenda_serializar ON public.bloqueos_agenda;
CREATE TRIGGER tr_agenda_serializar BEFORE INSERT OR UPDATE OR DELETE ON public.bloqueos_agenda
FOR EACH STATEMENT EXECUTE FUNCTION public.serializar_agenda();

CREATE OR REPLACE FUNCTION public.proteger_horario_turnos()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE propuesta jsonb;
BEGIN
  propuesta := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) || '{"activo":false}'::jsonb ELSE to_jsonb(NEW) END;
  IF EXISTS (SELECT 1 FROM public.agenda_turnos_afectados('horario', propuesta)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_CONFLICT';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tr_horarios_proteger_turnos ON public.horarios_atencion;
CREATE TRIGGER tr_horarios_proteger_turnos BEFORE UPDATE OR DELETE ON public.horarios_atencion
FOR EACH ROW EXECUTE FUNCTION public.proteger_horario_turnos();

CREATE OR REPLACE FUNCTION public.validar_bloqueo_agenda()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.agenda_turnos_afectados('bloqueo', to_jsonb(NEW))) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_CONFLICT';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.agenda_turnos_afectados(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_turnos_afectados(text,jsonb) TO service_role;
COMMIT;
