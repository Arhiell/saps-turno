-- ============================================================================
-- MIGRACIÓN ADITIVA PROPUESTA (PENDIENTE DE REVISIÓN - NO EJECUTADA EN SUPABASE)
-- Archivo: backend/src/BBDD/PROPUESTA_20261110_hc_borradores_y_turno_anticipado.sql
-- Prerrequisito: backend/src/BBDD/20261110_historia_clinica.sql aplicado.
-- Alcance:
--   1. Crea public.borradores_formulario_clinico con RLS, índices únicos por
--      usuario/profesional/paciente/(turno opcional) y RPC SECURITY DEFINER con
--      control de concurrencia optimista (40001 / captura de 23505).
--   2. Agrega consultas_medicas.fecha_preparacion sin modificar filas previas.
--   3. Integra el flujo completo de borradores vinculados a turnos futuros en:
--      - public.validar_consulta_medica() (trigger completo preservando todas
--        las reglas existentes + bloqueo estricto de FIRMADA con fecha futura).
--      - public.verificar_acceso_clinico() (firma intacta de 7 parámetros).
--      - public.registrar_consulta_clinica()
--      - public.firmar_consulta_medica()
--      - public.anular_consulta_borrador()
-- Garantías:
--   * No elimina ni modifica registros clínicos o turnos existentes.
--   * Guardar un BORRADOR nunca cambia el estado del turno a ATENDIDO.
--   * No altera permisos clínicos ni asignaciones de roles existentes.
--   * Se ejecuta dentro de una única transacción atómica BEGIN ... COMMIT.
-- ============================================================================

BEGIN;

/* ========================================================================== */
/* 0. VERIFICACIÓN PREVIA DE PRERREQUISITOS Y LIMPIEZA DE STUB PREVIO         */
/* ========================================================================== */

DO $$
BEGIN
    IF to_regclass('public.historias_clinicas') IS NULL
       OR to_regclass('public.consultas_medicas') IS NULL
       OR to_regclass('public.turnos') IS NULL THEN
        RAISE EXCEPTION 'Faltan tablas base requeridas de Historia Clínica o Turnos antes de aplicar esta migración';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_trigger t
          JOIN pg_class c ON c.oid = t.tgrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname = 'consultas_medicas'
           AND t.tgname = 'tr_consultas_validar'
           AND NOT t.tgisinternal
    ) THEN
        RAISE EXCEPTION 'No se encontró el trigger base tr_consultas_validar en public.consultas_medicas';
    END IF;
END;
$$;

-- Elimina cualquier función preliminar no integrada si existiera en entorno de revisión.
DROP FUNCTION IF EXISTS public.validar_consulta_medica_propuesta();

/* ========================================================================== */
/* 1. TABLA DE BORRADORES TEMPORALES DEL FORMULARIO CLÍNICO                   */
/* ========================================================================== */

