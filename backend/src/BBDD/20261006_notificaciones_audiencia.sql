-- Aplicar antes de 20261006_notificaciones_envios.sql. Solo la API puede ejecutar estas consultas.
BEGIN;
CREATE OR REPLACE FUNCTION public.notificacion_destinatarios(a jsonb, excluir_super boolean)
RETURNS TABLE(id_usuario uuid, nombre text, email text, rol text, dni text, nombre_usuario text)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT u.id_usuario, coalesce(nullif(concat_ws(' ', p.nombres, p.apellidos), ''), u.nombre_usuario)::text,
    u.email::text, r.codigo::text, p.dni::text, u.nombre_usuario::text
  FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol
  LEFT JOIN personas p ON p.id_persona = u.id_persona
  WHERE u.activo AND r.activo AND (p.id_persona IS NULL OR p.activo)
    AND (NOT excluir_super OR r.codigo <> 'SUPER_ADMIN')
    AND (a->>'id_usuario' IS NULL OR u.id_usuario = (a->>'id_usuario')::uuid)
    AND (a->>'tipo' <> 'ROL' OR r.codigo = a->>'rol')
    AND (a->>'tipo' <> 'ADMINISTRADORES' OR r.codigo = 'ADMIN_SALITA')
    AND (a->>'tipo' <> 'PACIENTES' OR (r.codigo = 'PACIENTE' AND EXISTS (
      SELECT 1 FROM pacientes pa WHERE pa.id_persona = u.id_persona AND pa.activo)))
    AND (a->>'tipo' <> 'PROFESIONALES' OR (r.codigo = 'PROFESIONAL' AND EXISTS (
      SELECT 1 FROM profesionales pr WHERE pr.id_persona = u.id_persona AND pr.activo)))
    AND (a->>'id_especialidad' IS NULL OR EXISTS (
      SELECT 1 FROM profesionales pr
      JOIN profesional_especialidad pe ON pe.id_profesional = pr.id_profesional
      JOIN especialidades e ON e.id_especialidad = pe.id_especialidad
      WHERE pr.id_persona = u.id_persona AND pr.activo AND pe.activo AND e.activo
        AND pe.id_especialidad = (a->>'id_especialidad')::uuid
        AND pe.fecha_desde <= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
        AND (pe.fecha_hasta IS NULL OR pe.fecha_hasta >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)))
    AND (a->>'id_salita' IS NULL OR EXISTS (
      SELECT 1 FROM salitas s WHERE s.id_salita = (a->>'id_salita')::uuid AND s.activo AND (
        (r.codigo = 'PACIENTE' AND EXISTS (SELECT 1 FROM pacientes pa
          WHERE pa.id_persona = u.id_persona AND pa.activo AND pa.id_salita_asignada = s.id_salita))
        OR (r.codigo = 'PROFESIONAL' AND EXISTS (
          SELECT 1 FROM profesionales pr JOIN profesional_salita ps ON ps.id_profesional = pr.id_profesional
          WHERE pr.id_persona = u.id_persona AND pr.activo AND ps.activo AND ps.id_salita = s.id_salita
            AND ps.fecha_desde <= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
            AND (ps.fecha_hasta IS NULL OR ps.fecha_hasta >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)))
        OR (r.codigo IN ('ADMIN_SALITA', 'RECEPCION') AND EXISTS (
          SELECT 1 FROM usuario_salita us WHERE us.id_usuario = u.id_usuario AND us.id_salita = s.id_salita AND us.activo
            AND us.fecha_desde <= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
            AND (us.fecha_hasta IS NULL OR us.fecha_hasta >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)))
      )))
$$;

CREATE OR REPLACE FUNCTION public.notificacion_preview(a jsonb, excluir_super boolean, buscar text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  WITH audiencia AS MATERIALIZED (
    SELECT * FROM notificacion_destinatarios(a, excluir_super)
    WHERE buscar IS NULL OR position(lower(buscar) IN lower(concat_ws(' ', nombre, dni, email, nombre_usuario))) > 0
  ), muestra AS (SELECT id_usuario, nombre, email, rol FROM audiencia ORDER BY nombre, id_usuario LIMIT 20)
  SELECT jsonb_build_object('cantidad', count(*),
    'confirmacion', md5(coalesce(string_agg(id_usuario::text, ',' ORDER BY id_usuario), '')),
    'usuarios', CASE WHEN buscar IS NULL THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(muestra) FROM muestra), '[]'::jsonb) END)
  FROM audiencia
$$;
REVOKE ALL ON FUNCTION public.notificacion_destinatarios(jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificacion_preview(jsonb, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificacion_destinatarios(jsonb, boolean), public.notificacion_preview(jsonb, boolean, text) TO service_role;
COMMIT;
