BEGIN;

-- Solicitudes explícitas de vinculación. Las relaciones existentes no se alteran.
ALTER TABLE public.paciente_tutores
    ADD COLUMN IF NOT EXISTS id_usuario_creo UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS id_usuario_modifico UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS fecha_modificacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS identidad_verificada BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS documentacion_verificada BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS autorizacion_verificada BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.paciente_tutores_historial (
    id_historial BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_paciente UUID NOT NULL,
    id_tutor UUID NOT NULL,
    id_usuario UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    accion VARCHAR(10) NOT NULL,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_paciente_tutores_historial_accion CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE'))
);
CREATE INDEX IF NOT EXISTS ix_paciente_tutores_historial_relacion
    ON public.paciente_tutores_historial (id_paciente, id_tutor, fecha DESC);

CREATE OR REPLACE FUNCTION public.registrar_historial_paciente_tutores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_anterior JSONB;
    v_nuevo JSONB;
    v_paciente UUID;
    v_tutor UUID;
    v_usuario UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_anterior := to_jsonb(OLD);
        v_paciente := OLD.id_paciente;
        v_tutor := OLD.id_tutor;
        v_usuario := OLD.id_usuario_modifico;
    ELSE
        v_nuevo := to_jsonb(NEW);
        v_paciente := NEW.id_paciente;
        v_tutor := NEW.id_tutor;
        v_usuario := NEW.id_usuario_modifico;
        IF TG_OP = 'UPDATE' THEN v_anterior := to_jsonb(OLD); END IF;
    END IF;

    INSERT INTO public.paciente_tutores_historial
        (id_paciente, id_tutor, id_usuario, accion, datos_anteriores, datos_nuevos)
    VALUES (v_paciente, v_tutor, v_usuario, TG_OP, v_anterior, v_nuevo);

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_paciente_tutores_historial ON public.paciente_tutores;
CREATE TRIGGER tr_paciente_tutores_historial
AFTER INSERT OR UPDATE OR DELETE ON public.paciente_tutores
FOR EACH ROW EXECUTE FUNCTION public.registrar_historial_paciente_tutores();