CREATE TABLE IF NOT EXISTS public.borradores_formulario_clinico (
    id_borrador         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario          UUID NOT NULL
                        REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    id_profesional      UUID NOT NULL
                        REFERENCES public.profesionales(id_profesional) ON DELETE CASCADE,
    id_paciente         UUID NOT NULL
                        REFERENCES public.pacientes(id_paciente) ON DELETE CASCADE,
    id_salita           UUID NOT NULL
                        REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    id_especialidad     UUID REFERENCES public.especialidades(id_especialidad) ON DELETE RESTRICT,
    id_turno            UUID REFERENCES public.turnos(id_turno) ON DELETE SET NULL,
    datos_formulario    JSONB NOT NULL,
    version             INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    fecha_preparacion   DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE),
    expira_en           TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_borrador_datos_objeto CHECK (jsonb_typeof(datos_formulario) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_borradores_form_sin_turno
    ON public.borradores_formulario_clinico (id_usuario, id_profesional, id_paciente)
    WHERE id_turno IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_borradores_form_con_turno
    ON public.borradores_formulario_clinico (id_usuario, id_profesional, id_paciente, id_turno)
    WHERE id_turno IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_borradores_form_expira
    ON public.borradores_formulario_clinico (expira_en);

DROP TRIGGER IF EXISTS tr_borradores_form_fecha ON public.borradores_formulario_clinico;
CREATE TRIGGER tr_borradores_form_fecha
BEFORE UPDATE ON public.borradores_formulario_clinico
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();

ALTER TABLE public.borradores_formulario_clinico ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.borradores_formulario_clinico FROM PUBLIC, anon, authenticated, service_role;

/* ========================================================================== */
/* 2. RPC DE AUTOGUARDADO, RECUPERACIÓN, DESCARTE Y CONCURRENCIA OPTIMISTA    */
/* ========================================================================== */

CREATE OR REPLACE FUNCTION public.obtener_borrador_formulario_clinico(
    p_usuario   UUID,
    p_paciente  UUID,
    p_salita    UUID,
    p_turno     UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_acceso            JSONB;
    v_id_profesional    UUID;
    v_borrador          public.borradores_formulario_clinico%ROWTYPE;
BEGIN
    v_acceso := public.verificar_acceso_clinico(
        p_usuario,
        p_paciente,
        p_salita,
        'CREAR_CONSULTA_CLINICA',
        NULL,
        NULL,
        FALSE
    );
    v_id_profesional := (v_acceso->>'id_profesional')::UUID;

    -- Purga únicamente borradores vencidos del profesional solicitante.
    DELETE FROM public.borradores_formulario_clinico
     WHERE id_usuario = p_usuario
       AND id_profesional = v_id_profesional
       AND expira_en <= NOW();

    SELECT *
      INTO v_borrador
      FROM public.borradores_formulario_clinico b
     WHERE b.id_usuario = p_usuario
       AND b.id_profesional = v_id_profesional
       AND b.id_paciente = p_paciente
       AND b.id_turno IS NOT DISTINCT FROM p_turno
       AND b.expira_en > NOW()
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object(
        'id_borrador', v_borrador.id_borrador,
        'id_paciente', v_borrador.id_paciente,
        'id_salita', v_borrador.id_salita,
        'id_especialidad', v_borrador.id_especialidad,
        'id_turno', v_borrador.id_turno,
        'datos_formulario', v_borrador.datos_formulario,
        'version', v_borrador.version,
        'fecha_preparacion', v_borrador.fecha_preparacion,
        'expira_en', v_borrador.expira_en,
        'fecha_actualizacion', v_borrador.fecha_actualizacion
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.guardar_borrador_formulario_clinico(
    p_usuario           UUID,
    p_paciente          UUID,
    p_salita            UUID,
    p_especialidad      UUID DEFAULT NULL,
    p_turno             UUID DEFAULT NULL,
    p_datos_formulario  JSONB DEFAULT '{}'::JSONB,
    p_version_esperada  INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_acceso            JSONB;
    v_id_profesional    UUID;
    v_turno             RECORD;
    v_existente         public.borradores_formulario_clinico%ROWTYPE;
    v_actualizado       public.borradores_formulario_clinico%ROWTYPE;
    v_today             DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
BEGIN
    IF p_datos_formulario IS NULL OR jsonb_typeof(p_datos_formulario) <> 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El borrador temporal debe enviarse como un objeto JSON válido';
    END IF;

    v_acceso := public.verificar_acceso_clinico(
        p_usuario,
        p_paciente,
        p_salita,
        'CREAR_CONSULTA_CLINICA',
        NULL,
        p_especialidad,
        FALSE
    );
    v_id_profesional := (v_acceso->>'id_profesional')::UUID;

    IF p_turno IS NOT NULL THEN
        SELECT t.id_paciente, t.id_profesional, t.id_especialidad, t.id_salita, et.codigo AS estado_codigo
          INTO v_turno
          FROM public.turnos t
          JOIN public.estados_turno et ON et.id_estado = t.id_estado
         WHERE t.id_turno = p_turno;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El turno asociado al borrador no existe';
        END IF;

        IF v_turno.estado_codigo IN ('CANCELADO', 'REPROGRAMADO', 'NO_ASISTIO') THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = format('No se puede preparar un borrador temporal sobre un turno en estado %s', v_turno.estado_codigo);
        END IF;

        IF v_turno.id_paciente <> p_paciente
           OR v_turno.id_profesional <> v_id_profesional
           OR v_turno.id_salita <> p_salita
           OR (p_especialidad IS NOT NULL AND v_turno.id_especialidad <> p_especialidad) THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Los datos del borrador no coinciden con el paciente, profesional, salita o especialidad del turno';
        END IF;
    END IF;

    -- Purga únicamente borradores vencidos de la clave actual para liberar el índice único sin tocar borradores vigentes.
    DELETE FROM public.borradores_formulario_clinico b
     WHERE b.id_usuario = p_usuario
       AND b.id_profesional = v_id_profesional
       AND b.id_paciente = p_paciente
       AND b.id_turno IS NOT DISTINCT FROM p_turno
       AND b.expira_en <= NOW();

    SELECT *
      INTO v_existente
      FROM public.borradores_formulario_clinico b
     WHERE b.id_usuario = p_usuario
       AND b.id_profesional = v_id_profesional
       AND b.id_paciente = p_paciente
       AND b.id_turno IS NOT DISTINCT FROM p_turno
     FOR UPDATE;

    IF FOUND THEN
        IF p_version_esperada IS NOT NULL AND v_existente.version <> p_version_esperada THEN
            RAISE EXCEPTION USING
                ERRCODE = '40001',
                MESSAGE = format(
                    'CONFLICTO_VERSION_BORRADOR: El borrador fue actualizado en otra pestaña o sesión (versión actual %s, esperada %s)',
                    v_existente.version,
                    p_version_esperada
                );
        END IF;

        UPDATE public.borradores_formulario_clinico
           SET id_salita = p_salita,
               id_especialidad = COALESCE(p_especialidad, id_especialidad),
               datos_formulario = p_datos_formulario,
               version = v_existente.version + 1,
               fecha_preparacion = v_today,
               expira_en = NOW() + INTERVAL '72 hours',
               fecha_actualizacion = NOW()
         WHERE id_borrador = v_existente.id_borrador
         RETURNING * INTO v_actualizado;
    ELSE
        IF p_version_esperada IS NOT NULL AND p_version_esperada > 0 THEN
            RAISE EXCEPTION USING
                ERRCODE = '40001',
                MESSAGE = 'CONFLICTO_VERSION_BORRADOR: El borrador temporal fue descartado o expiró en otra sesión';
        END IF;

        -- Captura colisiones simultáneas de inserción (23505) entre dos pestañas que inician desde versión 0.
        BEGIN
            INSERT INTO public.borradores_formulario_clinico (
                id_usuario,
                id_profesional,
                id_paciente,
                id_salita,
                id_especialidad,
                id_turno,
                datos_formulario,
                version,
                fecha_preparacion,
                expira_en,
                fecha_creacion,
                fecha_actualizacion
            )
            VALUES (
                p_usuario,
                v_id_profesional,
                p_paciente,
                p_salita,
                p_especialidad,
                p_turno,
                p_datos_formulario,
                1,
                v_today,
                NOW() + INTERVAL '72 hours',
                NOW(),
                NOW()
            )
            RETURNING * INTO v_actualizado;
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION USING
                    ERRCODE = '40001',
                    MESSAGE = 'CONFLICTO_VERSION_BORRADOR: Se creó una versión concurrente del borrador desde otra pestaña o sesión';
        END;
    END IF;

    RETURN jsonb_build_object(
        'id_borrador', v_actualizado.id_borrador,
        'id_paciente', v_actualizado.id_paciente,
        'id_salita', v_actualizado.id_salita,
        'id_especialidad', v_actualizado.id_especialidad,
        'id_turno', v_actualizado.id_turno,
        'datos_formulario', v_actualizado.datos_formulario,
        'version', v_actualizado.version,
        'fecha_preparacion', v_actualizado.fecha_preparacion,
        'expira_en', v_actualizado.expira_en,
        'fecha_actualizacion', v_actualizado.fecha_actualizacion
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.descartar_borrador_formulario_clinico(
    p_usuario   UUID,
    p_paciente  UUID,
    p_salita    UUID,
    p_turno     UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_acceso            JSONB;
    v_id_profesional    UUID;
    v_deleted           INTEGER := 0;
BEGIN
    v_acceso := public.verificar_acceso_clinico(
        p_usuario,
        p_paciente,
        p_salita,
        'CREAR_CONSULTA_CLINICA',
        NULL,
        NULL,
        FALSE
    );
    v_id_profesional := (v_acceso->>'id_profesional')::UUID;

    DELETE FROM public.borradores_formulario_clinico
     WHERE id_usuario = p_usuario
       AND id_profesional = v_id_profesional
       AND id_paciente = p_paciente
       AND id_turno IS NOT DISTINCT FROM p_turno;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    RETURN jsonb_build_object(
        'descartado', (v_deleted > 0),
        'cantidad', v_deleted
    );
END;
$$;

/* ========================================================================== */
/* 3. INTEGRACIÓN COMPLETA EN consultas_medicas, TRIGGER Y RPC CLÍNICAS        */
/* ========================================================================== */

-- Columna aditiva nullable sin actualizar registros históricos existentes.
ALTER TABLE public.consultas_medicas
    ADD COLUMN IF NOT EXISTS fecha_preparacion TIMESTAMPTZ;

COMMENT ON COLUMN public.consultas_medicas.fecha_preparacion IS
    'Fecha real en que el profesional inició o preparó el borrador clínico antes o durante la atención.';

-- 3.1 Reemplazo íntegro de public.validar_consulta_medica() preservando todas sus validaciones
--     e integrando borradores vinculados a turnos futuros sin modificar nunca public.turnos.
CREATE OR REPLACE FUNCTION public.validar_consulta_medica()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_turno                 RECORD;
    v_today                 DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
    v_consult_date          DATE := (NEW.fecha_atencion AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
    v_now_grace             TIMESTAMPTZ := NOW() + INTERVAL '1 minute';
    v_salita_paciente       UUID;
    v_es_borrador_futuro    BOOLEAN;
BEGIN
    IF NEW.estado = 'FIRMADA' AND (v_consult_date > v_today OR NEW.fecha_atencion > v_now_grace) THEN
        RAISE EXCEPTION 'No se puede firmar una consulta médica con fecha u hora de atención futura';
    END IF;

    v_es_borrador_futuro := (
        NEW.id_turno IS NOT NULL
        AND (
            NEW.estado = 'BORRADOR'
            OR (TG_OP = 'UPDATE' AND OLD.estado = 'BORRADOR' AND NEW.estado = 'ANULADA')
        )
    );

    IF (v_consult_date > v_today OR NEW.fecha_atencion > v_now_grace) AND NOT v_es_borrador_futuro THEN
        RAISE EXCEPTION 'La fecha u hora de atención de la consulta no puede ser futura sin un turno programado en borrador';
    END IF;

    SELECT p.id_salita_asignada INTO v_salita_paciente
      FROM public.pacientes p
     WHERE p.id_paciente = NEW.id_paciente AND p.activo;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El paciente no existe o está inactivo';
    END IF;

    IF NEW.id_profesional <> NEW.id_profesional_autor THEN
        RAISE EXCEPTION 'En la consulta médica el profesional y el profesional autor deben coincidir';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profesionales pr WHERE pr.id_profesional = NEW.id_profesional AND pr.activo) THEN
        RAISE EXCEPTION 'El profesional no existe o está inactivo';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.salitas s WHERE s.id_salita = NEW.id_salita AND s.activo) THEN
        RAISE EXCEPTION 'La salita de atención no existe o está inactiva';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.especialidades e WHERE e.id_especialidad = NEW.id_especialidad AND e.activo) THEN
        RAISE EXCEPTION 'La especialidad no existe o está inactiva';
    END IF;

    IF TG_OP = 'INSERT' OR NEW.fecha_atencion IS DISTINCT FROM OLD.fecha_atencion THEN
        IF NOT EXISTS (
            SELECT 1
              FROM public.profesional_salita ps
             WHERE ps.id_profesional = NEW.id_profesional
               AND ps.id_salita = NEW.id_salita
               AND ps.activo
               AND ps.fecha_desde <= v_consult_date
               AND (ps.fecha_hasta IS NULL OR ps.fecha_hasta >= v_consult_date)
        ) THEN
            RAISE EXCEPTION 'El profesional no posee asociación vigente con la salita en la fecha de atención';
        END IF;

        IF NOT EXISTS (
            SELECT 1
              FROM public.profesional_especialidad pe
             WHERE pe.id_profesional = NEW.id_profesional
               AND pe.id_especialidad = NEW.id_especialidad
               AND pe.activo
               AND pe.fecha_desde <= v_consult_date
               AND (pe.fecha_hasta IS NULL OR pe.fecha_hasta >= v_consult_date)
        ) THEN
            RAISE EXCEPTION 'El profesional no está habilitado para la especialidad en la fecha de atención';
        END IF;
    END IF;

    IF NEW.id_turno IS NOT NULL THEN
        SELECT t.id_paciente, t.id_profesional, t.id_especialidad, t.id_salita, et.codigo AS estado_codigo
          INTO v_turno
          FROM public.turnos t
          JOIN public.estados_turno et ON et.id_estado = t.id_estado
         WHERE t.id_turno = NEW.id_turno;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El turno asociado no existe';
        END IF;

        IF v_turno.estado_codigo IN ('CANCELADO', 'REPROGRAMADO', 'NO_ASISTIO') THEN
            RAISE EXCEPTION 'No se puede vincular una consulta médica a un turno en estado %', v_turno.estado_codigo;
        END IF;

        IF v_consult_date > v_today AND v_turno.estado_codigo = 'ATENDIDO' THEN
            RAISE EXCEPTION 'No se puede preparar un borrador con fecha futura sobre un turno ya atendido';
        END IF;

        IF v_turno.id_paciente <> NEW.id_paciente
           OR v_turno.id_profesional <> NEW.id_profesional
           OR v_turno.id_especialidad <> NEW.id_especialidad
           OR v_turno.id_salita <> NEW.id_salita THEN
            RAISE EXCEPTION 'Los datos de la consulta no coinciden con el turno vinculado';
        END IF;
    END IF;

    IF NEW.acompanante_tutor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
              FROM public.paciente_tutores pt
              JOIN public.tutores t ON t.id_tutor = pt.id_tutor AND t.activo
              JOIN public.personas pe ON pe.id_persona = t.id_persona AND pe.activo
             WHERE pt.id_paciente = NEW.id_paciente
               AND pt.id_tutor = NEW.acompanante_tutor_id
               AND pt.identidad_verificada
               AND pt.documentacion_verificada
               AND pt.autorizacion_verificada
               AND pt.fecha_desde <= v_consult_date
               AND (pt.fecha_hasta IS NULL OR pt.fecha_hasta >= v_consult_date)
        ) THEN
            RAISE EXCEPTION 'El tutor acompañante no posee vínculo vigente y verificado para este paciente en la fecha de atención';
        END IF;
        NEW.tutor_verificado := TRUE;
    ELSE
        NEW.tutor_verificado := FALSE;
    END IF;

    IF NEW.id_salita <> v_salita_paciente THEN
        IF NEW.id_autorizacion_clinica IS NULL OR NOT EXISTS (
            SELECT 1
              FROM public.derivaciones_autorizaciones_clinicas d
             WHERE d.id_derivacion = NEW.id_autorizacion_clinica
               AND d.id_paciente = NEW.id_paciente
               AND d.id_salita_origen = v_salita_paciente
               AND d.id_salita_destino = NEW.id_salita
               AND d.estado = 'AUTORIZADA'
               AND d.fecha_desde <= v_consult_date
               AND d.fecha_hasta >= v_consult_date
               AND (
                   (d.alcance = 'LONGITUDINAL' AND d.id_profesional_destino = NEW.id_profesional)
                   OR (d.alcance = 'PROFESIONAL' AND d.id_profesional_destino = NEW.id_profesional
                       AND (d.id_especialidad_destino IS NULL OR d.id_especialidad_destino = NEW.id_especialidad))
                   OR (d.alcance = 'ESPECIALIDAD' AND d.id_especialidad_destino = NEW.id_especialidad
                       AND (d.id_profesional_destino IS NULL OR d.id_profesional_destino = NEW.id_profesional))
               )
        ) THEN
            RAISE EXCEPTION 'La consulta en otra salita requiere una derivación o autorización vigente y acorde al profesional, especialidad y fecha de atención';
        END IF;
    ELSIF NEW.id_autorizacion_clinica IS NOT NULL THEN
        RAISE EXCEPTION 'No debe asociarse una derivación inter-salita cuando la atención se realiza en la salita asignada del paciente';
    END IF;

    RETURN NEW;
END;
$$;

-- Garantiza que el trigger siga conectado tras reemplazar la función.
DROP TRIGGER IF EXISTS tr_consultas_validar ON public.consultas_medicas;
CREATE TRIGGER tr_consultas_validar
BEFORE INSERT OR UPDATE ON public.consultas_medicas
FOR EACH ROW EXECUTE FUNCTION public.validar_consulta_medica();

-- 3.1b Trigger dedicado tr_consultas_bloquear_firma_futura:
--      Separa estrictamente BORRADOR (permitido antes del horario del turno) de FIRMADA
--      (bloqueada tanto si fecha_atencion es futura como si el turno vinculado aún no comenzó).
CREATE OR REPLACE FUNCTION public.bloquear_firma_consulta_futura()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_turno_inicio TIMESTAMPTZ;
BEGIN
    IF NEW.estado = 'FIRMADA' THEN
        IF NEW.fecha_atencion > (NOW() + INTERVAL '1 minute') THEN
            RAISE EXCEPTION USING ERRCODE = '22023',
                MESSAGE = 'No se puede firmar una consulta médica con fecha u hora futura';
        END IF;

        IF NEW.id_turno IS NOT NULL THEN
            SELECT t.fecha_hora_inicio
              INTO v_turno_inicio
              FROM public.turnos t
             WHERE t.id_turno = NEW.id_turno;

            IF FOUND AND v_turno_inicio > NOW() THEN
                RAISE EXCEPTION USING ERRCODE = '22023',
                    MESSAGE = 'No se puede firmar la consulta antes del horario de inicio del turno programado';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_consultas_bloquear_firma_futura ON public.consultas_medicas;
CREATE TRIGGER tr_consultas_bloquear_firma_futura
BEFORE INSERT OR UPDATE OF estado, fecha_atencion, id_turno ON public.consultas_medicas
FOR EACH ROW EXECUTE FUNCTION public.bloquear_firma_consulta_futura();

-- 3.2 verificar_acceso_clinico(): conserva exactamente su firma de 7 parámetros.
--     Solo admite p_fecha_acto futura cuando una RPC SECURITY DEFINER de escritura de borrador
--     activa el candado transaccional local app.permitir_borrador_fecha_futura = 'true'.
CREATE OR REPLACE FUNCTION public.verificar_acceso_clinico(
    p_usuario               UUID,
    p_paciente              UUID,
    p_salita                UUID,
    p_permiso               TEXT DEFAULT 'VER_HISTORIA_CLINICA',
    p_fecha_acto            DATE DEFAULT NULL,
    p_especialidad          UUID DEFAULT NULL,
    p_requiere_longitudinal BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_cuenta                    RECORD;
    v_id_profesional            UUID;
    v_salita_paciente           UUID;
    v_derivacion                RECORD;
    v_fecha_acceso              DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
    v_permitir_borrador_futuro  BOOLEAN := (
        COALESCE(current_setting('app.permitir_borrador_fecha_futura', TRUE), '') = 'true'
        AND p_permiso IN (
            'CREAR_CONSULTA_CLINICA',
            'GESTIONAR_ANTECEDENTES_CLINICOS',
            'REGISTRAR_DIAGNOSTICOS',
            'REGISTRAR_EVOLUCIONES',
            'GESTIONAR_TRATAMIENTOS',
            'GESTIONAR_ESTUDIOS_CLINICOS'
        )
    );
BEGIN
    IF p_usuario IS NULL OR p_paciente IS NULL OR p_salita IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Usuario, paciente y salita son requeridos';
    END IF;

    IF p_fecha_acto IS NOT NULL AND p_fecha_acto > v_fecha_acceso AND NOT v_permitir_borrador_futuro THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La fecha del acto clínico no puede ser futura';
    END IF;

    SELECT u.id_usuario, u.id_persona, u.activo AS usuario_activo,
           r.id_rol, r.codigo AS rol_codigo, r.activo AS rol_activo
      INTO v_cuenta
      FROM public.usuarios u
      JOIN public.roles r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = p_usuario;

    IF NOT FOUND OR NOT v_cuenta.usuario_activo OR NOT v_cuenta.rol_activo THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Usuario no autorizado o inactivo';
    END IF;

    IF v_cuenta.rol_codigo <> 'PROFESIONAL' OR v_cuenta.id_persona IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acceso clínico restringido a profesionales con perfil vinculado';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM public.rol_permisos rp
          JOIN public.permisos pe ON pe.id_permiso = rp.id_permiso
         WHERE rp.id_rol = v_cuenta.id_rol
           AND pe.codigo = p_permiso
           AND pe.activo
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El profesional no posee el permiso clínico requerido';
    END IF;

    SELECT pr.id_profesional
      INTO v_id_profesional
      FROM public.profesionales pr
     WHERE pr.id_persona = v_cuenta.id_persona
       AND pr.activo;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No existe perfil profesional activo vinculado al usuario';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM public.profesional_salita ps
          JOIN public.salitas s ON s.id_salita = ps.id_salita
         WHERE ps.id_profesional = v_id_profesional
           AND ps.id_salita = p_salita
           AND s.activo
           AND ps.activo
           AND ps.fecha_desde <= v_fecha_acceso
           AND (ps.fecha_hasta IS NULL OR ps.fecha_hasta >= v_fecha_acceso)
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El profesional no tiene asociación vigente hoy con la salita indicada';
    END IF;

    IF p_fecha_acto IS NOT NULL AND NOT EXISTS (
        SELECT 1
          FROM public.profesional_salita ps
         WHERE ps.id_profesional = v_id_profesional
           AND ps.id_salita = p_salita
           AND ps.activo
           AND ps.fecha_desde <= p_fecha_acto
           AND (ps.fecha_hasta IS NULL OR ps.fecha_hasta >= p_fecha_acto)
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El profesional no tenía asociación vigente con la salita en la fecha del acto clínico';
    END IF;

    IF p_especialidad IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
              FROM public.especialidades e
             WHERE e.id_especialidad = p_especialidad AND e.activo
        ) THEN
            RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'La especialidad indicada no existe o está inactiva';
        END IF;

        IF NOT EXISTS (
            SELECT 1
              FROM public.profesional_especialidad pe
             WHERE pe.id_profesional = v_id_profesional
               AND pe.id_especialidad = p_especialidad
               AND pe.activo
               AND pe.fecha_desde <= v_fecha_acceso
               AND (pe.fecha_hasta IS NULL OR pe.fecha_hasta >= v_fecha_acceso)
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El profesional no posee habilitación vigente hoy para la especialidad indicada';
        END IF;

        IF p_fecha_acto IS NOT NULL AND NOT EXISTS (
            SELECT 1
              FROM public.profesional_especialidad pe
             WHERE pe.id_profesional = v_id_profesional
               AND pe.id_especialidad = p_especialidad
               AND pe.activo
               AND pe.fecha_desde <= p_fecha_acto
               AND (pe.fecha_hasta IS NULL OR pe.fecha_hasta >= p_fecha_acto)
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El profesional no poseía habilitación vigente para la especialidad en la fecha del acto clínico';
        END IF;
    END IF;

    SELECT pa.id_salita_asignada
      INTO v_salita_paciente
      FROM public.pacientes pa
     WHERE pa.id_paciente = p_paciente
       AND pa.activo;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Paciente no encontrado o inactivo';
    END IF;

    IF v_salita_paciente = p_salita THEN
        RETURN jsonb_build_object(
            'autorizado', TRUE,
            'id_profesional', v_id_profesional,
            'id_salita_paciente', v_salita_paciente,
            'via', 'SALITA_ASIGNADA',
            'alcance', 'SALITA_ASIGNADA',
            'id_derivacion', NULL,
            'id_especialidad_autorizada', p_especialidad,
            'fecha_acceso', v_fecha_acceso,
            'fecha_desde_autorizada', NULL,
            'fecha_hasta_autorizada', NULL
        );
    END IF;

    SELECT d.id_derivacion, d.alcance, d.id_especialidad_destino, d.id_profesional_destino,
           d.fecha_desde, d.fecha_hasta
      INTO v_derivacion
      FROM public.derivaciones_autorizaciones_clinicas d
     WHERE d.id_paciente = p_paciente
       AND d.id_salita_origen = v_salita_paciente
       AND d.id_salita_destino = p_salita
       AND d.estado = 'AUTORIZADA'
       AND d.fecha_desde <= v_fecha_acceso
       AND d.fecha_hasta >= v_fecha_acceso
       AND (
           p_fecha_acto IS NULL
           OR d.alcance = 'LONGITUDINAL'
           OR (d.fecha_desde <= p_fecha_acto AND d.fecha_hasta >= p_fecha_acto)
       )
       AND (
           (
               p_requiere_longitudinal = TRUE
               AND d.alcance = 'LONGITUDINAL'
               AND d.id_profesional_destino = v_id_profesional
           )
           OR
           (
               p_requiere_longitudinal = FALSE
               AND (
                   (d.alcance = 'LONGITUDINAL' AND d.id_profesional_destino = v_id_profesional)
                   OR (
                       d.alcance = 'ESPECIALIDAD'
                       AND p_especialidad IS NOT NULL
                       AND d.id_especialidad_destino = p_especialidad
                       AND (d.id_profesional_destino IS NULL OR d.id_profesional_destino = v_id_profesional)
                   )
                   OR (
                       d.alcance = 'PROFESIONAL'
                       AND d.id_profesional_destino = v_id_profesional
                       AND (
                           d.id_especialidad_destino IS NULL
                           OR (p_especialidad IS NOT NULL AND d.id_especialidad_destino = p_especialidad)
                       )
                   )
               )
           )
       )
       AND (
           d.id_especialidad_destino IS NULL
           OR (
               EXISTS (
                   SELECT 1
                     FROM public.especialidades e_dest
                    WHERE e_dest.id_especialidad = d.id_especialidad_destino
                      AND e_dest.activo
               )
               AND EXISTS (
                   SELECT 1
                     FROM public.profesional_especialidad pe
                    WHERE pe.id_profesional = v_id_profesional
                      AND pe.id_especialidad = d.id_especialidad_destino
                      AND pe.activo
                      AND pe.fecha_desde <= v_fecha_acceso
                      AND (pe.fecha_hasta IS NULL OR pe.fecha_hasta >= v_fecha_acceso)
               )
               AND (
                   p_fecha_acto IS NULL
                   OR EXISTS (
                       SELECT 1
                         FROM public.profesional_especialidad pe
                        WHERE pe.id_profesional = v_id_profesional
                          AND pe.id_especialidad = d.id_especialidad_destino
                          AND pe.activo
                          AND pe.fecha_desde <= p_fecha_acto
                          AND (pe.fecha_hasta IS NULL OR pe.fecha_hasta >= p_fecha_acto)
                   )
               )
           )
       )
     ORDER BY CASE d.alcance WHEN 'LONGITUDINAL' THEN 1 WHEN 'PROFESIONAL' THEN 2 ELSE 3 END,
              d.fecha_resolucion DESC NULLS LAST,
              d.fecha_creacion DESC
     LIMIT 1;

    IF v_derivacion.id_derivacion IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Sin autorización o derivación vigente compatible con el alcance, especialidad y fecha requeridos';
    END IF;

    RETURN jsonb_build_object(
        'autorizado', TRUE,
        'id_profesional', v_id_profesional,
        'id_salita_paciente', v_salita_paciente,
        'via', 'DERIVACION_AUTORIZADA',
        'alcance', v_derivacion.alcance,
        'id_derivacion', v_derivacion.id_derivacion,
        'id_especialidad_autorizada', v_derivacion.id_especialidad_destino,
        'fecha_acceso', v_fecha_acceso,
        'fecha_desde_autorizada', v_derivacion.fecha_desde,
        'fecha_hasta_autorizada', v_derivacion.fecha_hasta
    );
END;
$$;

-- 3.2b Helper interno transaccional para sincronizar turno vinculado a ATENDIDO solo al firmar.
CREATE OR REPLACE FUNCTION public._sincronizar_turno_atendido_firma(
    p_id_turno          UUID,
    p_id_paciente       UUID,
    p_id_profesional    UUID,
    p_id_especialidad   UUID,
    p_id_salita         UUID,
    p_usuario           UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_turno                 RECORD;
    v_id_estado_atendido    UUID;
    v_actualizado           BOOLEAN := FALSE;
BEGIN
    IF p_id_turno IS NULL THEN
        RETURN jsonb_build_object(
            'id_turno', NULL,
            'turno_actualizado', FALSE,
            'turno_estado', NULL
        );
    END IF;

    SELECT t.id_turno,
           t.id_paciente,
           t.id_profesional,
           t.id_especialidad,
           t.id_salita,
           t.id_estado,
           t.fecha_hora_inicio,
           et.codigo AS estado_codigo
      INTO v_turno
      FROM public.turnos t
      JOIN public.estados_turno et ON et.id_estado = t.id_estado
     WHERE t.id_turno = p_id_turno
     FOR UPDATE OF t;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El turno vinculado no existe';
    END IF;

    IF v_turno.id_paciente <> p_id_paciente
       OR v_turno.id_profesional <> p_id_profesional
       OR v_turno.id_especialidad <> p_id_especialidad
       OR v_turno.id_salita <> p_id_salita THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La consulta firmada no coincide con el paciente, profesional, especialidad o salita del turno vinculado';
    END IF;

    IF v_turno.estado_codigo IN ('CANCELADO', 'REPROGRAMADO', 'NO_ASISTIO') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = format('No se puede firmar una consulta vinculada a un turno en estado %s', v_turno.estado_codigo);
    END IF;

    IF v_turno.fecha_hora_inicio > NOW() THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'No se puede firmar la consulta ni marcar el turno como atendido antes del horario de inicio programado';
    END IF;

    IF v_turno.estado_codigo <> 'ATENDIDO' THEN
        SELECT et.id_estado
          INTO v_id_estado_atendido
          FROM public.estados_turno et
         WHERE et.codigo = 'ATENDIDO'
           AND et.activo;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'No se encontró el estado ATENDIDO en el catálogo';
        END IF;

        PERFORM set_config('app.current_user_id', p_usuario::TEXT, TRUE);
        PERFORM set_config('app.current_salita_id', p_id_salita::TEXT, TRUE);
        PERFORM set_config('app.change_reason', 'Atención realizada y consulta médica firmada', TRUE);

        UPDATE public.turnos
           SET id_estado = v_id_estado_atendido
         WHERE id_turno = p_id_turno
           AND id_estado <> v_id_estado_atendido;

        v_actualizado := FOUND;
    END IF;

    RETURN jsonb_build_object(
        'id_turno', p_id_turno,
        'turno_actualizado', v_actualizado,
        'turno_estado', 'ATENDIDO'
    );
END;
$$;

-- 3.3 registrar_consulta_clinica(): permite guardar BORRADOR con turno futuro y fecha_preparacion,
--     impide duplicados por turno, sincroniza turno a ATENDIDO solo al firmar y nunca altera el turno al guardar BORRADOR.
CREATE OR REPLACE FUNCTION public.registrar_consulta_clinica(
    p_usuario   UUID,
    p_salita    UUID,
    p_datos     JSONB,
    p_ip        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_acceso                 JSONB;
    v_id_profesional         UUID;
    v_id_derivacion          UUID;
    v_id_paciente            UUID;
    v_id_especialidad        UUID;
    v_id_turno               UUID;
    v_id_hc                  UUID;
    v_id_consulta            UUID;
    v_firmar                 BOOLEAN;
    v_fecha_atencion         TIMESTAMPTZ;
    v_fecha_atencion_d       DATE;
    v_fecha_preparacion      TIMESTAMPTZ;
    v_today                  DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
    v_es_borrador_anticipado BOOLEAN;
    v_turno                  RECORD;
    v_turno_sync             JSONB := jsonb_build_object('id_turno', NULL, 'turno_actualizado', FALSE, 'turno_estado', NULL);
    v_item                   JSONB;
BEGIN
    IF p_datos IS NULL OR jsonb_typeof(p_datos) <> 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Payload clínico inválido';
    END IF;

    v_id_paciente := NULLIF(p_datos->>'id_paciente', '')::UUID;
    v_id_especialidad := NULLIF(p_datos->>'id_especialidad', '')::UUID;
    v_id_turno := NULLIF(p_datos->>'id_turno', '')::UUID;
    v_firmar := COALESCE((p_datos->>'firmar')::BOOLEAN, FALSE);
    v_fecha_atencion := COALESCE(NULLIF(p_datos->>'fecha_atencion', '')::TIMESTAMPTZ, NOW());
    v_fecha_atencion_d := (v_fecha_atencion AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
    v_fecha_preparacion := COALESCE(NULLIF(p_datos->>'fecha_preparacion', '')::TIMESTAMPTZ, NOW());

    IF v_id_paciente IS NULL OR v_id_especialidad IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Paciente y especialidad son requeridos';
    END IF;

    IF v_fecha_atencion_d > v_today OR v_fecha_atencion > (NOW() + INTERVAL '1 minute') THEN
        IF v_firmar THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'No se puede firmar una consulta médica con fecha u hora de atención futura';
        END IF;
        IF v_id_turno IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Una fecha u hora futura solo se admite al preparar un borrador vinculado a un turno programado';
        END IF;
    END IF;

    IF v_id_turno IS NOT NULL THEN
        SELECT t.id_turno,
               t.id_paciente,
               t.id_profesional,
               t.id_especialidad,
               t.id_salita,
               t.fecha_hora_inicio,
               et.codigo AS estado_codigo
          INTO v_turno
          FROM public.turnos t
          JOIN public.estados_turno et ON et.id_estado = t.id_estado
         WHERE t.id_turno = v_id_turno
         FOR UPDATE OF t;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'El turno asociado no existe';
        END IF;

        IF v_turno.estado_codigo IN ('CANCELADO', 'REPROGRAMADO', 'NO_ASISTIO') THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = format('No se puede vincular una consulta médica a un turno en estado %s', v_turno.estado_codigo);
        END IF;

        IF v_firmar AND v_turno.fecha_hora_inicio > NOW() THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'No se puede firmar la consulta antes del horario de inicio del turno programado; guardala como borrador anticipado';
        END IF;

        IF EXISTS (
            SELECT 1
              FROM public.consultas_medicas cm
             WHERE cm.id_turno = v_id_turno
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Ya existe una consulta registrada para este turno. Abrí el borrador existente para continuarlo o firmarlo sin duplicar registros';
        END IF;
    END IF;

    v_es_borrador_anticipado := (NOT v_firmar AND v_id_turno IS NOT NULL AND v_fecha_atencion_d > v_today);

    PERFORM set_config('app.permitir_borrador_fecha_futura', CASE WHEN v_es_borrador_anticipado THEN 'true' ELSE 'false' END, TRUE);

    v_acceso := public.verificar_acceso_clinico(
        p_usuario,
        v_id_paciente,
        p_salita,
        'CREAR_CONSULTA_CLINICA',
        v_fecha_atencion_d,
        v_id_especialidad,
        FALSE
    );
    v_id_profesional := (v_acceso->>'id_profesional')::UUID;
    v_id_derivacion := NULLIF(v_acceso->>'id_derivacion', '')::UUID;

    IF NOT EXISTS (
        SELECT 1
          FROM public.profesional_especialidad pe
          JOIN public.especialidades e ON e.id_especialidad = pe.id_especialidad AND e.activo
         WHERE pe.id_profesional = v_id_profesional
           AND pe.id_especialidad = v_id_especialidad
           AND pe.activo
           AND pe.fecha_desde <= v_fecha_atencion_d
           AND (pe.fecha_hasta IS NULL OR pe.fecha_hasta >= v_fecha_atencion_d)
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El profesional no está habilitado para la especialidad en la fecha de atención';
    END IF;

    PERFORM set_config('app.current_user_id', p_usuario::TEXT, TRUE);
    PERFORM set_config('app.current_salita_id', p_salita::TEXT, TRUE);
    PERFORM set_config('app.client_ip', COALESCE(p_ip, ''), TRUE);
    PERFORM set_config('app.operacion_consulta_rpc', 'true', TRUE);

    INSERT INTO public.historias_clinicas (id_paciente, creado_por)
    VALUES (v_id_paciente, p_usuario)
    ON CONFLICT (id_paciente) DO NOTHING;

    SELECT id_historia_clinica
      INTO v_id_hc
      FROM public.historias_clinicas
     WHERE id_paciente = v_id_paciente
       AND estado = 'ACTIVA'
     FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La historia clínica del paciente no se encuentra activa';
    END IF;

    INSERT INTO public.consultas_medicas (
        id_historia_clinica,
        id_paciente,
        id_profesional,
        id_especialidad,
        id_salita,
        id_turno,
        id_autorizacion_clinica,
        acompanante_tutor_id,
        fecha_atencion,
        fecha_preparacion,
        motivo_consulta,
        sintomas,
        examen_fisico,
        observaciones,
        estado,
        firmada_en,
        id_profesional_autor
    )
    VALUES (
        v_id_hc,
        v_id_paciente,
        v_id_profesional,
        v_id_especialidad,
        p_salita,
        v_id_turno,
        v_id_derivacion,
        NULLIF(p_datos->>'acompanante_tutor_id', '')::UUID,
        v_fecha_atencion,
        v_fecha_preparacion,
        p_datos->>'motivo_consulta',
        NULLIF(p_datos->>'sintomas', ''),
        NULLIF(p_datos->>'examen_fisico', ''),
        NULLIF(p_datos->>'observaciones', ''),
        CASE WHEN v_firmar THEN 'FIRMADA' ELSE 'BORRADOR' END,
        CASE WHEN v_firmar THEN NOW() ELSE NULL END,
        v_id_profesional
    )
    RETURNING id_consulta INTO v_id_consulta;

    IF jsonb_typeof(p_datos->'diagnosticos') = 'array' AND jsonb_array_length(p_datos->'diagnosticos') > 0 THEN
        PERFORM public.verificar_acceso_clinico(p_usuario, v_id_paciente, p_salita, 'REGISTRAR_DIAGNOSTICOS', v_fecha_atencion_d, v_id_especialidad, FALSE);
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_datos->'diagnosticos') LOOP
            INSERT INTO public.diagnosticos_clinicos (
                id_consulta, id_historia_clinica, id_paciente,
                codigo, descripcion, tipo, fecha_diagnostico, observaciones, id_profesional_autor
            )
            VALUES (
                v_id_consulta, v_id_hc, v_id_paciente,
                NULLIF(v_item->>'codigo', ''),
                v_item->>'descripcion',
                COALESCE(NULLIF(v_item->>'tipo', ''), 'PRESUNTIVO'),
                COALESCE(NULLIF(v_item->>'fecha_diagnostico', '')::DATE, v_fecha_atencion_d),
                NULLIF(v_item->>'observaciones', ''),
                v_id_profesional
            );
        END LOOP;
    END IF;

    IF jsonb_typeof(p_datos->'evoluciones') = 'array' AND jsonb_array_length(p_datos->'evoluciones') > 0 THEN
        PERFORM public.verificar_acceso_clinico(p_usuario, v_id_paciente, p_salita, 'REGISTRAR_EVOLUCIONES', v_fecha_atencion_d, v_id_especialidad, FALSE);
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_datos->'evoluciones') LOOP
            INSERT INTO public.evoluciones_clinicas (
                id_consulta, id_historia_clinica, id_paciente,
                evolucion, observaciones, id_profesional_responsable,
                estado, firmada_en
            )
            VALUES (
                v_id_consulta, v_id_hc, v_id_paciente,
                v_item->>'evolucion',
                NULLIF(v_item->>'observaciones', ''),
                v_id_profesional,
                CASE WHEN v_firmar THEN 'FIRMADA' ELSE 'BORRADOR' END,
                CASE WHEN v_firmar THEN NOW() ELSE NULL END
            );
        END LOOP;
    END IF;

    IF jsonb_typeof(p_datos->'tratamientos') = 'array' AND jsonb_array_length(p_datos->'tratamientos') > 0 THEN
        PERFORM public.verificar_acceso_clinico(p_usuario, v_id_paciente, p_salita, 'GESTIONAR_TRATAMIENTOS', v_fecha_atencion_d, v_id_especialidad, FALSE);
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_datos->'tratamientos') LOOP
            INSERT INTO public.tratamientos_clinicos (
                id_consulta, id_historia_clinica, id_paciente,
                medicacion, dosis, frecuencia, duracion, indicaciones,
                fecha_inicio, fecha_fin, id_profesional_responsable
            )
            VALUES (
                v_id_consulta, v_id_hc, v_id_paciente,
                v_item->>'medicacion',
                v_item->>'dosis',
                v_item->>'frecuencia',
                NULLIF(v_item->>'duracion', ''),
                NULLIF(v_item->>'indicaciones', ''),
                COALESCE(NULLIF(v_item->>'fecha_inicio', '')::DATE, v_fecha_atencion_d),
                NULLIF(v_item->>'fecha_fin', '')::DATE,
                v_id_profesional
            );
        END LOOP;
    END IF;

    IF jsonb_typeof(p_datos->'estudios') = 'array' AND jsonb_array_length(p_datos->'estudios') > 0 THEN
        PERFORM public.verificar_acceso_clinico(p_usuario, v_id_paciente, p_salita, 'GESTIONAR_ESTUDIOS_CLINICOS', v_fecha_atencion_d, v_id_especialidad, FALSE);
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_datos->'estudios') LOOP
            INSERT INTO public.estudios_clinicos (
                id_consulta, id_historia_clinica, id_paciente,
                tipo_estudio, descripcion, id_profesional_solicitante
            )
            VALUES (
                v_id_consulta, v_id_hc, v_id_paciente,
                v_item->>'tipo_estudio',
                v_item->>'descripcion',
                v_id_profesional
            );
        END LOOP;
    END IF;

    IF jsonb_typeof(p_datos->'antecedentes') = 'array' AND jsonb_array_length(p_datos->'antecedentes') > 0 THEN
        PERFORM public.verificar_acceso_clinico(p_usuario, v_id_paciente, p_salita, 'GESTIONAR_ANTECEDENTES_CLINICOS', v_fecha_atencion_d, v_id_especialidad, FALSE);
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_datos->'antecedentes') LOOP
            INSERT INTO public.antecedentes_clinicos (
                id_historia_clinica, id_paciente, tipo, categoria, descripcion,
                fecha_antecedente, id_profesional_autor, id_salita_registro
            )
            VALUES (
                v_id_hc, v_id_paciente,
                v_item->>'tipo',
                NULLIF(v_item->>'categoria', ''),
                v_item->>'descripcion',
                COALESCE(NULLIF(v_item->>'fecha_antecedente', '')::DATE, v_today),
                v_id_profesional,
                p_salita
            );
        END LOOP;
    END IF;

    IF jsonb_typeof(p_datos->'alergias') = 'array' AND jsonb_array_length(p_datos->'alergias') > 0 THEN
        PERFORM public.verificar_acceso_clinico(p_usuario, v_id_paciente, p_salita, 'GESTIONAR_ANTECEDENTES_CLINICOS', v_fecha_atencion_d, v_id_especialidad, FALSE);
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_datos->'alergias') LOOP
            INSERT INTO public.alergias_paciente (
                id_historia_clinica, id_paciente, alergeno, tipo_reaccion,
                gravedad, observaciones, fecha_deteccion,
                id_profesional_autor, id_salita_registro
            )
            VALUES (
                v_id_hc, v_id_paciente,
                v_item->>'alergeno',
                v_item->>'tipo_reaccion',
                v_item->>'gravedad',
                NULLIF(v_item->>'observaciones', ''),
                NULLIF(v_item->>'fecha_deteccion', '')::DATE,
                v_id_profesional,
                p_salita
            );
        END LOOP;
    END IF;

    IF v_firmar AND v_id_turno IS NOT NULL THEN
        v_turno_sync := public._sincronizar_turno_atendido_firma(
            v_id_turno,
            v_id_paciente,
            v_id_profesional,
            v_id_especialidad,
            p_salita,
            p_usuario
        );
    END IF;

    PERFORM public.registrar_acceso_auditoria_clinica(
        p_usuario,
        v_id_paciente,
        p_salita,
        'CREACION',
        'CONSULTA_MEDICA',
        v_id_consulta,
        COALESCE(NULLIF(p_datos->>'motivo_acceso', ''), 'Registro transaccional de consulta médica'),
        v_id_derivacion,
        v_acceso->>'alcance',
        v_fecha_atencion_d,
        p_ip
    );

    RETURN jsonb_build_object(
        'id_historia_clinica', v_id_hc,
        'id_consulta', v_id_consulta,
        'estado', CASE WHEN v_firmar THEN 'FIRMADA' ELSE 'BORRADOR' END,
        'fecha_preparacion', v_fecha_preparacion,
        'id_profesional', v_id_profesional,
        'id_turno', v_id_turno,
        'turno_actualizado', COALESCE((v_turno_sync->>'turno_actualizado')::BOOLEAN, FALSE),
        'turno_estado', NULLIF(v_turno_sync->>'turno_estado', ''),
        'via_acceso', v_acceso->>'via',
        'alcance', v_acceso->>'alcance',
        'id_derivacion', v_id_derivacion
    );
END;
$$;

-- 3.3b actualizar_consulta_borrador(): edita un BORRADOR existente sin duplicar la consulta
--      y permite firmarlo atómicamente actualizando su turno vinculado a ATENDIDO.
CREATE OR REPLACE FUNCTION public.actualizar_consulta_borrador(
    p_usuario       UUID,
    p_salita        UUID,
    p_id_consulta   UUID,
    p_datos         JSONB,
    p_ip            TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_consulta               public.consultas_medicas%ROWTYPE;
    v_acceso                 JSONB;
    v_id_profesional         UUID;
    v_id_derivacion          UUID;
    v_id_especialidad        UUID;
    v_firmar                 BOOLEAN;
    v_fecha_atencion         TIMESTAMPTZ;
    v_fecha_atencion_d       DATE;
    v_fecha_preparacion      TIMESTAMPTZ;
    v_today                  DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
    v_es_borrador_anticipado BOOLEAN;
    v_turno_sync             JSONB := jsonb_build_object('id_turno', NULL, 'turno_actualizado', FALSE, 'turno_estado', NULL);
    v_item                   JSONB;
BEGIN
    IF p_datos IS NULL OR jsonb_typeof(p_datos) <> 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Payload clínico inválido';
    END IF;

    SELECT *
      INTO v_consulta
      FROM public.consultas_medicas
     WHERE id_consulta = p_id_consulta
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'La consulta médica no existe';
    END IF;

    IF v_consulta.id_salita <> p_salita THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No puede modificar una consulta médica perteneciente a otra salita';
    END IF;

    IF v_consulta.estado <> 'BORRADOR' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('Una consulta médica en estado %s es inmutable y no admite modificaciones directas', v_consulta.estado);
    END IF;

    v_firmar := COALESCE((p_datos->>'firmar')::BOOLEAN, FALSE);
    v_id_especialidad := COALESCE(NULLIF(p_datos->>'id_especialidad', '')::UUID, v_consulta.id_especialidad);
    v_fecha_atencion := COALESCE(NULLIF(p_datos->>'fecha_atencion', '')::TIMESTAMPTZ, v_consulta.fecha_atencion);
    v_fecha_atencion_d := (v_fecha_atencion AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
    v_fecha_preparacion := COALESCE(NULLIF(p_datos->>'fecha_preparacion', '')::TIMESTAMPTZ, v_consulta.fecha_preparacion, NOW());

    IF v_fecha_atencion_d > v_today OR v_fecha_atencion > (NOW() + INTERVAL '1 minute') THEN
        IF v_firmar THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'No se puede firmar una consulta médica con fecha u hora de atención futura';
        END IF;
        IF v_consulta.id_turno IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Una fecha u hora futura solo se admite al preparar un borrador vinculado a un turno programado';
        END IF;
    END IF;

    IF v_firmar AND v_consulta.id_turno IS NOT NULL AND EXISTS (
        SELECT 1
          FROM public.turnos t
         WHERE t.id_turno = v_consulta.id_turno
           AND t.fecha_hora_inicio > NOW()
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'No se puede firmar la consulta antes del horario de inicio del turno programado';
    END IF;

    v_es_borrador_anticipado := (NOT v_firmar AND v_consulta.id_turno IS NOT NULL AND v_fecha_atencion_d > v_today);
    PERFORM set_config('app.permitir_borrador_fecha_futura', CASE WHEN v_es_borrador_anticipado THEN 'true' ELSE 'false' END, TRUE);

    v_acceso := public.verificar_acceso_clinico(
        p_usuario,
        v_consulta.id_paciente,
        p_salita,
        'CREAR_CONSULTA_CLINICA',
        v_fecha_atencion_d,
        v_id_especialidad,
        FALSE
    );
    v_id_profesional := (v_acceso->>'id_profesional')::UUID;
    v_id_derivacion := NULLIF(v_acceso->>'id_derivacion', '')::UUID;

    IF v_consulta.id_profesional_autor <> v_id_profesional THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo el profesional autor puede editar o firmar este borrador';
    END IF;

    PERFORM set_config('app.current_user_id', p_usuario::TEXT, TRUE);
    PERFORM set_config('app.current_salita_id', p_salita::TEXT, TRUE);
    PERFORM set_config('app.client_ip', COALESCE(p_ip, ''), TRUE);
    PERFORM set_config('app.operacion_consulta_rpc', 'true', TRUE);

    UPDATE public.consultas_medicas
       SET id_especialidad = v_id_especialidad,
           acompanante_tutor_id = CASE
               WHEN p_datos ? 'acompanante_tutor_id'
               THEN NULLIF(p_datos->>'acompanante_tutor_id', '')::UUID
               ELSE v_consulta.acompanante_tutor_id
           END,
           fecha_atencion = v_fecha_atencion,
           fecha_preparacion = v_fecha_preparacion,
           motivo_consulta = COALESCE(NULLIF(trim(COALESCE(p_datos->>'motivo_consulta', '')), ''), v_consulta.motivo_consulta),
           sintomas = CASE
               WHEN p_datos ? 'sintomas' THEN NULLIF(p_datos->>'sintomas', '')
               ELSE v_consulta.sintomas
           END,
           examen_fisico = CASE
               WHEN p_datos ? 'examen_fisico' THEN NULLIF(p_datos->>'examen_fisico', '')
               ELSE v_consulta.examen_fisico
           END,
           observaciones = CASE
               WHEN p_datos ? 'observaciones' THEN NULLIF(p_datos->>'observaciones', '')
               ELSE v_consulta.observaciones
           END,
           estado = CASE WHEN v_firmar THEN 'FIRMADA' ELSE 'BORRADOR' END,
           firmada_en = CASE WHEN v_firmar THEN NOW() ELSE NULL END
     WHERE id_consulta = p_id_consulta;

    IF p_datos ? 'diagnosticos' AND jsonb_typeof(p_datos->'diagnosticos') = 'array' THEN
        PERFORM public.verificar_acceso_clinico(p_usuario, v_consulta.id_paciente, p_salita, 'REGISTRAR_DIAGNOSTICOS', v_fecha_atencion_d, v_id_especialidad, FALSE);
        UPDATE public.diagnosticos_clinicos
           SET estado = 'ANULADO'
         WHERE id_consulta = p_id_consulta
           AND estado <> 'ANULADO';

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_datos->'diagnosticos') LOOP
            INSERT INTO public.diagnosticos_clinicos (
                id_consulta, id_historia_clinica, id_paciente,
                codigo, descripcion, tipo, fecha_diagnostico, observaciones, id_profesional_autor
            )
            VALUES (
                p_id_consulta, v_consulta.id_historia_clinica, v_consulta.id_paciente,
                NULLIF(v_item->>'codigo', ''),
                v_item->>'descripcion',
                COALESCE(NULLIF(v_item->>'tipo', ''), 'PRESUNTIVO'),
                COALESCE(NULLIF(v_item->>'fecha_diagnostico', '')::DATE, v_fecha_atencion_d),
                NULLIF(v_item->>'observaciones', ''),
                v_id_profesional
            );
        END LOOP;
    END IF;

    IF p_datos ? 'evoluciones' AND jsonb_typeof(p_datos->'evoluciones') = 'array' THEN
        PERFORM public.verificar_acceso_clinico(p_usuario, v_consulta.id_paciente, p_salita, 'REGISTRAR_EVOLUCIONES', v_fecha_atencion_d, v_id_especialidad, FALSE);
        UPDATE public.evoluciones_clinicas
           SET estado = 'ANULADA'
         WHERE id_consulta = p_id_consulta
           AND estado = 'BORRADOR';

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_datos->'evoluciones') LOOP
            INSERT INTO public.evoluciones_clinicas (
                id_consulta, id_historia_clinica, id_paciente,
                evolucion, observaciones, id_profesional_responsable,
                estado, firmada_en
            )
            VALUES (
                p_id_consulta, v_consulta.id_historia_clinica, v_consulta.id_paciente,
                v_item->>'evolucion',
                NULLIF(v_item->>'observaciones', ''),
                v_id_profesional,
                CASE WHEN v_firmar THEN 'FIRMADA' ELSE 'BORRADOR' END,
                CASE WHEN v_firmar THEN NOW() ELSE NULL END
            );
        END LOOP;
    ELSIF v_firmar THEN
        UPDATE public.evoluciones_clinicas
           SET estado = 'FIRMADA',
               firmada_en = NOW()
         WHERE id_consulta = p_id_consulta
           AND estado = 'BORRADOR';
    END IF;

    IF p_datos ? 'tratamientos' AND jsonb_typeof(p_datos->'tratamientos') = 'array' THEN
        PERFORM public.verificar_acceso_clinico(p_usuario, v_consulta.id_paciente, p_salita, 'GESTIONAR_TRATAMIENTOS', v_fecha_atencion_d, v_id_especialidad, FALSE);
        UPDATE public.tratamientos_clinicos
           SET estado = 'ANULADO'
         WHERE id_consulta = p_id_consulta
           AND estado <> 'ANULADO';

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_datos->'tratamientos') LOOP
            INSERT INTO public.tratamientos_clinicos (
                id_consulta, id_historia_clinica, id_paciente,
                medicacion, dosis, frecuencia, duracion, indicaciones,
                fecha_inicio, fecha_fin, id_profesional_responsable
            )
            VALUES (
                p_id_consulta, v_consulta.id_historia_clinica, v_consulta.id_paciente,
                v_item->>'medicacion',
                v_item->>'dosis',
                v_item->>'frecuencia',
                NULLIF(v_item->>'duracion', ''),
                NULLIF(v_item->>'indicaciones', ''),
                COALESCE(NULLIF(v_item->>'fecha_inicio', '')::DATE, v_fecha_atencion_d),
                NULLIF(v_item->>'fecha_fin', '')::DATE,
                v_id_profesional
            );
        END LOOP;
    END IF;

    IF p_datos ? 'estudios' AND jsonb_typeof(p_datos->'estudios') = 'array' THEN
        PERFORM public.verificar_acceso_clinico(p_usuario, v_consulta.id_paciente, p_salita, 'GESTIONAR_ESTUDIOS_CLINICOS', v_fecha_atencion_d, v_id_especialidad, FALSE);
        PERFORM set_config('app.operacion_estudio_rpc', 'true', TRUE);
        UPDATE public.estudios_clinicos ec
           SET estado = 'CANCELADO'
         WHERE ec.id_consulta = p_id_consulta
           AND ec.estado = 'SOLICITADO'
           AND NOT EXISTS (
               SELECT 1
                 FROM jsonb_array_elements(p_datos->'estudios') elem
                WHERE elem->>'tipo_estudio' = ec.tipo_estudio
                  AND elem->>'descripcion' = ec.descripcion
           );
        PERFORM set_config('app.operacion_estudio_rpc', 'false', TRUE);

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_datos->'estudios') LOOP
            IF NOT EXISTS (
                SELECT 1
                  FROM public.estudios_clinicos ec
                 WHERE ec.id_consulta = p_id_consulta
                   AND ec.estado IN ('SOLICITADO', 'EN_PROCESO', 'COMPLETADO')
                   AND ec.tipo_estudio = v_item->>'tipo_estudio'
                   AND ec.descripcion = v_item->>'descripcion'
            ) THEN
                INSERT INTO public.estudios_clinicos (
                    id_consulta, id_historia_clinica, id_paciente,
                    tipo_estudio, descripcion, id_profesional_solicitante
                )
                VALUES (
                    p_id_consulta, v_consulta.id_historia_clinica, v_consulta.id_paciente,
                    v_item->>'tipo_estudio',
                    v_item->>'descripcion',
                    v_id_profesional
                );
            END IF;
        END LOOP;
    END IF;

    IF v_firmar AND v_consulta.id_turno IS NOT NULL THEN
        v_turno_sync := public._sincronizar_turno_atendido_firma(
            v_consulta.id_turno,
            v_consulta.id_paciente,
            v_id_profesional,
            v_id_especialidad,
            p_salita,
            p_usuario
        );
    END IF;

    PERFORM public.registrar_acceso_auditoria_clinica(
        p_usuario,
        v_consulta.id_paciente,
        p_salita,
        'MODIFICACION',
        'CONSULTA_MEDICA',
        p_id_consulta,
        COALESCE(
            NULLIF(trim(COALESCE(p_datos->>'motivo_acceso', '')), ''),
            CASE WHEN v_firmar THEN 'Actualización y firma definitiva de borrador' ELSE 'Actualización de borrador de consulta médica' END
        ),
        v_id_derivacion,
        v_acceso->>'alcance',
        v_fecha_atencion_d,
        p_ip
    );

    RETURN jsonb_build_object(
        'id_historia_clinica', v_consulta.id_historia_clinica,
        'id_consulta', p_id_consulta,
        'estado', CASE WHEN v_firmar THEN 'FIRMADA' ELSE 'BORRADOR' END,
        'fecha_preparacion', v_fecha_preparacion,
        'id_profesional', v_id_profesional,
        'id_turno', v_consulta.id_turno,
        'turno_actualizado', COALESCE((v_turno_sync->>'turno_actualizado')::BOOLEAN, FALSE),
        'turno_estado', NULLIF(v_turno_sync->>'turno_estado', ''),
        'via_acceso', v_acceso->>'via',
        'alcance', v_acceso->>'alcance',
        'id_derivacion', v_id_derivacion
    );
END;
$$;

-- 3.4 firmar_consulta_medica(): bloquea firma con fecha/turno futuro y sincroniza turno vinculado a ATENDIDO
--     dentro de la misma transacción PostgreSQL.
CREATE OR REPLACE FUNCTION public.firmar_consulta_medica(
    p_usuario       UUID,
    p_salita        UUID,
    p_id_consulta   UUID,
    p_paciente      UUID DEFAULT NULL,
    p_motivo_acceso TEXT DEFAULT 'Firma de consulta médica',
    p_ip            TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_consulta          public.consultas_medicas%ROWTYPE;
    v_acceso            JSONB;
    v_id_profesional    UUID;
    v_id_derivacion     UUID;
    v_fecha_acto        DATE;
    v_today             DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
    v_turno_sync        JSONB := jsonb_build_object('id_turno', NULL, 'turno_actualizado', FALSE, 'turno_estado', NULL);
BEGIN
    SELECT * INTO v_consulta
      FROM public.consultas_medicas
     WHERE id_consulta = p_id_consulta
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'La consulta médica no existe';
    END IF;

    IF p_paciente IS NOT NULL AND v_consulta.id_paciente <> p_paciente THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La consulta médica no pertenece al paciente indicado';
    END IF;

    IF v_consulta.id_salita <> p_salita THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No puede firmar una consulta médica perteneciente a otra salita';
    END IF;

    IF v_consulta.estado = 'FIRMADA' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Esta consulta médica ya fue firmada previamente y es inmutable';
    END IF;

    IF v_consulta.estado <> 'BORRADOR' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Solo puede firmarse una consulta médica en estado BORRADOR';
    END IF;

    v_fecha_acto := (v_consulta.fecha_atencion AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;

    IF v_fecha_acto > v_today OR v_consulta.fecha_atencion > (NOW() + INTERVAL '1 minute') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'No se puede firmar una consulta médica cuya fecha u hora del acto clínico es futura';
    END IF;

    IF v_consulta.id_turno IS NOT NULL AND EXISTS (
        SELECT 1
          FROM public.turnos t
         WHERE t.id_turno = v_consulta.id_turno
           AND t.fecha_hora_inicio > NOW()
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'No se puede firmar la consulta antes del horario de inicio del turno programado';
    END IF;

    -- Asegura que nunca quede habilitada la excepción de fecha futura durante una firma.
    PERFORM set_config('app.permitir_borrador_fecha_futura', 'false', TRUE);

    v_acceso := public.verificar_acceso_clinico(
        p_usuario,
        v_consulta.id_paciente,
        p_salita,
        'CREAR_CONSULTA_CLINICA',
        v_fecha_acto,
        v_consulta.id_especialidad,
        FALSE
    );
    v_id_profesional := (v_acceso->>'id_profesional')::UUID;
    v_id_derivacion := NULLIF(v_acceso->>'id_derivacion', '')::UUID;

    IF v_consulta.id_profesional_autor <> v_id_profesional THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo el profesional autor puede firmar la consulta';
    END IF;

    PERFORM set_config('app.current_user_id', p_usuario::TEXT, TRUE);
    PERFORM set_config('app.current_salita_id', p_salita::TEXT, TRUE);
    PERFORM set_config('app.client_ip', COALESCE(p_ip, ''), TRUE);
    PERFORM set_config('app.operacion_consulta_rpc', 'true', TRUE);

    UPDATE public.consultas_medicas
       SET estado = 'FIRMADA',
           firmada_en = NOW()
     WHERE id_consulta = p_id_consulta;

    UPDATE public.evoluciones_clinicas
       SET estado = 'FIRMADA',
           firmada_en = NOW()
     WHERE id_consulta = p_id_consulta
       AND estado = 'BORRADOR';

    IF v_consulta.id_turno IS NOT NULL THEN
        v_turno_sync := public._sincronizar_turno_atendido_firma(
            v_consulta.id_turno,
            v_consulta.id_paciente,
            v_id_profesional,
            v_consulta.id_especialidad,
            p_salita,
            p_usuario
        );
    END IF;

    PERFORM public.registrar_acceso_auditoria_clinica(
        p_usuario,
        v_consulta.id_paciente,
        p_salita,
        'MODIFICACION',
        'CONSULTA_MEDICA',
        p_id_consulta,
        COALESCE(NULLIF(trim(COALESCE(p_motivo_acceso, '')), ''), 'Firma definitiva de consulta médica'),
        v_id_derivacion,
        v_acceso->>'alcance',
        v_fecha_acto,
        p_ip
    );

    RETURN jsonb_build_object(
        'id_consulta', p_id_consulta,
        'estado', 'FIRMADA',
        'id_profesional', v_id_profesional,
        'id_turno', v_consulta.id_turno,
        'turno_actualizado', COALESCE((v_turno_sync->>'turno_actualizado')::BOOLEAN, FALSE),
        'turno_estado', NULLIF(v_turno_sync->>'turno_estado', '')
    );
END;
$$;

-- 3.5 anular_consulta_borrador(): permite anular también borradores anticipados vinculados a turnos futuros.
CREATE OR REPLACE FUNCTION public.anular_consulta_borrador(
    p_usuario           UUID,
    p_salita            UUID,
    p_id_consulta       UUID,
    p_motivo_anulacion  TEXT,
    p_paciente          UUID DEFAULT NULL,
    p_ip                TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_consulta          public.consultas_medicas%ROWTYPE;
    v_acceso            JSONB;
    v_id_profesional    UUID;
    v_id_derivacion     UUID;
    v_fecha_acto        DATE;
    v_today             DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
BEGIN
    IF NULLIF(trim(COALESCE(p_motivo_anulacion, '')), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Debe indicar el motivo de anulación del borrador';
    END IF;

    SELECT * INTO v_consulta
      FROM public.consultas_medicas
     WHERE id_consulta = p_id_consulta
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Consulta médica no encontrada';
    END IF;

    IF p_paciente IS NOT NULL AND v_consulta.id_paciente <> p_paciente THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La consulta médica no pertenece al paciente indicado';
    END IF;

    IF v_consulta.id_salita <> p_salita THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No puede anular una consulta perteneciente a otra salita';
    END IF;

    IF v_consulta.estado <> 'BORRADOR' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Solo pueden anularse consultas en estado BORRADOR';
    END IF;

    v_fecha_acto := (v_consulta.fecha_atencion AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;

    PERFORM set_config(
        'app.permitir_borrador_fecha_futura',
        CASE WHEN v_consulta.id_turno IS NOT NULL AND v_fecha_acto > v_today THEN 'true' ELSE 'false' END,
        TRUE
    );

    v_acceso := public.verificar_acceso_clinico(
        p_usuario,
        v_consulta.id_paciente,
        p_salita,
        'CREAR_CONSULTA_CLINICA',
        v_fecha_acto,
        v_consulta.id_especialidad,
        FALSE
    );
    v_id_profesional := (v_acceso->>'id_profesional')::UUID;
    v_id_derivacion := NULLIF(v_acceso->>'id_derivacion', '')::UUID;

    IF v_consulta.id_profesional_autor <> v_id_profesional THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo el profesional autor puede anular el borrador de la consulta';
    END IF;

    PERFORM set_config('app.current_user_id', p_usuario::TEXT, TRUE);
    PERFORM set_config('app.current_salita_id', p_salita::TEXT, TRUE);
    PERFORM set_config('app.client_ip', COALESCE(p_ip, ''), TRUE);
    PERFORM set_config('app.operacion_consulta_rpc', 'true', TRUE);

    UPDATE public.consultas_medicas
       SET estado = 'ANULADA',
           motivo_anulacion = trim(p_motivo_anulacion),
           anulada_en = NOW()
     WHERE id_consulta = p_id_consulta;

    UPDATE public.evoluciones_clinicas
       SET estado = 'ANULADA'
     WHERE id_consulta = p_id_consulta
       AND estado = 'BORRADOR';

    PERFORM public.registrar_acceso_auditoria_clinica(
        p_usuario,
        v_consulta.id_paciente,
        p_salita,
        'MODIFICACION',
        'CONSULTA_MEDICA',
        p_id_consulta,
        trim(p_motivo_anulacion),
        v_id_derivacion,
        v_acceso->>'alcance',
        v_fecha_acto,
        p_ip
    );

    RETURN jsonb_build_object('id_consulta', p_id_consulta, 'estado', 'ANULADA');
END;
$$;

/* ========================================================================== */
/* 4. PRIVILEGIOS Y AUTO-VERIFICACIÓN TRANSACCIONAL DE SEGURIDAD              */
/* ========================================================================== */

REVOKE ALL ON FUNCTION public.validar_consulta_medica() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.bloquear_firma_consulta_futura() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._sincronizar_turno_atendido_firma(UUID, UUID, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.obtener_borrador_formulario_clinico(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guardar_borrador_formulario_clinico(UUID, UUID, UUID, UUID, UUID, JSONB, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.descartar_borrador_formulario_clinico(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verificar_acceso_clinico(UUID, UUID, UUID, TEXT, DATE, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_consulta_clinica(UUID, UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.actualizar_consulta_borrador(UUID, UUID, UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.firmar_consulta_medica(UUID, UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.anular_consulta_borrador(UUID, UUID, UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.obtener_borrador_formulario_clinico(UUID, UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.guardar_borrador_formulario_clinico(UUID, UUID, UUID, UUID, UUID, JSONB, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.descartar_borrador_formulario_clinico(UUID, UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.verificar_acceso_clinico(UUID, UUID, UUID, TEXT, DATE, UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_consulta_clinica(UUID, UUID, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.actualizar_consulta_borrador(UUID, UUID, UUID, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.firmar_consulta_medica(UUID, UUID, UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.anular_consulta_borrador(UUID, UUID, UUID, TEXT, UUID, TEXT) TO service_role;

DO $$
DECLARE
    v_owner_ref OID;
    v_owner_cur OID;
    v_secdef    BOOLEAN;
    v_acl       ACLITEM[];
    v_config    TEXT[];
    v_oid       OID;
    v_role      TEXT;
    v_role_oid  OID;
    v_priv      TEXT;
    v_fn        TEXT;
    v_rpcs      TEXT[] := ARRAY[
        'obtener_borrador_formulario_clinico',
        'guardar_borrador_formulario_clinico',
        'descartar_borrador_formulario_clinico',
        'verificar_acceso_clinico',
        'registrar_consulta_clinica',
        'actualizar_consulta_borrador',
        'firmar_consulta_medica',
        'anular_consulta_borrador'
    ];
BEGIN
    SELECT c.relowner INTO v_owner_ref
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'historias_clinicas';

    SELECT c.relrowsecurity, c.relowner, COALESCE(c.relacl, acldefault('r', c.relowner))
      INTO v_secdef, v_owner_cur, v_acl
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'borradores_formulario_clinico' AND c.relkind IN ('r','p');

    IF NOT FOUND OR NOT COALESCE(v_secdef, FALSE) THEN
        RAISE EXCEPTION 'La tabla public.borradores_formulario_clinico no tiene RLS habilitado';
    END IF;
    IF v_owner_cur <> v_owner_ref THEN
        RAISE EXCEPTION 'Owner inconsistente en public.borradores_formulario_clinico';
    END IF;
    IF EXISTS (
        SELECT 1 FROM aclexplode(v_acl) a
         WHERE a.grantee = 0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
    ) THEN
        RAISE EXCEPTION 'PUBLIC conserva privilegios directos sobre public.borradores_formulario_clinico';
    END IF;

    FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
        SELECT oid INTO v_role_oid FROM pg_catalog.pg_roles WHERE rolname = v_role;
        IF v_role_oid IS NOT NULL THEN
            FOREACH v_priv IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
                IF has_table_privilege(v_role_oid, 'public.borradores_formulario_clinico', v_priv) THEN
                    RAISE EXCEPTION 'El rol % conserva % sobre public.borradores_formulario_clinico', v_role, v_priv;
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    FOREACH v_fn IN ARRAY v_rpcs LOOP
        SELECT p.oid, p.prosecdef, p.proconfig
          INTO v_oid, v_secdef, v_config
          FROM pg_catalog.pg_proc p
          JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = v_fn
         LIMIT 1;

        IF v_oid IS NULL OR NOT COALESCE(v_secdef, FALSE) OR v_config IS NULL
           OR NOT EXISTS (SELECT 1 FROM unnest(v_config) cfg WHERE cfg LIKE 'search_path=%') THEN
            RAISE EXCEPTION 'La RPC public.% no cumple SECURITY DEFINER + search_path seguro', v_fn;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = v_fn GROUP BY p.proname HAVING count(*) > 1) THEN
            RAISE EXCEPTION 'Se detectaron sobrecargas inesperadas en public.%', v_fn;
        END IF;

        FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
            SELECT oid INTO v_role_oid FROM pg_catalog.pg_roles WHERE rolname = v_role;
            IF v_role_oid IS NOT NULL AND has_function_privilege(v_role_oid, v_oid, 'EXECUTE') THEN
                RAISE EXCEPTION 'El rol % conserva EXECUTE sobre public.%', v_role, v_fn;
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

COMMIT;
