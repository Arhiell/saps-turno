-- Aplicar después de 20261103_agenda_impacto.sql.
BEGIN;
-- Escritura parametrizada exclusiva del backend. La API valida permisos,
-- alcance y negocio; los triggers conservan integridad, historial y auditoría.
CREATE OR REPLACE FUNCTION public.guardar_agenda(
  p_tipo text, p_id uuid, p_datos jsonb, p_usuario uuid,
  p_version integer DEFAULT NULL, p_motivo text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE tabla text; clave text; permitidos text[]; campos text; valores text;
  resultado jsonb; actual jsonb; rol text; salita uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(20261103, 1);
  IF p_usuario IS NULL THEN RAISE EXCEPTION 'Usuario requerido'; END IF;
  CASE p_tipo
    WHEN 'turno' THEN
      tabla := 'turnos'; clave := 'id_turno';
      permitidos := ARRAY['id_profesional','id_especialidad','id_salita','id_horario',
        'fecha_hora_inicio','fecha_hora_fin','motivo_consulta','observaciones'];
      IF p_id IS NULL OR p_version IS NULL THEN RAISE EXCEPTION 'Versión requerida'; END IF;
    WHEN 'horario' THEN
      tabla := 'horarios_atencion'; clave := 'id_horario';
      permitidos := ARRAY['id_profesional','id_especialidad','id_salita','dia_semana',
        'hora_inicio','hora_fin','duracion_turno_minutos','cupo_maximo_diario',
        'vigencia_desde','vigencia_hasta','activo'];
    WHEN 'bloqueo' THEN
      tabla := 'bloqueos_agenda'; clave := 'id_bloqueo';
      permitidos := ARRAY['id_profesional','id_especialidad','id_salita','fecha',
        'hora_inicio','hora_fin','dia_completo','motivo','activo'];
    ELSE RAISE EXCEPTION 'Tipo inválido';
  END CASE;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_datos) k WHERE NOT k = ANY(permitidos))
     OR p_datos = '{}'::jsonb THEN RAISE EXCEPTION 'Campos inválidos'; END IF;
  IF p_id IS NOT NULL THEN
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE %I = $1 FOR UPDATE', tabla, clave)
      INTO actual USING p_id;
    IF actual IS NULL THEN RETURN NULL; END IF;
    IF p_tipo = 'turno' AND (actual->>'version')::integer <> p_version THEN RETURN NULL; END IF;
  END IF;
  -- Revalida origen y destino bajo el mismo lock que la escritura; evita que
  -- un cambio concurrente de salita eluda el alcance comprobado por la API.
  SELECT r.codigo INTO rol FROM public.usuarios u JOIN public.roles r USING (id_rol)
    WHERE u.id_usuario = p_usuario AND u.activo AND r.activo;
  IF rol IS NULL OR rol NOT IN ('SUPER_ADMIN','ADMIN_SALITA','RECEPCION') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No tiene permisos para gestionar esta agenda';
  END IF;
  IF rol <> 'SUPER_ADMIN' THEN
    FOR salita IN SELECT DISTINCT valor::uuid FROM unnest(ARRAY[
      actual->>'id_salita', COALESCE(p_datos->>'id_salita',actual->>'id_salita')]) valor
      WHERE valor IS NOT NULL
    LOOP
      IF NOT EXISTS (SELECT 1 FROM public.usuario_salita us
        WHERE us.id_usuario = p_usuario AND us.id_salita = salita AND us.activo
          AND us.fecha_desde <= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
          AND (us.fecha_hasta IS NULL OR us.fecha_hasta >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La salita está fuera de su alcance';
      END IF;
    END LOOP;
  END IF;
  PERFORM set_config('app.current_user_id', p_usuario::text, true);
  PERFORM set_config('app.current_salita_id', COALESCE(p_datos->>'id_salita',actual->>'id_salita',''), true);
  PERFORM set_config('app.change_reason', COALESCE(p_motivo,''), true);
  SELECT string_agg(format('%I', k), ','), string_agg(format('r.%I', k), ',')
    INTO campos, valores FROM jsonb_object_keys(p_datos) k;
  IF p_id IS NULL THEN
    IF p_tipo = 'bloqueo' THEN
      p_datos := p_datos || jsonb_build_object('creado_por',p_usuario);
      campos := campos || ',creado_por'; valores := valores || ',r.creado_por';
    END IF;
    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r RETURNING to_jsonb(%I.*)',
      tabla, campos, valores, tabla, tabla) INTO resultado USING p_datos;
  ELSE
    EXECUTE format('UPDATE public.%I t SET (%s) = (SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r) WHERE t.%I = $2 RETURNING to_jsonb(t.*)',
      tabla, campos, valores, tabla, clave) INTO resultado USING p_datos, p_id;
  END IF;
  RETURN resultado;
END;
$$;
REVOKE ALL ON FUNCTION public.guardar_agenda(text,uuid,jsonb,uuid,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_agenda(text,uuid,jsonb,uuid,integer,text) TO service_role;

CREATE OR REPLACE FUNCTION public.registrar_historial_turno()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_usuario uuid; v_accion varchar(50); v_motivo text;
BEGIN
  v_usuario := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
  v_motivo := NULLIF(current_setting('app.change_reason', true), '');
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.historial_turnos (id_turno,id_usuario,accion,id_estado_nuevo,fecha_hora_nueva,detalle)
    VALUES (NEW.id_turno,COALESCE(v_usuario,NEW.creado_por),'CREACION',NEW.id_estado,NEW.fecha_hora_inicio,'Turno creado');
    RETURN NEW;
  END IF;
  v_accion := CASE
    WHEN OLD.id_estado IS DISTINCT FROM NEW.id_estado THEN 'CAMBIO_ESTADO'
    WHEN OLD.fecha_hora_inicio IS DISTINCT FROM NEW.fecha_hora_inicio
      OR OLD.fecha_hora_fin IS DISTINCT FROM NEW.fecha_hora_fin THEN 'REPROGRAMACION'
    WHEN OLD.id_profesional IS DISTINCT FROM NEW.id_profesional THEN 'CAMBIO_PROFESIONAL'
    ELSE 'MODIFICACION' END;
  INSERT INTO public.historial_turnos (id_turno,id_usuario,accion,id_estado_anterior,id_estado_nuevo,
    fecha_hora_anterior,fecha_hora_nueva,detalle)
  VALUES (NEW.id_turno,COALESCE(v_usuario,NEW.creado_por),v_accion,OLD.id_estado,NEW.id_estado,
    OLD.fecha_hora_inicio,NEW.fecha_hora_inicio,COALESCE(v_motivo,'Cambio registrado automaticamente'));
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.guardar_turno_agenda(p_id uuid, p_datos jsonb, p_usuario uuid,
  p_version integer, p_motivo text DEFAULT NULL)
RETURNS SETOF public.turnos LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE resultado jsonb;
BEGIN
  resultado := public.guardar_agenda('turno',p_id,p_datos,p_usuario,p_version,p_motivo);
  IF resultado IS NOT NULL THEN
    RETURN QUERY SELECT * FROM jsonb_populate_record(NULL::public.turnos,resultado);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.guardar_turno_agenda(uuid,jsonb,uuid,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_turno_agenda(uuid,jsonb,uuid,integer,text) TO service_role;
COMMIT;
NOTIFY pgrst, 'reload schema';
