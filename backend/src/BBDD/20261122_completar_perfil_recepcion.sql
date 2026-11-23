-- Actualización de función para permitir el completado de perfil al rol RECEPCION
-- Restringida para ejecución exclusiva por el backend (service_role).
BEGIN;

CREATE OR REPLACE FUNCTION public.completar_perfil_administrativo(
  p_usuario UUID, p_persona JSONB, p_ip TEXT DEFAULT NULL
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  cuenta public.usuarios%ROWTYPE;
  persona_id UUID;
BEGIN
  -- 1. Serializa envíos concurrentes para el mismo usuario y bloquea la fila.
  SELECT * INTO cuenta FROM public.usuarios WHERE id_usuario = p_usuario FOR UPDATE;
  IF NOT FOUND OR NOT cuenta.activo OR NOT cuenta.email_verificado THEN
    RETURN 'NO_AUTORIZADO';
  END IF;

  -- 2. Restricción estricta de roles administrativos permitidos.
  IF NOT EXISTS (
    SELECT 1 FROM public.roles
    WHERE id_rol = cuenta.id_rol
      AND activo
      AND codigo IN ('SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION')
  ) THEN
    RETURN 'NO_AUTORIZADO';
  END IF;

  -- 3. Idempotencia: si ya tiene perfil vinculado, impide sobreescritura.
  IF cuenta.id_persona IS NOT NULL THEN
    RETURN 'COMPLETO';
  END IF;

  -- 4. Validación de unicidad de DNI.
  SELECT id_persona INTO persona_id FROM public.personas WHERE dni = p_persona->>'dni';
  IF FOUND THEN
    IF EXISTS (SELECT 1 FROM public.usuarios WHERE id_persona = persona_id) THEN
      RETURN 'DNI_CUENTA';
    END IF;
    -- No reclama fichas de pacientes/profesionales/tutores sólo por conocer su DNI.
    RETURN 'DNI_EXISTENTE';
  END IF;

  -- 5. Validación de unicidad de Email.
  IF EXISTS (SELECT 1 FROM public.personas WHERE lower(email) = lower(cuenta.email)) THEN
    RETURN 'EMAIL_EXISTENTE';
  END IF;

  -- 6. Configuración de contexto para triggers de auditoría con la identidad real del usuario y su IP.
  PERFORM set_config('app.current_user_id', p_usuario::TEXT, TRUE);
  PERFORM set_config('app.client_ip', COALESCE(p_ip, ''), TRUE);

  -- 7. Inserción de la nueva persona.
  INSERT INTO public.personas
    (dni, nombres, apellidos, fecha_nacimiento, sexo, telefono, email,
     direccion, localidad, provincia, codigo_postal)
  VALUES
    (p_persona->>'dni', trim(p_persona->>'nombres'), trim(p_persona->>'apellidos'),
     NULLIF(p_persona->>'fecha_nacimiento', '')::DATE, NULLIF(p_persona->>'sexo', ''),
     NULLIF(trim(p_persona->>'telefono'), ''), lower(cuenta.email),
     NULLIF(trim(p_persona->>'direccion'), ''),
     COALESCE(p_persona->>'localidad', 'Goya'),
     COALESCE(p_persona->>'provincia', 'Corrientes'),
     NULLIF(trim(p_persona->>'codigo_postal'), ''))
  RETURNING id_persona INTO persona_id;

  -- 8. Vinculación atómica usuario -> persona.
  UPDATE public.usuarios SET id_persona = persona_id WHERE id_usuario = p_usuario;
  RETURN 'OK';
EXCEPTION WHEN unique_violation THEN
  -- El bloque completo se revierte (incluyendo persona y auditoría) ante una colisión concurrente.
  RETURN 'DUPLICADO';
END;
$$;

-- Restricción estricta de permisos:
-- Se revoca todo acceso a roles públicos y autenticados vía PostgREST directo.
REVOKE ALL ON FUNCTION public.completar_perfil_administrativo(UUID, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;

-- Se autoriza de forma exclusiva al service_role (usado por el backend Node.js).
GRANT EXECUTE ON FUNCTION public.completar_perfil_administrativo(UUID, JSONB, TEXT)
  TO service_role;

-- Notificar a PostgREST para recargar el esquema de permisos.
NOTIFY pgrst, 'reload schema';

COMMIT;
