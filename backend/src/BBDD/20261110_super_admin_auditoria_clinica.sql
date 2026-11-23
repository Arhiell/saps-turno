-- Migración idempotente: asigna exclusivamente el permiso VER_AUDITORIA_CLINICA al rol SUPER_ADMIN.
-- No otorga permisos asistenciales sobre el contenido de historias clínicas ni modifica otros roles.
-- Ejecutar manualmente en el entorno correspondiente cuando se habilite la sección de Auditoría Clínica.

BEGIN;

INSERT INTO public.permisos (codigo, nombre, descripcion)
VALUES (
    'VER_AUDITORIA_CLINICA',
    'Ver auditoría clínica',
    'Consulta del registro inmutable de accesos y operaciones clínicas.'
)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
  FROM public.roles r
  JOIN public.permisos p
    ON p.codigo = 'VER_AUDITORIA_CLINICA'
 WHERE r.codigo = 'SUPER_ADMIN'
   AND r.activo
   AND p.activo
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

COMMIT;
