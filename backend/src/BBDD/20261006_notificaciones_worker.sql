-- Aplicar después de audiencia y envios. Reclamo exclusivo entre procesos de API.
BEGIN;
CREATE FUNCTION public.notificacion_reclamar()
RETURNS SETOF public.notificaciones LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  -- Un SMTP interrumpido tiene resultado incierto: no se reenvía automáticamente.
  UPDATE notificaciones SET estado_envio = 'FALLIDA', procesamiento = NULL,
    error_envio = 'Envío interrumpido; no se pudo confirmar la entrega del correo.'
    WHERE id_envio IS NOT NULL AND canal = 'EMAIL' AND estado_envio = 'PENDIENTE'
      AND procesamiento_desde < now() - interval '10 minutes';
  RETURN QUERY
    WITH siguiente AS (
      SELECT n.id_notificacion FROM notificaciones n JOIN notificacion_envios e ON e.id_envio = n.id_envio
      WHERE NOT e.cancelada AND n.estado_envio = 'PENDIENTE' AND n.fecha_programada <= now()
        AND (n.procesamiento IS NULL OR (n.canal = 'SISTEMA' AND n.procesamiento_desde < now() - interval '10 minutes'))
      ORDER BY n.fecha_programada, n.canal DESC, n.id_notificacion FOR UPDATE OF n, e SKIP LOCKED LIMIT 1
    )
    UPDATE notificaciones n SET procesamiento = gen_random_uuid(), procesamiento_desde = now(),
      intentos_envio = least(n.intentos_envio::int + 1, 32767)::smallint
    FROM siguiente s WHERE n.id_notificacion = s.id_notificacion RETURNING n.*;
END $$;
REVOKE ALL ON FUNCTION public.notificacion_reclamar() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificacion_reclamar() TO service_role;
COMMIT;
