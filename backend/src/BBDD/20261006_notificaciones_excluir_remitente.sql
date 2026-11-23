-- Aplicar después de 20261006_notificaciones_edicion.sql.
BEGIN;

CREATE FUNCTION public.notificacion_preview_v2(a jsonb, excluir_super boolean, buscar text, excluir_usuario uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  WITH audiencia AS MATERIALIZED (
    SELECT * FROM notificacion_destinatarios(a, excluir_super)
    WHERE (excluir_usuario IS NULL OR id_usuario <> excluir_usuario)
      AND (buscar IS NULL OR position(lower(buscar) IN lower(concat_ws(' ', nombre, dni, email, nombre_usuario))) > 0)
  ), muestra AS (
    SELECT id_usuario, nombre, email, rol FROM audiencia ORDER BY nombre, id_usuario LIMIT 20
  )
  SELECT jsonb_build_object(
    'cantidad', count(*),
    'confirmacion', md5(coalesce(string_agg(id_usuario::text, ',' ORDER BY id_usuario), '')),
    'usuarios', CASE WHEN buscar IS NULL THEN '[]'::jsonb
      ELSE coalesce((SELECT jsonb_agg(muestra) FROM muestra), '[]'::jsonb) END
  )
  FROM audiencia
$$;

CREATE OR REPLACE FUNCTION public.notificacion_crear_envio(datos jsonb, excluir_super boolean, confirmacion text)
RETURNS uuid LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE ids uuid[]; firma text; envio uuid; existente notificacion_envios;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(datos->>'clave', 0));
  SELECT * INTO existente FROM notificacion_envios WHERE clave = (datos->>'clave')::uuid;
  IF FOUND THEN
    IF existente.id_remitente <> (datos->>'id_remitente')::uuid THEN RAISE EXCEPTION 'Clave en uso'; END IF;
    RETURN existente.id_envio;
  END IF;
  SELECT array_agg(id_usuario ORDER BY id_usuario), md5(string_agg(id_usuario::text, ',' ORDER BY id_usuario))
    INTO ids, firma
    FROM notificacion_destinatarios(datos->'audiencia', excluir_super)
    WHERE id_usuario <> (datos->>'id_remitente')::uuid;
  IF ids IS NULL OR firma IS DISTINCT FROM confirmacion THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUDIENCIA_CAMBIO';
  END IF;
  IF (datos->>'fecha_programada')::timestamptz <= now() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FECHA_PASADA';
  END IF;
  PERFORM set_config('app.current_user_id', datos->>'id_remitente', true);
  PERFORM set_config('app.current_salita_id', coalesce(datos->>'id_salita', ''), true);
  INSERT INTO notificacion_envios(clave, id_remitente, id_salita, remitente, rol_remitente, audiencia,
    destinatarios, cantidad, titulo, mensaje, email, fecha_programada)
  VALUES ((datos->>'clave')::uuid, (datos->>'id_remitente')::uuid, (datos->>'id_salita')::uuid,
    datos->>'remitente', datos->>'rol_remitente', datos->'audiencia', datos->>'destinatarios', cardinality(ids),
    datos->>'titulo', datos->>'mensaje', (datos->>'email')::boolean, (datos->>'fecha_programada')::timestamptz)
  RETURNING id_envio INTO envio;
  INSERT INTO notificaciones(id_envio, id_usuario, tipo, canal, titulo, mensaje, remitente, fecha_programada)
  SELECT envio, id, 'AVISO_GENERAL', c, datos->>'titulo', datos->>'mensaje', datos->>'remitente',
    coalesce((datos->>'fecha_programada')::timestamptz, now())
  FROM unnest(ids) id
    CROSS JOIN unnest(CASE WHEN (datos->>'email')::boolean THEN ARRAY['SISTEMA','EMAIL'] ELSE ARRAY['SISTEMA'] END) c;
  RETURN envio;
END $$;

CREATE OR REPLACE FUNCTION public.notificacion_editar_envio(envio uuid, datos jsonb, original jsonb, excluir_super boolean)
RETURNS uuid LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE actual notificacion_envios; ids uuid[]; firma text;
BEGIN
  SELECT * INTO actual FROM notificacion_envios WHERE id_envio = envio FOR UPDATE;
  IF NOT FOUND OR actual.cancelada OR actual.fecha_programada IS NULL
    OR actual.fecha_programada <= clock_timestamp()
    OR EXISTS (SELECT 1 FROM notificaciones WHERE id_envio = envio
      AND (estado_envio <> 'PENDIENTE' OR procesamiento IS NOT NULL OR intentos_envio > 0)) THEN
    RAISE EXCEPTION 'ENVIO_NO_EDITABLE';
  END IF;
  IF actual.audiencia IS DISTINCT FROM original->'audiencia'
    OR actual.titulo IS DISTINCT FROM original->>'titulo'
    OR actual.mensaje IS DISTINCT FROM original->>'mensaje'
    OR actual.email IS DISTINCT FROM (original->>'email')::boolean
    OR actual.fecha_programada IS DISTINCT FROM (original->>'fecha_programada')::timestamptz THEN
    RAISE EXCEPTION 'ENVIO_MODIFICADO';
  END IF;
  IF (datos->>'fecha_programada') IS NULL OR (datos->>'fecha_programada')::timestamptz <= clock_timestamp() THEN
    RAISE EXCEPTION 'FECHA_PASADA';
  END IF;
  SELECT array_agg(id_usuario ORDER BY id_usuario), md5(string_agg(id_usuario::text, ',' ORDER BY id_usuario))
    INTO ids, firma
    FROM notificacion_destinatarios(datos->'audiencia', excluir_super)
    WHERE id_usuario <> (datos->>'id_remitente')::uuid;
  IF ids IS NULL OR firma IS DISTINCT FROM datos->>'confirmacion' THEN RAISE EXCEPTION 'AUDIENCIA_CAMBIO'; END IF;
  PERFORM set_config('app.current_user_id', datos->>'actor', true);
  PERFORM set_config('app.current_salita_id', coalesce(datos->>'id_salita', ''), true);
  UPDATE notificacion_envios SET titulo = datos->>'titulo', mensaje = datos->>'mensaje',
    audiencia = datos->'audiencia', destinatarios = datos->>'destinatarios', cantidad = cardinality(ids),
    email = (datos->>'email')::boolean, fecha_programada = (datos->>'fecha_programada')::timestamptz,
    id_salita = (datos->>'id_salita')::uuid, remitente = datos->>'remitente'
    WHERE id_envio = envio;
  DELETE FROM notificaciones WHERE id_envio = envio;
  INSERT INTO notificaciones(id_envio, id_usuario, tipo, canal, titulo, mensaje, remitente, fecha_programada)
  SELECT envio, id, 'AVISO_GENERAL', c, datos->>'titulo', datos->>'mensaje', datos->>'remitente',
    (datos->>'fecha_programada')::timestamptz
  FROM unnest(ids) id
    CROSS JOIN unnest(CASE WHEN (datos->>'email')::boolean THEN ARRAY['SISTEMA','EMAIL'] ELSE ARRAY['SISTEMA'] END) c;
  RETURN envio;
END $$;

REVOKE ALL ON FUNCTION public.notificacion_preview_v2(jsonb, boolean, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificacion_preview_v2(jsonb, boolean, text, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
