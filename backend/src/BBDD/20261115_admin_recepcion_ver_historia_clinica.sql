-- Migración incremental e idempotente:
-- 1. Asigna exclusivamente el permiso VER_HISTORIA_CLINICA a los roles ADMIN_SALITA y RECEPCION.
-- 2. Habilita a ADMIN_SALITA y RECEPCION en verificar_acceso_clinico exclusivamente para VER_HISTORIA_CLINICA.
-- 3. Habilita el registro de auditoría clínica de consultas para ADMIN_SALITA y RECEPCION en registrar_acceso_auditoria_clinica.
-- No otorga permisos de escritura clínica ni modifica RPCs de firma.

BEGIN;

/* ========================================================================== */
/* 1. ASIGNACIÓN EXCLUSIVA DE VER_HISTORIA_CLINICA A ADMIN_SALITA Y RECEPCION  */
/* ========================================================================== */

INSERT INTO public.rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
  FROM public.roles r
  JOIN public.permisos p
    ON p.codigo = 'VER_HISTORIA_CLINICA'
 WHERE r.codigo IN ('ADMIN_SALITA', 'RECEPCION')
   AND r.activo
   AND p.activo
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

/* ========================================================================== */
/* 2. VERIFICACIÓN DE ALCANCE CLÍNICO PARA CONSULTA EN SALITA VIGENTE          */
/* ========================================================================== */

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

    -- Comprobación común de permiso asignado y activo en rol_permisos
    IF NOT EXISTS (
        SELECT 1
          FROM public.rol_permisos rp
          JOIN public.permisos pe ON pe.id_permiso = rp.id_permiso
         WHERE rp.id_rol = v_cuenta.id_rol
           AND pe.codigo = p_permiso
           AND pe.activo
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El usuario no posee el permiso clínico requerido';
    END IF;

    -- =========================================================================
    -- RAMA A: PROFESIONAL (acceso asistencial completo y validación de matrícula)
    -- =========================================================================
    IF v_cuenta.rol_codigo = 'PROFESIONAL' THEN
        IF v_cuenta.id_persona IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acceso clínico restringido a profesionales con perfil vinculado';
        END IF;

        SELECT pr.id_profesional
          INTO v_id_profesional
          FROM public.profesionales pr
         WHERE pr.id_persona = v_cuenta.id_persona
           AND pr.activo;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No existe perfil profesional activo vinculado al usuario';
        END IF;

        -- Validación contra fecha de acceso actual en la salita
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

        -- Si se evalúa un acto clínico específico, valida vigencia en fecha del acto
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

        -- Validación de especialidad si fue especificada
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

        -- Vía A: paciente perteneciente a la salita desde la que accede el profesional
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

        -- Vía B: otra salita -> exige derivación o autorización explícita vigente
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

    -- =========================================================================
    -- RAMA B: ADMIN_SALITA / RECEPCION (solo lectura sobre salita vigente)
    -- =========================================================================
    ELSIF v_cuenta.rol_codigo IN ('ADMIN_SALITA', 'RECEPCION') THEN
        IF p_permiso <> 'VER_HISTORIA_CLINICA' THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acceso clínico no autorizado: el rol no posee facultades asistenciales de escritura';
        END IF;

        -- Valida asignación administrativa vigente en la salita desde la que se consulta
        IF NOT EXISTS (
            SELECT 1
              FROM public.usuario_salita us
              JOIN public.salitas s ON s.id_salita = us.id_salita
             WHERE us.id_usuario = p_usuario
               AND us.id_salita = p_salita
               AND s.activo
               AND us.activo
               AND us.fecha_desde <= v_fecha_acceso
               AND (us.fecha_hasta IS NULL OR us.fecha_hasta >= v_fecha_acceso)
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Salita fuera del alcance vigente del usuario';
        END IF;

        SELECT pa.id_salita_asignada
          INTO v_salita_paciente
          FROM public.pacientes pa
         WHERE pa.id_paciente = p_paciente
           AND pa.activo;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Paciente no encontrado o inactivo';
        END IF;

        -- Caso B.1: Paciente perteneciente a la salita del usuario
        IF v_salita_paciente = p_salita THEN
            RETURN jsonb_build_object(
                'autorizado', TRUE,
                'id_profesional', NULL,
                'id_salita_paciente', v_salita_paciente,
                'via', 'SALITA_ASIGNADA',
                'alcance', 'SALITA_ASIGNADA',
                'id_derivacion', NULL,
                'id_especialidad_autorizada', NULL,
                'fecha_acceso', v_fecha_acceso,
                'fecha_desde_autorizada', NULL,
                'fecha_hasta_autorizada', NULL
            );
        END IF;

        -- Caso B.2: Paciente de otra salita con derivación o autorización activa hacia esta salita
        SELECT d.id_derivacion, d.alcance, d.fecha_desde, d.fecha_hasta
          INTO v_derivacion
          FROM public.derivaciones_autorizaciones_clinicas d
         WHERE d.id_paciente = p_paciente
           AND d.id_salita_origen = v_salita_paciente
           AND d.id_salita_destino = p_salita
           AND d.estado = 'AUTORIZADA'
           AND d.fecha_desde <= v_fecha_acceso
           AND d.fecha_hasta >= v_fecha_acceso
         ORDER BY CASE d.alcance WHEN 'LONGITUDINAL' THEN 1 ELSE 2 END,
                  d.fecha_resolucion DESC NULLS LAST
         LIMIT 1;

        IF v_derivacion.id_derivacion IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Sin autorización o derivación vigente compatible con la salita requerida';
        END IF;

        RETURN jsonb_build_object(
            'autorizado', TRUE,
            'id_profesional', NULL,
            'id_salita_paciente', v_salita_paciente,
            'via', 'DERIVACION_AUTORIZADA',
            'alcance', v_derivacion.alcance,
            'id_derivacion', v_derivacion.id_derivacion,
            'id_especialidad_autorizada', NULL,
            'fecha_acceso', v_fecha_acceso,
            'fecha_desde_autorizada', v_derivacion.fecha_desde,
            'fecha_hasta_autorizada', v_derivacion.fecha_hasta
        );

    ELSE
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Rol no autorizado para consultar historia clínica';
    END IF;
END;
$$;

/* ========================================================================== */
/* 3. AUDITORÍA CLÍNICA: PERMITIR EVENTOS DE LECTURA DE ADMIN Y RECEPCIÓN     */
/* ========================================================================== */

CREATE OR REPLACE FUNCTION public.registrar_acceso_auditoria_clinica(
    p_usuario           UUID,
    p_paciente          UUID,
    p_salita            UUID,
    p_tipo_operacion    TEXT,
    p_recurso           TEXT,
    p_id_recurso        UUID,
    p_motivo_acceso     TEXT,
    p_id_derivacion     UUID DEFAULT NULL,
    p_alcance_acceso    TEXT DEFAULT NULL,
    p_fecha_acto        DATE DEFAULT NULL,
    p_ip                TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_rol               TEXT;
    v_id_persona        UUID;
    v_id_profesional    UUID;
    v_salita_paciente   UUID;
    v_id_hc             UUID;
    v_id_auditoria      BIGINT;
    v_recurso           TEXT;
    v_today             DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
BEGIN
    IF p_usuario IS NULL OR p_paciente IS NULL OR p_salita IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Usuario, paciente y salita son obligatorios para auditoría clínica';
    END IF;

    IF p_alcance_acceso IS NULL
       OR p_alcance_acceso NOT IN ('SALITA_ASIGNADA', 'PROFESIONAL', 'ESPECIALIDAD', 'LONGITUDINAL', 'ADMINISTRATIVO') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Alcance de acceso inválido o faltante en auditoría clínica';
    END IF;

    IF p_fecha_acto IS NOT NULL AND p_fecha_acto > v_today THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La fecha del acto clínico en auditoría no puede ser futura';
    END IF;

    IF p_tipo_operacion NOT IN ('CONSULTA', 'CREACION', 'MODIFICACION', 'CORRECCION', 'EXPORTACION') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Tipo de operación inválido en auditoría clínica';
    END IF;

    IF NULLIF(trim(COALESCE(p_motivo_acceso, '')), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El motivo de acceso es obligatorio para auditoría clínica';
    END IF;

    v_recurso := COALESCE(NULLIF(trim(p_recurso), ''), 'HISTORIA_CLINICA');
    IF v_recurso NOT IN ('HISTORIA_CLINICA', 'CONSULTA_MEDICA', 'EVOLUCION_CLINICA', 'ESTUDIO_CLINICO', 'DERIVACION_CLINICA') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Tipo de recurso clínico inválido en auditoría';
    END IF;

    SELECT r.codigo, u.id_persona
      INTO v_rol, v_id_persona
      FROM public.usuarios u
      JOIN public.roles r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = p_usuario
       AND u.activo
       AND r.activo;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Usuario inexistente o inactivo en auditoría clínica';
    END IF;

    SELECT p.id_salita_asignada
      INTO v_salita_paciente
      FROM public.pacientes p
     WHERE p.id_paciente = p_paciente
       AND p.activo;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Paciente inexistente o inactivo en auditoría clínica';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.salitas s WHERE s.id_salita = p_salita AND s.activo) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Salita inexistente o inactiva en auditoría clínica';
    END IF;

    IF v_rol = 'PROFESIONAL' THEN
        SELECT pr.id_profesional INTO v_id_profesional
          FROM public.profesionales pr
         WHERE pr.id_persona = v_id_persona
           AND pr.activo;

        IF v_id_profesional IS NULL OR NOT EXISTS (
            SELECT 1 FROM public.profesional_salita ps
             WHERE ps.id_profesional = v_id_profesional
               AND ps.id_salita = p_salita
               AND ps.activo
               AND ps.fecha_desde <= v_today
               AND (ps.fecha_hasta IS NULL OR ps.fecha_hasta >= v_today)
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El profesional no posee relación vigente con la salita auditada';
        END IF;

    ELSIF v_rol IN ('ADMIN_SALITA', 'RECEPCION') THEN
        -- Solo admiten auditoría de lectura (CONSULTA o EXPORTACION) sobre historia/consulta médica,
        -- o resolución administrativa de derivaciones (solo ADMIN_SALITA).
        IF p_tipo_operacion IN ('CONSULTA', 'EXPORTACION') AND v_recurso IN ('HISTORIA_CLINICA', 'CONSULTA_MEDICA') THEN
            NULL;
        ELSIF v_rol = 'ADMIN_SALITA' AND v_recurso = 'DERIVACION_CLINICA' AND p_tipo_operacion = 'MODIFICACION' THEN
            NULL;
        ELSE
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Operación no permitida para el rol en auditoría clínica';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.usuario_salita us
             WHERE us.id_usuario = p_usuario
               AND us.id_salita = p_salita
               AND us.activo
               AND us.fecha_desde <= v_today
               AND (us.fecha_hasta IS NULL OR us.fecha_hasta >= v_today)
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El usuario no posee relación vigente con la salita auditada';
        END IF;

    ELSIF v_rol = 'SUPER_ADMIN' THEN
        IF v_recurso <> 'DERIVACION_CLINICA' OR p_tipo_operacion <> 'MODIFICACION' THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Super Admin no posee acceso clínico directo para esta operación';
        END IF;
    ELSE
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Rol sin habilitación para generar eventos de auditoría clínica';
    END IF;

    -- Coherencia estricta entre alcance auditado, salita del paciente, derivación y recurso
    IF p_alcance_acceso = 'SALITA_ASIGNADA' THEN
        IF v_salita_paciente IS DISTINCT FROM p_salita OR p_id_derivacion IS NOT NULL THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El alcance SALITA_ASIGNADA exige coincidencia con la salita del paciente y sin derivación';
        END IF;
    ELSIF p_alcance_acceso IN ('PROFESIONAL', 'ESPECIALIDAD', 'LONGITUDINAL') THEN
        IF p_id_derivacion IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Los alcances derivados exigen el identificador de derivación/autorización clínica';
        END IF;
    ELSIF p_alcance_acceso = 'ADMINISTRATIVO' THEN
        IF v_recurso <> 'DERIVACION_CLINICA' THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El alcance ADMINISTRATIVO solo corresponde a derivaciones clínicas';
        END IF;
    END IF;

    SELECT h.id_historia_clinica INTO v_id_hc
      FROM public.historias_clinicas h
     WHERE h.id_paciente = p_paciente;

    INSERT INTO public.auditoria_clinica (
        id_usuario,
        id_profesional,
        id_paciente,
        id_historia_clinica,
        id_salita,
        tipo_operacion,
        recurso,
        id_recurso,
        alcance_acceso,
        fecha_acto_clinico,
        motivo_acceso,
        id_derivacion,
        ip_origen
    )
    VALUES (
        p_usuario,
        v_id_profesional,
        p_paciente,
        v_id_hc,
        p_salita,
        p_tipo_operacion,
        v_recurso,
        p_id_recurso,
        p_alcance_acceso,
        p_fecha_acto,
        trim(p_motivo_acceso),
        p_id_derivacion,
        NULLIF(trim(COALESCE(p_ip, '')), '')::INET
    )
    RETURNING id_auditoria_clinica INTO v_id_auditoria;

    RETURN v_id_auditoria;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_acceso_auditoria_clinica(UUID, UUID, UUID, TEXT, TEXT, UUID, TEXT, UUID, TEXT, DATE, TEXT) FROM PUBLIC, anon, authenticated, service_role;

-- Reconfirmación de privilegios de ejecución para las RPCs del backend
REVOKE ALL ON FUNCTION public.verificar_acceso_clinico(UUID, UUID, UUID, TEXT, DATE, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consultar_historia_clinica(UUID, UUID, UUID, UUID, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.verificar_acceso_clinico(UUID, UUID, UUID, TEXT, DATE, UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.consultar_historia_clinica(UUID, UUID, UUID, UUID, TEXT, BOOLEAN, TEXT) TO service_role;

COMMIT;
