-- Cabecera administrativa; las entregas siguen usando la bandeja existente.
BEGIN;
CREATE TABLE public.notificacion_envios (
  id_envio uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave uuid NOT NULL UNIQUE,
  id_remitente uuid NOT NULL REFERENCES public.usuarios(id_usuario),
  id_salita uuid REFERENCES public.salitas(id_salita),
  remitente text NOT NULL,
  rol_remitente text NOT NULL,
  audiencia jsonb NOT NULL,
  destinatarios text NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  titulo varchar(160) NOT NULL,
  mensaje text NOT NULL CHECK (char_length(mensaje) BETWEEN 3 AND 2000),
  email boolean NOT NULL,
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_programada timestamptz,
  cancelada boolean NOT NULL DEFAULT false
);
ALTER TABLE public.notificacion_envios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notificacion_envios FROM anon, authenticated;
GRANT ALL ON public.notificacion_envios TO service_role;
ALTER TABLE public.notificaciones
  ADD COLUMN id_envio uuid REFERENCES public.notificacion_envios(id_envio),
  ADD COLUMN remitente text,
  ADD COLUMN procesamiento uuid,
  ADD COLUMN procesamiento_desde timestamptz;
CREATE UNIQUE INDEX uq_notificacion_entrega ON public.notificaciones(id_envio, id_usuario, canal) WHERE id_envio IS NOT NULL;
CREATE INDEX ix_envios_historial ON public.notificacion_envios(id_salita, fecha_creacion DESC);
CREATE TRIGGER tr_auditar_notificacion_envios AFTER INSERT OR UPDATE OR DELETE ON public.notificacion_envios
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_envio');

CREATE VIEW public.notificacion_envios_resumen WITH (security_invoker = true) AS
SELECT e.*, s.sistema_enviadas, s.email_enviados, s.fallidas, s.pendientes, s.canceladas, s.fecha_envio,
  CASE WHEN e.cancelada THEN 'CANCELADA' WHEN s.pendientes > 0 THEN 'PENDIENTE'
    WHEN s.fallidas > 0 THEN 'FALLIDA' WHEN s.canceladas > 0 THEN 'CANCELADA' ELSE 'ENVIADA' END AS estado
FROM public.notificacion_envios e
CROSS JOIN LATERAL (
  SELECT count(*) FILTER (WHERE canal = 'SISTEMA' AND estado_envio = 'ENVIADA')::int AS sistema_enviadas,
    count(*) FILTER (WHERE canal = 'EMAIL' AND estado_envio = 'ENVIADA')::int AS email_enviados,
    count(*) FILTER (WHERE estado_envio = 'FALLIDA')::int AS fallidas,
    count(*) FILTER (WHERE estado_envio = 'PENDIENTE')::int AS pendientes,
    count(*) FILTER (WHERE estado_envio = 'CANCELADA')::int AS canceladas,
    max(fecha_envio) AS fecha_envio
  FROM public.notificaciones n WHERE n.id_envio = e.id_envio
) s;
REVOKE ALL ON public.notificacion_envios_resumen FROM anon, authenticated;
GRANT SELECT ON public.notificacion_envios_resumen TO service_role;

-- Inserta cabecera y entregas en una sola transacción, sin truncar audiencias masivas.
CREATE FUNCTION public.notificacion_crear_envio(datos jsonb, excluir_super boolean, confirmacion text)
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
    INTO ids, firma FROM notificacion_destinatarios(datos->'audiencia', excluir_super);
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
  FROM unnest(ids) id CROSS JOIN unnest(CASE WHEN (datos->>'email')::boolean THEN ARRAY['SISTEMA','EMAIL'] ELSE ARRAY['SISTEMA'] END) c;
  RETURN envio;
END $$;

CREATE FUNCTION public.notificacion_cancelar_envio(envio uuid, actor uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM set_config('app.current_user_id', actor::text, true);
  PERFORM set_config('app.current_salita_id', coalesce((SELECT id_salita::text FROM notificacion_envios WHERE id_envio = envio), ''), true);
  UPDATE notificacion_envios SET cancelada = true
    WHERE id_envio = envio AND NOT cancelada AND fecha_programada > clock_timestamp()
      AND NOT EXISTS (SELECT 1 FROM notificaciones WHERE id_envio = envio AND procesamiento IS NOT NULL);
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE notificaciones SET estado_envio = 'CANCELADA'
    WHERE id_envio = envio AND estado_envio = 'PENDIENTE';
  RETURN true;
END $$;

CREATE FUNCTION public.notificacion_resumen_fallas(envio uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(resumen), '[]'::jsonb) FROM (
    SELECT coalesce(error_envio, 'Entrega cancelada por la administración.') AS motivo, count(*)::int AS cantidad
    FROM notificaciones WHERE id_envio = envio AND estado_envio IN ('FALLIDA', 'CANCELADA')
    GROUP BY error_envio ORDER BY count(*) DESC
  ) resumen
$$;
REVOKE ALL ON FUNCTION public.notificacion_resumen_fallas(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificacion_resumen_fallas(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.notificacion_crear_envio(jsonb, boolean, text), public.notificacion_cancelar_envio(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificacion_crear_envio(jsonb, boolean, text), public.notificacion_cancelar_envio(uuid, uuid) TO service_role;
COMMIT;
