ALTER TABLE public.tokens_verificacion_email
  ADD COLUMN IF NOT EXISTS intentos SMALLINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_token_email_intentos'
      AND conrelid = 'public.tokens_verificacion_email'::regclass
  ) THEN
    ALTER TABLE public.tokens_verificacion_email
      ADD CONSTRAINT ck_token_email_intentos CHECK (intentos BETWEEN 0 AND 5);
  END IF;
END;
$$;