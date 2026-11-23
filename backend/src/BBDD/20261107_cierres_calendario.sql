-- Ejecutar manualmente DESPUÉS de 20261103_agenda_impacto.sql y
-- 20261103_agenda_escritura.sql, antes de desplegar la API nueva.
BEGIN;
CREATE TABLE public.cierres_calendario (
  id_cierre uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo varchar(150) NOT NULL CHECK (length(trim(titulo)) >= 3),
  observaciones text CHECK (length(observaciones) <= 2000),
  tipo text NOT NULL CHECK (tipo IN ('FERIADO_NACIONAL','FERIADO_PROVINCIAL','FERIADO_MUNICIPAL',
    'DIA_NO_LABORABLE','ASUETO','DUELO','FUMIGACION','MANTENIMIENTO','EMERGENCIA','CIERRE_ADMINISTRATIVO','OTRO')),
  alcance text NOT NULL CHECK (alcance IN ('GLOBAL','SALITA')),
  id_salita uuid REFERENCES public.salitas(id_salita),
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL CHECK (fecha_fin >= fecha_inicio),
  dia_completo boolean NOT NULL,
  hora_inicio time,
  hora_fin time,
  origen varchar(200) NOT NULL DEFAULT 'Carga administrativa' CHECK (length(trim(origen)) >= 3),
  activo boolean NOT NULL DEFAULT true,
  creado_por uuid NOT NULL REFERENCES public.usuarios(id_usuario),
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_actualizacion timestamptz NOT NULL DEFAULT now(),
  CHECK ((alcance = 'GLOBAL' AND id_salita IS NULL) OR (alcance = 'SALITA' AND id_salita IS NOT NULL)),
  CHECK ((dia_completo AND hora_inicio IS NULL AND hora_fin IS NULL) OR
    (NOT dia_completo AND hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_inicio < hora_fin))
);
COMMENT ON TABLE public.cierres_calendario IS 'Cierres institucionales en fechas civiles argentinas; sin recurrencia anual. Observaciones y título administrativos.';
COMMENT ON COLUMN public.cierres_calendario.hora_inicio IS 'En cierres parciales, la misma franja se aplica cada día del rango inclusivo.';
CREATE INDEX idx_cierres_global_fechas ON public.cierres_calendario(fecha_inicio,fecha_fin) WHERE activo AND alcance = 'GLOBAL';
CREATE INDEX idx_cierres_salita_fechas ON public.cierres_calendario(id_salita,fecha_inicio,fecha_fin) WHERE activo AND alcance = 'SALITA';
CREATE INDEX idx_cierres_fechas ON public.cierres_calendario(fecha_inicio,id_cierre);
ALTER TABLE public.cierres_calendario ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cierres_calendario FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cierres_calendario TO service_role;

