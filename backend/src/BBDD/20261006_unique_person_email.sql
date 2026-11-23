-- Auditoría de las restricciones e índices existentes, sin consultar datos personales.
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('usuarios', 'personas', 'profesionales')
ORDER BY tablename, indexname;

BEGIN;
-- Evita cambios de correo entre la comprobación y la creación del índice.
LOCK TABLE public.personas IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  -- Reutiliza un índice equivalente aunque tenga otro nombre (también email CITEXT).
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    LEFT JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
    LEFT JOIN pg_type t ON t.oid = a.atttypid
    WHERE i.indrelid = 'public.personas'::regclass
      AND i.indisunique AND i.indisvalid AND i.indisready
      AND i.indnkeyatts = 1
      AND (i.indpred IS NULL OR
        regexp_replace(pg_get_expr(i.indpred, i.indrelid), '[()[:space:]]', '', 'g') = 'emailISNOTNULL')
      AND (
        regexp_replace(replace(pg_get_indexdef(i.indexrelid, 1, true), '::text', ''),
          '[()[:space:]]', '', 'g') = 'loweremail'
        OR (a.attname = 'email' AND t.typname = 'citext')
      )
  ) THEN
    -- No elimina ni combina personas si la base ya contiene duplicados.
    IF EXISTS (
      SELECT 1 FROM public.personas WHERE email IS NOT NULL
      GROUP BY lower(email) HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'Hay correos repetidos entre personas. Deben corregirse antes de aplicar la unicidad.';
    END IF;
    CREATE UNIQUE INDEX uq_personas_email_lower ON public.personas (lower(email));
  END IF;
END;
$$;

COMMIT;

-- DNI, matrícula, nombre de usuario y email de usuario ya tienen UNIQUE en el esquema base.
-- Esta migración no agrega índices redundantes para esos campos ni cambia su comparación.