CREATE TABLE IF NOT EXISTS public.solicitudes_vinculacion (
    id_solicitud UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario_solicitante UUID NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE RESTRICT,
    id_paciente_solicitante UUID NOT NULL REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    id_salita_contexto UUID NOT NULL REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    direccion VARCHAR(30) NOT NULL,
    dni_persona_destino VARCHAR(15) NOT NULL,
    parentesco VARCHAR(50) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    motivo_rechazo TEXT,
    id_usuario_resolvio UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    id_paciente_destino UUID REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    id_tutor_destino UUID REFERENCES public.tutores(id_tutor) ON DELETE RESTRICT,
    identidad_verificada BOOLEAN NOT NULL DEFAULT FALSE,
    documentacion_verificada BOOLEAN NOT NULL DEFAULT FALSE,
    autorizacion_verificada BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_resolucion TIMESTAMPTZ,
    CONSTRAINT ck_solicitud_vinculacion_direccion
        CHECK (direccion IN ('GESTIONAR_A_OTRO', 'DELEGAR_MI_GESTION')),
    CONSTRAINT ck_solicitud_vinculacion_dni
        CHECK (dni_persona_destino ~ '^[0-9]{7,15}$'),
    CONSTRAINT ck_solicitud_vinculacion_parentesco
        CHECK (char_length(trim(parentesco)) BETWEEN 1 AND 50),
    CONSTRAINT ck_solicitud_vinculacion_estado
        CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')),
    CONSTRAINT ck_solicitud_vinculacion_resolucion
        CHECK (
            (estado = 'PENDIENTE' AND fecha_resolucion IS NULL AND id_usuario_resolvio IS NULL)
            OR (estado <> 'PENDIENTE' AND fecha_resolucion IS NOT NULL AND id_usuario_resolvio IS NOT NULL)
        ),
    CONSTRAINT ck_solicitud_vinculacion_rechazo
        CHECK ((estado = 'RECHAZADA' AND NULLIF(trim(motivo_rechazo), '') IS NOT NULL)
            OR (estado <> 'RECHAZADA' AND motivo_rechazo IS NULL)),
    CONSTRAINT ck_solicitud_vinculacion_aprobada
        CHECK ((estado = 'APROBADA' AND id_paciente_destino IS NOT NULL AND id_tutor_destino IS NOT NULL)
            OR (estado <> 'APROBADA' AND id_paciente_destino IS NULL AND id_tutor_destino IS NULL))
);
ALTER TABLE public.solicitudes_vinculacion
    ADD COLUMN IF NOT EXISTS identidad_verificada BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS documentacion_verificada BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS autorizacion_verificada BOOLEAN NOT NULL DEFAULT FALSE;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'ck_solicitud_vinculacion_verificaciones'
           AND conrelid = 'public.solicitudes_vinculacion'::regclass
    ) THEN
        ALTER TABLE public.solicitudes_vinculacion
            ADD CONSTRAINT ck_solicitud_vinculacion_verificaciones
            CHECK (estado <> 'APROBADA' OR (
                identidad_verificada AND documentacion_verificada AND autorizacion_verificada
            ));
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS ix_solicitudes_vinculacion_salita_estado
    ON public.solicitudes_vinculacion (id_salita_contexto, estado, fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS ix_solicitudes_vinculacion_usuario
    ON public.solicitudes_vinculacion (id_usuario_solicitante, fecha_creacion DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitud_vinculacion_pendiente
    ON public.solicitudes_vinculacion (id_usuario_solicitante, direccion, dni_persona_destino)
    WHERE estado = 'PENDIENTE';

-- Una autorización no puede crear ciclos entre perfiles de pacientes.
CREATE OR REPLACE FUNCTION public.evitar_ciclos_paciente_tutores()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tutor_persona UUID;
    v_tutor_paciente UUID;
    v_today DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
BEGIN
    IF NOT NEW.puede_gestionar_turnos OR
       (NEW.fecha_hasta IS NOT NULL AND NEW.fecha_hasta < v_today) THEN
        RETURN NEW;
    END IF;

    SELECT t.id_persona INTO v_tutor_persona
      FROM public.tutores t
     WHERE t.id_tutor = NEW.id_tutor;

    SELECT p.id_paciente INTO v_tutor_paciente
      FROM public.pacientes p
     WHERE p.id_persona = v_tutor_persona
       AND p.activo;

    IF v_tutor_paciente IS NULL THEN
        RETURN NEW;
    END IF;

    IF v_tutor_paciente = NEW.id_paciente THEN
        RAISE EXCEPTION 'Una persona no puede gestionar sus propios turnos mediante una vinculación';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM public.tutores tutor
          JOIN public.personas persona ON persona.id_persona = tutor.id_persona AND persona.activo
          JOIN public.pacientes paciente ON paciente.id_persona = persona.id_persona AND paciente.activo
          JOIN public.usuarios usuario ON usuario.id_persona = persona.id_persona AND usuario.activo
          JOIN public.roles rol ON rol.id_rol = usuario.id_rol AND rol.codigo = 'PACIENTE' AND rol.activo
         WHERE tutor.id_tutor = NEW.id_tutor
           AND tutor.activo
           AND persona.fecha_nacimiento IS NOT NULL
           AND persona.fecha_nacimiento <= v_today - INTERVAL '18 years'
           AND NULLIF(BTRIM(persona.telefono), '') IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'El responsable debe ser adulto, tener una cuenta de paciente activa y un teléfono registrado';
    END IF;

    IF EXISTS (
        WITH RECURSIVE dependientes(id_paciente) AS (
            SELECT NEW.id_paciente
            UNION
            SELECT pt.id_paciente
              FROM dependientes d
              JOIN public.pacientes padre ON padre.id_paciente = d.id_paciente
              JOIN public.tutores tutor ON tutor.id_persona = padre.id_persona AND tutor.activo
              JOIN public.paciente_tutores pt ON pt.id_tutor = tutor.id_tutor
             WHERE pt.puede_gestionar_turnos
               AND (pt.fecha_hasta IS NULL OR pt.fecha_hasta >= v_today)
        )
        SELECT 1 FROM dependientes WHERE id_paciente = v_tutor_paciente
    ) THEN
        RAISE EXCEPTION 'La vinculación generaría una relación circular';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_paciente_tutores_evitar_ciclos ON public.paciente_tutores;
CREATE TRIGGER tr_paciente_tutores_evitar_ciclos
BEFORE INSERT OR UPDATE OF id_paciente, id_tutor, puede_gestionar_turnos, fecha_hasta
ON public.paciente_tutores
FOR EACH ROW EXECUTE FUNCTION public.evitar_ciclos_paciente_tutores();

CREATE OR REPLACE FUNCTION public.aprobar_solicitud_vinculacion(
    p_id_solicitud UUID,
    p_id_usuario_admin UUID,
    p_identidad_verificada BOOLEAN,
    p_documentacion_verificada BOOLEAN,
    p_autorizacion_verificada BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_solicitud public.solicitudes_vinculacion%ROWTYPE;
    v_admin_rol TEXT;
    v_persona_tutor UUID;
    v_paciente_destino UUID;
    v_salita_paciente UUID;
    v_tutor_destino UUID;
    v_relacion public.paciente_tutores%ROWTYPE;
    v_today DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
BEGIN
    IF p_identidad_verificada IS DISTINCT FROM TRUE
       OR p_documentacion_verificada IS DISTINCT FROM TRUE
       OR p_autorizacion_verificada IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Debe verificar la identidad, documentación y autorización presencialmente';
    END IF;

    SELECT * INTO v_solicitud
      FROM public.solicitudes_vinculacion
     WHERE id_solicitud = p_id_solicitud
     FOR UPDATE;

    IF NOT FOUND OR v_solicitud.estado <> 'PENDIENTE' THEN
        RAISE EXCEPTION 'La solicitud no existe o ya fue resuelta';
    END IF;

    SELECT r.codigo INTO v_admin_rol
      FROM public.usuarios u
      JOIN public.roles r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = p_id_usuario_admin
       AND u.activo
       AND r.activo;

    IF v_admin_rol IS NULL OR v_admin_rol NOT IN ('SUPER_ADMIN', 'ADMIN_SALITA') THEN
        RAISE EXCEPTION 'El usuario no puede aprobar solicitudes de vinculación';
    END IF;

    IF v_admin_rol = 'ADMIN_SALITA' AND NOT EXISTS (
        SELECT 1 FROM public.usuario_salita us
         WHERE us.id_usuario = p_id_usuario_admin
           AND us.id_salita = v_solicitud.id_salita_contexto
           AND us.activo
           AND us.fecha_desde <= v_today
           AND (us.fecha_hasta IS NULL OR us.fecha_hasta >= v_today)
    ) THEN
        RAISE EXCEPTION 'La solicitud no pertenece a una salita autorizada';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM public.usuarios usuario
          JOIN public.roles rol ON rol.id_rol = usuario.id_rol AND rol.codigo = 'PACIENTE' AND rol.activo
          JOIN public.pacientes paciente ON paciente.id_persona = usuario.id_persona AND paciente.activo
         WHERE usuario.id_usuario = v_solicitud.id_usuario_solicitante
           AND usuario.activo
           AND paciente.id_paciente = v_solicitud.id_paciente_solicitante
    ) THEN
        RAISE EXCEPTION 'La cuenta que inició la solicitud ya no está activa o no corresponde al paciente';
    END IF;

    IF v_solicitud.direccion = 'GESTIONAR_A_OTRO' THEN
        IF NOT EXISTS (
            SELECT 1
              FROM public.pacientes pa
              JOIN public.personas pe ON pe.id_persona = pa.id_persona
             WHERE pa.id_paciente = v_solicitud.id_paciente_solicitante
               AND pe.fecha_nacimiento IS NOT NULL
               AND pe.fecha_nacimiento <= v_today - INTERVAL '18 years'
        ) THEN
            RAISE EXCEPTION 'Solo una persona adulta puede solicitar gestionar los turnos de otra persona';
        END IF;

        SELECT pe.id_persona INTO v_persona_tutor
          FROM public.pacientes p
          JOIN public.personas pe ON pe.id_persona = p.id_persona AND pe.activo
         WHERE p.id_paciente = v_solicitud.id_paciente_solicitante
           AND p.activo;

        SELECT pa.id_paciente, pa.id_salita_asignada
          INTO v_paciente_destino, v_salita_paciente
          FROM public.pacientes pa
          JOIN public.personas pe ON pe.id_persona = pa.id_persona
         WHERE pe.dni = v_solicitud.dni_persona_destino
           AND pa.activo
           AND pe.activo;
        IF v_paciente_destino IS NOT NULL AND v_salita_paciente <> v_solicitud.id_salita_contexto THEN
            RAISE EXCEPTION 'El paciente pertenece a otra salita; la solicitud debe revisarse en su salita actual';
        END IF;
    ELSE
        SELECT pa.id_paciente, pa.id_salita_asignada
          INTO v_paciente_destino, v_salita_paciente
          FROM public.pacientes pa
         WHERE pa.id_paciente = v_solicitud.id_paciente_solicitante
           AND pa.activo;
        IF v_paciente_destino IS NOT NULL AND v_salita_paciente <> v_solicitud.id_salita_contexto THEN
            RAISE EXCEPTION 'El paciente pertenece a otra salita; la solicitud debe revisarse en su salita actual';
        END IF;
        IF NOT EXISTS (
            SELECT 1
              FROM public.pacientes pa
              JOIN public.personas pe ON pe.id_persona = pa.id_persona
             WHERE pa.id_paciente = v_paciente_destino
               AND pe.fecha_nacimiento IS NOT NULL
               AND pe.fecha_nacimiento <= v_today - INTERVAL '18 years'
        ) THEN
            RAISE EXCEPTION 'Solo una persona adulta puede delegar la gestión de sus turnos';
        END IF;

        SELECT pe.id_persona INTO v_persona_tutor
          FROM public.personas pe
          JOIN public.pacientes pa ON pa.id_persona = pe.id_persona AND pa.activo
          JOIN public.usuarios u ON u.id_persona = pe.id_persona AND u.activo
          JOIN public.roles r ON r.id_rol = u.id_rol AND r.codigo = 'PACIENTE' AND r.activo
         WHERE pe.dni = v_solicitud.dni_persona_destino
           AND pe.activo
           AND pe.fecha_nacimiento IS NOT NULL
           AND pe.fecha_nacimiento <= v_today - INTERVAL '18 years'
           AND NULLIF(BTRIM(pe.telefono), '') IS NOT NULL;
    END IF;

    IF v_paciente_destino IS NULL OR v_persona_tutor IS NULL THEN
        RAISE EXCEPTION 'No se encontró un paciente y responsable activos con cuenta propia';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM public.pacientes pa
          JOIN public.usuarios u ON u.id_persona = pa.id_persona AND u.activo
          JOIN public.roles r ON r.id_rol = u.id_rol AND r.codigo = 'PACIENTE' AND r.activo
         WHERE pa.id_persona = v_persona_tutor
           AND pa.activo
    ) = FALSE THEN
        RAISE EXCEPTION 'El responsable debe tener una cuenta de paciente activa';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.pacientes
         WHERE id_paciente = v_paciente_destino
           AND id_persona = v_persona_tutor
    ) THEN
        RAISE EXCEPTION 'Una persona no puede autorizarse a sí misma';
    END IF;

    PERFORM set_config('app.current_user_id', p_id_usuario_admin::TEXT, TRUE);
    PERFORM set_config('app.current_salita_id', v_solicitud.id_salita_contexto::TEXT, TRUE);

    INSERT INTO public.tutores (id_persona, activo)
    VALUES (v_persona_tutor, TRUE)
    ON CONFLICT (id_persona) DO UPDATE SET activo = TRUE
    RETURNING id_tutor INTO v_tutor_destino;

    SELECT * INTO v_relacion
      FROM public.paciente_tutores
     WHERE id_paciente = v_paciente_destino
       AND id_tutor = v_tutor_destino;

    IF FOUND AND v_relacion.puede_gestionar_turnos
       AND (v_relacion.fecha_hasta IS NULL OR v_relacion.fecha_hasta >= v_today) THEN
        RAISE EXCEPTION 'Ya existe una autorización vigente para esta persona';
    END IF;

    INSERT INTO public.paciente_tutores (
        id_paciente, id_tutor, parentesco, es_principal, puede_gestionar_turnos,
        fecha_desde, fecha_hasta, id_usuario_creo, id_usuario_modifico, fecha_modificacion,
        identidad_verificada, documentacion_verificada, autorizacion_verificada
    )
    VALUES (
        v_paciente_destino, v_tutor_destino, v_solicitud.parentesco, FALSE, TRUE,
        v_today, NULL, p_id_usuario_admin, p_id_usuario_admin, NOW(),
        TRUE, TRUE, TRUE
    )
    ON CONFLICT (id_paciente, id_tutor) DO UPDATE
       SET parentesco = EXCLUDED.parentesco,
           puede_gestionar_turnos = TRUE,
           fecha_desde = v_today,
           fecha_hasta = NULL,
           id_usuario_modifico = p_id_usuario_admin,
           fecha_modificacion = NOW(),
           identidad_verificada = TRUE,
           documentacion_verificada = TRUE,
           autorizacion_verificada = TRUE;

    UPDATE public.solicitudes_vinculacion
       SET estado = 'APROBADA',
           id_usuario_resolvio = p_id_usuario_admin,
           id_paciente_destino = v_paciente_destino,
           id_tutor_destino = v_tutor_destino,
           identidad_verificada = p_identidad_verificada,
           documentacion_verificada = p_documentacion_verificada,
           autorizacion_verificada = p_autorizacion_verificada,
           fecha_resolucion = NOW()
     WHERE id_solicitud = p_id_solicitud;

    RETURN jsonb_build_object(
        'id_solicitud', p_id_solicitud,
        'estado', 'APROBADA',
        'id_paciente', v_paciente_destino,
        'id_tutor', v_tutor_destino
    );
END;
$$;

REVOKE ALL ON FUNCTION public.aprobar_solicitud_vinculacion(UUID, UUID, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aprobar_solicitud_vinculacion(UUID, UUID, BOOLEAN, BOOLEAN, BOOLEAN) TO service_role;

DROP TRIGGER IF EXISTS tr_auditar_solicitudes_vinculacion ON public.solicitudes_vinculacion;
CREATE TRIGGER tr_auditar_solicitudes_vinculacion
AFTER INSERT OR UPDATE OR DELETE ON public.solicitudes_vinculacion
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_solicitud');

ALTER TABLE public.solicitudes_vinculacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paciente_tutores_historial ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.solicitudes_vinculacion, public.paciente_tutores_historial FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.solicitudes_vinculacion, public.paciente_tutores_historial TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.paciente_tutores_historial_id_historial_seq TO service_role;

COMMIT;