-- Un solo predicado SQL para impacto y validación al reservar. Los intervalos
-- son [inicio, fin); también cubre turnos manuales que crucen medianoche.
CREATE FUNCTION public.cierre_intersecta(c public.cierres_calendario, salita uuid, inicio timestamptz, fin timestamptz)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT c.activo AND (c.alcance = 'GLOBAL' OR c.id_salita = salita) AND EXISTS (
    SELECT 1 FROM generate_series(
      greatest(c.fecha_inicio, (inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)::timestamp,
      least(c.fecha_fin, (fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)::timestamp,
      interval '1 day') d
    WHERE inicio < ((d::date + CASE WHEN c.dia_completo THEN time '00:00' ELSE c.hora_fin END
      + CASE WHEN c.dia_completo THEN interval '1 day' ELSE interval '0 day' END) AT TIME ZONE 'America/Argentina/Buenos_Aires')
      AND fin > ((d::date + CASE WHEN c.dia_completo THEN time '00:00' ELSE c.hora_inicio END) AT TIME ZONE 'America/Argentina/Buenos_Aires')
  );
$$;
CREATE FUNCTION public.cierre_turnos_afectados(p_datos jsonb)
RETURNS SETOF public.turnos LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT t.* FROM public.turnos t
  CROSS JOIN jsonb_populate_record(NULL::public.cierres_calendario,p_datos) c
  WHERE t.ocupa_agenda AND t.fecha_hora_fin > now()
    AND t.fecha_hora_inicio < ((c.fecha_fin + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
    AND t.fecha_hora_fin > (c.fecha_inicio::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
    AND public.cierre_intersecta(c,t.id_salita,t.fecha_hora_inicio,t.fecha_hora_fin);
$$;

CREATE TRIGGER tr_agenda_serializar BEFORE INSERT OR UPDATE OR DELETE ON public.cierres_calendario
FOR EACH STATEMENT EXECUTE FUNCTION public.serializar_agenda();
CREATE FUNCTION public.validar_cierre_calendario()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.cierre_turnos_afectados(to_jsonb(NEW))) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AGENDA_CONFLICT';
  END IF;
  NEW.fecha_actualizacion := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER tr_cierres_validar BEFORE INSERT OR UPDATE ON public.cierres_calendario
FOR EACH ROW EXECUTE FUNCTION public.validar_cierre_calendario();
CREATE TRIGGER tr_auditar_cierres AFTER INSERT OR UPDATE OR DELETE ON public.cierres_calendario
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_cierre');

CREATE FUNCTION public.validar_turno_cierre()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  -- Se ejecuta después de tr_turnos_sincronizar_estado y tr_turnos_validar.
  IF NEW.ocupa_agenda AND EXISTS (
    SELECT 1 FROM public.cierres_calendario c WHERE c.activo
      AND (c.alcance = 'GLOBAL' OR c.id_salita = NEW.id_salita)
      AND c.fecha_inicio <= (NEW.fecha_hora_fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
      AND c.fecha_fin >= (NEW.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
      AND public.cierre_intersecta(c,NEW.id_salita,NEW.fecha_hora_inicio,NEW.fecha_hora_fin)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INSTITUTIONAL_CLOSURE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tr_turnos_validar_cierre BEFORE INSERT OR UPDATE OF
  id_horario,id_profesional,id_especialidad,id_salita,fecha_hora_inicio,fecha_hora_fin,id_estado,ocupa_agenda
ON public.turnos FOR EACH ROW EXECUTE FUNCTION public.validar_turno_cierre();

-- Persistencia exclusiva del backend. Revalida origen y destino bajo el mismo
-- lock que reservas y reprogramaciones; no acepta actor ni metadatos del JSON.
CREATE FUNCTION public.guardar_cierre_calendario(p_id uuid, p_datos jsonb, p_usuario uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE actual public.cierres_calendario; nuevo public.cierres_calendario;
  rol text; sala uuid; resultado jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(20261103,1);
  IF p_datos IS NULL OR jsonb_typeof(p_datos) <> 'object' OR p_datos = '{}'::jsonb THEN
    RAISE EXCEPTION 'Datos de cierre requeridos';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_datos) k WHERE k NOT IN
    ('titulo','observaciones','tipo','alcance','id_salita','fecha_inicio','fecha_fin','dia_completo','hora_inicio','hora_fin','origen','activo')) THEN
    RAISE EXCEPTION 'Campos de cierre inválidos';
  END IF;
  SELECT r.codigo INTO rol FROM public.usuarios u JOIN public.roles r USING(id_rol)
    WHERE u.id_usuario = p_usuario AND u.activo AND r.activo;
  IF rol IS NULL OR rol NOT IN ('SUPER_ADMIN','ADMIN_SALITA') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No puede administrar cierres';
  END IF;
  IF p_id IS NOT NULL THEN
    SELECT * INTO actual FROM public.cierres_calendario WHERE id_cierre = p_id FOR UPDATE;
    IF NOT FOUND THEN RETURN NULL; END IF;
  END IF;
  nuevo := jsonb_populate_record(actual,p_datos);
  IF rol <> 'SUPER_ADMIN' THEN
    IF nuevo.alcance IS DISTINCT FROM 'SALITA' OR (p_id IS NOT NULL AND actual.alcance <> 'SALITA') THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo SUPER_ADMIN gestiona cierres globales';
    END IF;
    FOR sala IN SELECT DISTINCT s FROM unnest(ARRAY[actual.id_salita,nuevo.id_salita]) s WHERE s IS NOT NULL LOOP
      IF NOT EXISTS (SELECT 1 FROM public.usuario_salita us WHERE us.id_usuario = p_usuario
        AND us.id_salita = sala AND us.activo
        AND us.fecha_desde <= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
        AND (us.fecha_hasta IS NULL OR us.fecha_hasta >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Salita fuera de alcance';
      END IF;
    END LOOP;
  END IF;
  IF nuevo.id_salita IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.salitas WHERE id_salita = nuevo.id_salita AND activo) AND nuevo.activo THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'La salita no está activa';
  END IF;
  PERFORM set_config('app.current_user_id',p_usuario::text,true);
  PERFORM set_config('app.current_salita_id',coalesce(nuevo.id_salita::text,''),true);
  IF p_id IS NULL THEN
    INSERT INTO public.cierres_calendario(titulo,observaciones,tipo,alcance,id_salita,fecha_inicio,fecha_fin,
      dia_completo,hora_inicio,hora_fin,origen,activo,creado_por)
    VALUES(nuevo.titulo,nuevo.observaciones,nuevo.tipo,nuevo.alcance,nuevo.id_salita,nuevo.fecha_inicio,nuevo.fecha_fin,
      nuevo.dia_completo,nuevo.hora_inicio,nuevo.hora_fin,coalesce(nuevo.origen,'Carga administrativa'),coalesce(nuevo.activo,true),p_usuario)
    RETURNING to_jsonb(cierres_calendario.*) INTO resultado;
  ELSE
    UPDATE public.cierres_calendario SET titulo=nuevo.titulo,observaciones=nuevo.observaciones,tipo=nuevo.tipo,
      alcance=nuevo.alcance,id_salita=nuevo.id_salita,fecha_inicio=nuevo.fecha_inicio,fecha_fin=nuevo.fecha_fin,
      dia_completo=nuevo.dia_completo,hora_inicio=nuevo.hora_inicio,hora_fin=nuevo.hora_fin,origen=nuevo.origen,activo=nuevo.activo
    WHERE id_cierre=p_id RETURNING to_jsonb(cierres_calendario.*) INTO resultado;
  END IF;
  RETURN resultado;
END;
$$;
REVOKE ALL ON FUNCTION public.cierre_intersecta(public.cierres_calendario,uuid,timestamptz,timestamptz),
  public.cierre_turnos_afectados(jsonb),public.guardar_cierre_calendario(uuid,jsonb,uuid),
  public.validar_cierre_calendario(),public.validar_turno_cierre() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cierre_intersecta(public.cierres_calendario,uuid,timestamptz,timestamptz),
  public.cierre_turnos_afectados(jsonb),public.guardar_cierre_calendario(uuid,jsonb,uuid),
  public.validar_cierre_calendario(),public.validar_turno_cierre() TO service_role;
COMMIT;
NOTIFY pgrst, 'reload schema';
