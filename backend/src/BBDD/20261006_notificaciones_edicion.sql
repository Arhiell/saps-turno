-- Actualización incremental: ejecutar sobre las tres migraciones anteriores.
-- Puede volver a ejecutarse; no recrea tablas ni elimina envíos existentes.
BEGIN;
CREATE OR REPLACE FUNCTION public.notificacion_resumen_fallas(envio uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(resumen), '[]'::jsonb) FROM (
    SELECT coalesce(error_envio, 'Entrega cancelada por la administración.') AS motivo, count(*)::int AS cantidad
    FROM notificaciones WHERE id_envio = envio AND estado_envio IN ('FALLIDA', 'CANCELADA')
    GROUP BY error_envio ORDER BY count(*) DESC
  ) resumen
$$;

CREATE OR REPLACE FUNCTION public.notificacion_editar_envio(envio uuid, datos jsonb, original jsonb, excluir_super boolean)
RETURNS uuid LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE actual notificacion_envios; ids uuid[]; firma text;
BEGIN
  -- El worker comparte este bloqueo: una entrega comenzada nunca se reemplaza.
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
    INTO ids, firma FROM notificacion_destinatarios(datos->'audiencia', excluir_super);
  IF ids IS NULL OR firma IS DISTINCT FROM datos->>'confirmacion' THEN RAISE EXCEPTION 'AUDIENCIA_CAMBIO'; END IF;
  PERFORM set_config('app.current_user_id', datos->>'actor', true);
  PERFORM set_config('app.current_salita_id', coalesce(datos->>'id_salita', ''), true);
  UPDATE notificacion_envios SET titulo = datos->>'titulo', mensaje = datos->>'mensaje',
    audiencia = datos->'audiencia', destinatarios = datos->>'destinatarios', cantidad = cardinality(ids),
    email = (datos->>'email')::boolean, fecha_programada = (datos->>'fecha_programada')::timestamptz,
    id_salita = (datos->>'id_salita')::uuid, remitente = datos->>'remitente'
    WHERE id_envio = envio;
  -- Solo reemplaza entregas futuras no iniciadas; todo se confirma junto o se revierte.
  DELETE FROM notificaciones WHERE id_envio = envio;
  INSERT INTO notificaciones(id_envio, id_usuario, tipo, canal, titulo, mensaje, remitente, fecha_programada)
  SELECT envio, id, 'AVISO_GENERAL', c, datos->>'titulo', datos->>'mensaje', datos->>'remitente',
    (datos->>'fecha_programada')::timestamptz
  FROM unnest(ids) id CROSS JOIN unnest(CASE WHEN (datos->>'email')::boolean THEN ARRAY['SISTEMA','EMAIL'] ELSE ARRAY['SISTEMA'] END) c;
  RETURN envio;
END $$;

CREATE OR REPLACE FUNCTION public.notificacion_cancelar_envio(envio uuid, actor uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE actual notificacion_envios;
BEGIN
  SELECT * INTO actual FROM notificacion_envios WHERE id_envio = envio FOR UPDATE;
  IF NOT FOUND OR actual.cancelada OR actual.fecha_programada IS NULL
    OR actual.fecha_programada <= clock_timestamp()
    OR EXISTS (SELECT 1 FROM notificaciones WHERE id_envio = envio
      AND (estado_envio <> 'PENDIENTE' OR procesamiento IS NOT NULL OR intentos_envio > 0)) THEN RETURN false; END IF;
  PERFORM set_config('app.current_user_id', actor::text, true);
  PERFORM set_config('app.current_salita_id', coalesce(actual.id_salita::text, ''), true);
  UPDATE notificacion_envios SET cancelada = true WHERE id_envio = envio;
  UPDATE notificaciones SET estado_envio = 'CANCELADA' WHERE id_envio = envio AND estado_envio = 'PENDIENTE';
  RETURN true;
END $$;

-- Asegura coordinación incluso si se instaló una versión anterior del worker.
CREATE OR REPLACE FUNCTION public.notificacion_reclamar()
RETURNS SETOF public.notificaciones LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE notificaciones SET estado_envio = 'FALLIDA', procesamiento = NULL,
    error_envio = 'Envío interrumpido; no se pudo confirmar la entrega del correo.'
    WHERE id_envio IS NOT NULL AND canal = 'EMAIL' AND estado_envio = 'PENDIENTE'
      AND procesamiento_desde < now() - interval '10 minutes';
  RETURN QUERY
    WITH siguiente AS (
      SELECT n.id_notificacion FROM notificaciones n JOIN notificacion_envios e ON e.id_envio = n.id_envio
      WHERE NOT e.cancelada AND n.estado_envio = 'PENDIENTE' AND n.fecha_programada <= now()
        AND (n.procesamiento IS NULL OR (n.canal = 'SISTEMA' AND n.procesamiento_desde < now() - interval '10 minutes'))
      ORDER BY n.fecha_programada, n.canal DESC, n.id_notificacion LIMIT 1 FOR UPDATE OF n, e SKIP LOCKED
    )
    UPDATE notificaciones n SET procesamiento = gen_random_uuid(), procesamiento_desde = now(),
      intentos_envio = least(n.intentos_envio::int + 1, 32767)::smallint
    FROM siguiente s WHERE n.id_notificacion = s.id_notificacion RETURNING n.*;
END $$;

REVOKE ALL ON FUNCTION public.notificacion_editar_envio(uuid, jsonb, jsonb, boolean),
  public.notificacion_resumen_fallas(uuid), public.notificacion_cancelar_envio(uuid, uuid), public.notificacion_reclamar()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificacion_editar_envio(uuid, jsonb, jsonb, boolean),
  public.notificacion_resumen_fallas(uuid), public.notificacion_cancelar_envio(uuid, uuid), public.notificacion_reclamar() TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
