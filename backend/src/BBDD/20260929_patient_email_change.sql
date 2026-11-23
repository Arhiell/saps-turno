-- Reutiliza los tokens actuales y conserva el email vigente hasta la confirmación.
BEGIN;

ALTER TABLE public.tokens_verificacion_email
  ADD COLUMN IF NOT EXISTS intentos SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nuevo_email VARCHAR(254),
  ADD COLUMN IF NOT EXISTS email_anterior VARCHAR(254);

-- Evita emitir varios códigos válidos mediante solicitudes simultáneas.
CREATE OR REPLACE FUNCTION public.emitir_codigo_email(
  p_usuario UUID, p_hash TEXT, p_expiracion TIMESTAMPTZ, p_ip TEXT,
  p_nuevo_email TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cuenta public.usuarios%ROWTYPE;
  token_id UUID;
BEGIN
  SELECT * INTO cuenta FROM public.usuarios WHERE id_usuario = p_usuario FOR UPDATE;
  IF NOT FOUND OR NOT cuenta.activo THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.tokens_verificacion_email WHERE id_usuario = p_usuario
    AND fecha_creacion > NOW() - INTERVAL '60 seconds') THEN RETURN NULL; END IF;
  UPDATE public.tokens_verificacion_email SET fecha_uso = NOW()
    WHERE id_usuario = p_usuario AND fecha_uso IS NULL;
  INSERT INTO public.tokens_verificacion_email
    (id_usuario, token_hash, fecha_expiracion, ip_solicitud, intentos, nuevo_email, email_anterior)
  VALUES (p_usuario, p_hash, p_expiracion, NULLIF(p_ip, '')::INET, 0, p_nuevo_email,
    CASE WHEN p_nuevo_email IS NOT NULL THEN cuenta.email ELSE NULL END)
  RETURNING id_token INTO token_id;
  RETURN token_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.consumir_codigo_email(
  p_usuario UUID, p_hash TEXT, p_nuevo_email TEXT DEFAULT NULL
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  token public.tokens_verificacion_email%ROWTYPE;
  cuenta public.usuarios%ROWTYPE;
BEGIN
  -- Serializa intentos y consumo del mismo usuario.
  SELECT * INTO cuenta FROM public.usuarios WHERE id_usuario = p_usuario FOR UPDATE;
  IF NOT FOUND OR NOT cuenta.activo THEN RETURN 'INVALIDO'; END IF;
  SELECT * INTO token FROM public.tokens_verificacion_email
    WHERE id_usuario = p_usuario AND fecha_uso IS NULL
    ORDER BY fecha_creacion DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR token.nuevo_email IS DISTINCT FROM p_nuevo_email THEN RETURN 'INVALIDO'; END IF;
  IF token.fecha_expiracion <= NOW() THEN RETURN 'EXPIRADO'; END IF;
  IF token.intentos >= 5 THEN RETURN 'INTENTOS'; END IF;
  IF token.token_hash <> p_hash THEN
    UPDATE public.tokens_verificacion_email SET intentos = intentos + 1,
      fecha_uso = CASE WHEN intentos + 1 >= 5 THEN NOW() ELSE NULL END
      WHERE id_token = token.id_token;
    RETURN CASE WHEN token.intentos + 1 >= 5 THEN 'INTENTOS' ELSE 'INVALIDO' END;
  END IF;
  IF p_nuevo_email IS NOT NULL THEN
    IF cuenta.email IS DISTINCT FROM token.email_anterior THEN RETURN 'INVALIDO'; END IF;
    IF EXISTS (SELECT 1 FROM public.usuarios WHERE lower(email) = lower(p_nuevo_email)
      AND id_usuario <> p_usuario) OR EXISTS (
      SELECT 1 FROM public.personas WHERE lower(email) = lower(p_nuevo_email)
        AND id_persona IS DISTINCT FROM cuenta.id_persona
    ) THEN RETURN 'OCUPADO'; END IF;
    -- Cuenta y persona se actualizan en la misma transacción.
    UPDATE public.usuarios SET email = p_nuevo_email, email_verificado = TRUE
      WHERE id_usuario = p_usuario;
    IF cuenta.id_persona IS NOT NULL THEN
      UPDATE public.personas SET email = p_nuevo_email WHERE id_persona = cuenta.id_persona;
    END IF;
  ELSE
    UPDATE public.usuarios SET email_verificado = TRUE WHERE id_usuario = p_usuario;
  END IF;
  UPDATE public.tokens_verificacion_email SET fecha_uso = NOW() WHERE id_token = token.id_token;
  RETURN 'OK';
EXCEPTION WHEN unique_violation THEN RETURN 'OCUPADO';
END;
$$;

REVOKE ALL ON FUNCTION public.consumir_codigo_email(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_codigo_email(UUID, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.emitir_codigo_email(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emitir_codigo_email(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO service_role;

-- Publica las columnas y firmas RPC nuevas en la API al confirmar la transacción.
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Comprobación sin consultar correos ni tokens de usuarios.
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tokens_verificacion_email'
      AND column_name = 'nuevo_email') AS nuevo_email_disponible,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tokens_verificacion_email'
      AND column_name = 'email_anterior') AS email_anterior_disponible,
  to_regprocedure('public.emitir_codigo_email(uuid,text,timestamp with time zone,text,text)')
    IS NOT NULL AS emitir_codigo_disponible,
  to_regprocedure('public.consumir_codigo_email(uuid,text,text)')
    IS NOT NULL AS consumir_codigo_disponible;
