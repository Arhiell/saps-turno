-- Sin columnas nuevas: crea identidad y vínculo como una única operación.
BEGIN;

CREATE OR REPLACE FUNCTION public.completar_perfil_administrativo(
  p_usuario UUID, p_persona JSONB, p_ip TEXT DEFAULT NULL
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  cuenta public.usuarios%ROWTYPE;
  persona_id UUID;
BEGIN
  -- Serializa dobles envíos del mismo usuario y vuelve a comprobar permisos.
  SELECT * INTO cuenta FROM public.usuarios WHERE id_usuario = p_usuario FOR UPDATE;
  IF NOT FOUND OR NOT cuenta.activo OR NOT cuenta.email_verificado THEN
    RETURN 'NO_AUTORIZADO';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id_rol = cuenta.id_rol
    AND activo AND codigo IN ('SUPER_ADMIN', 'ADMIN_SALITA')) THEN
    RETURN 'NO_AUTORIZADO';
  END IF;
  IF cuenta.id_persona IS NOT NULL THEN RETURN 'COMPLETO'; END IF;

  SELECT id_persona INTO persona_id FROM public.personas WHERE dni = p_persona->>'dni';
  IF FOUND THEN
    IF EXISTS (SELECT 1 FROM public.usuarios WHERE id_persona = persona_id) THEN
      RETURN 'DNI_CUENTA';
    END IF;
    -- No reclama fichas de pacientes/profesionales/tutores sólo por conocer su DNI.
    RETURN 'DNI_EXISTENTE';
  END IF;
  IF EXISTS (SELECT 1 FROM public.personas WHERE lower(email) = lower(cuenta.email)) THEN
    RETURN 'EMAIL_EXISTENTE';
  END IF;

  -- Reutiliza los triggers de auditoría con el actor real de esta transacción.
  PERFORM set_config('app.current_user_id', p_usuario::TEXT, TRUE);
  PERFORM set_config('app.client_ip', COALESCE(p_ip, ''), TRUE);

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

  UPDATE public.usuarios SET id_persona = persona_id WHERE id_usuario = p_usuario;
  RETURN 'OK';
EXCEPTION WHEN unique_violation THEN
  -- El bloque completo se revierte, incluida persona y auditoría, ante una carrera.
  RETURN 'DUPLICADO';
END;
$$;

REVOKE ALL ON FUNCTION public.completar_perfil_administrativo(UUID, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.completar_perfil_administrativo(UUID, JSONB, TEXT)
  TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
