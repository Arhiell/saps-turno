BEGIN;

ALTER TABLE public.tokens_recuperacion
  ADD COLUMN IF NOT EXISTS intentos SMALLINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_token_recuperacion_intentos'
      AND conrelid = 'public.tokens_recuperacion'::regclass
  ) THEN
    ALTER TABLE public.tokens_recuperacion
      ADD CONSTRAINT ck_token_recuperacion_intentos CHECK (intentos BETWEEN 0 AND 5);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.emitir_codigo_recuperacion(
  p_usuario UUID,
  p_hash TEXT,
  p_expiracion TIMESTAMPTZ,
  p_ip TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cuenta public.usuarios%ROWTYPE;
  token_id UUID;
BEGIN
  SELECT * INTO cuenta
    FROM public.usuarios
    WHERE id_usuario = p_usuario
    FOR UPDATE;

  IF NOT FOUND OR NOT cuenta.activo THEN RETURN NULL; END IF;

  IF EXISTS (
    SELECT 1 FROM public.tokens_recuperacion
    WHERE id_usuario = p_usuario
      AND fecha_creacion > NOW() - INTERVAL '60 seconds'
  ) THEN
    RETURN NULL;
  END IF;

  UPDATE public.tokens_recuperacion
    SET fecha_uso = NOW()
    WHERE id_usuario = p_usuario AND fecha_uso IS NULL;

  INSERT INTO public.tokens_recuperacion
    (id_usuario, token_hash, fecha_expiracion, ip_solicitud, intentos)
  VALUES
    (p_usuario, p_hash, p_expiracion, NULLIF(p_ip, '')::INET, 0)
  RETURNING id_token INTO token_id;

  RETURN token_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.consumir_codigo_recuperacion(
  p_email TEXT,
  p_hash TEXT,
  p_password_hash TEXT
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cuenta public.usuarios%ROWTYPE;
  token public.tokens_recuperacion%ROWTYPE;
BEGIN
  SELECT * INTO cuenta
    FROM public.usuarios
    WHERE lower(email) = lower(p_email)
    FOR UPDATE;

  IF NOT FOUND OR NOT cuenta.activo THEN RETURN 'INVALIDO'; END IF;

  SELECT * INTO token
    FROM public.tokens_recuperacion
    WHERE id_usuario = cuenta.id_usuario AND fecha_uso IS NULL
    ORDER BY fecha_creacion DESC
    LIMIT 1
    FOR UPDATE;

  IF NOT FOUND THEN RETURN 'INVALIDO'; END IF;
  IF token.fecha_expiracion <= NOW() THEN RETURN 'EXPIRADO'; END IF;
  IF token.intentos >= 5 THEN RETURN 'INTENTOS'; END IF;

  IF token.token_hash <> p_hash THEN
    UPDATE public.tokens_recuperacion
      SET intentos = intentos + 1,
          fecha_uso = CASE WHEN intentos + 1 >= 5 THEN NOW() ELSE NULL END
      WHERE id_token = token.id_token;
    RETURN CASE WHEN token.intentos + 1 >= 5 THEN 'INTENTOS' ELSE 'INVALIDO' END;
  END IF;

  UPDATE public.usuarios
    SET password_hash = p_password_hash,
        intentos_fallidos = 0,
        bloqueado_hasta = NULL
    WHERE id_usuario = cuenta.id_usuario;

  UPDATE public.tokens_recuperacion
    SET fecha_uso = NOW()
    WHERE id_token = token.id_token;

  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.emitir_codigo_recuperacion(UUID, TEXT, TIMESTAMPTZ, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emitir_codigo_recuperacion(UUID, TEXT, TIMESTAMPTZ, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.consumir_codigo_recuperacion(TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_codigo_recuperacion(TEXT, TEXT, TEXT)
  TO service_role;

COMMIT;