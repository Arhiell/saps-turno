-- Hotfix: Corrección de nombres de columnas de auditoria_clinica en registrar_acceso_auditoria_clinica
-- Corrige error 42703 (column id_derivacion_autorizacion does not exist) al consultar historia clínica.

BEGIN;

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

REVOKE ALL ON FUNCTION public.registrar_acceso_auditoria_clinica(UUID, UUID, UUID, TEXT, TEXT, UUID, TEXT, UUID, TEXT, DATE, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_acceso_auditoria_clinica(UUID, UUID, UUID, TEXT, TEXT, UUID, TEXT, UUID, TEXT, DATE, TEXT) TO service_role;

-- Reconfirmación explícita e idempotente de permisos para las RPCs públicas invocadas por el backend:
-- 1. Se revocan de roles públicos y de clientes frontend directos
REVOKE ALL ON FUNCTION public.verificar_acceso_clinico(UUID, UUID, UUID, TEXT, DATE, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consultar_historia_clinica(UUID, UUID, UUID, UUID, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;

-- 2. Se asegura permiso de ejecución exclusivo al rol service_role (usado por el backend con SUPABASE_SECRET_KEY)
GRANT EXECUTE ON FUNCTION public.verificar_acceso_clinico(UUID, UUID, UUID, TEXT, DATE, UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.consultar_historia_clinica(UUID, UUID, UUID, UUID, TEXT, BOOLEAN, TEXT) TO service_role;

COMMIT;
