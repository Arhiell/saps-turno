/*
===============================================================================
 SAPS TURNO - BASE DE DATOS COMPLETA V3
 PostgreSQL / Supabase

 Refactorizacion principal:
 - PERSONAS centraliza la identidad y datos personales.
 - USUARIOS representa exclusivamente la cuenta de acceso.
 - PACIENTES, TUTORES y PROFESIONALES referencian PERSONAS.
 - Se incluyen tokens de verificacion de email e identidades externas (Google).
 - Supabase se utiliza solo para alojar PostgreSQL.
 - La autenticacion, JWT, permisos y reglas de negocio se gestionan en la API.

 IMPORTANTE:
 Este script es de REINICIO COMPLETO para el entorno de desarrollo.
 Elimina las tablas del proyecto SAPS Turno y TODOS sus datos antes de recrearlas.

 Ejecucion:
 Supabase > SQL Editor > New query > pegar este archivo completo > Run.
===============================================================================
*/

BEGIN;

-- ============================================================================
-- 0. REINICIO CONTROLADO DEL MODELO SAPS TURNO
-- ============================================================================
-- Se eliminan solamente objetos del proyecto dentro de public.
-- No se elimina el schema public ni los schemas internos de Supabase.

DROP VIEW IF EXISTS public.vw_agenda_turnos CASCADE;
DROP VIEW IF EXISTS public.vw_resumen_turnos_diarios CASCADE;

DROP TABLE IF EXISTS public.auditoria CASCADE;
DROP TABLE IF EXISTS public.configuracion CASCADE;
DROP TABLE IF EXISTS public.notificaciones CASCADE;
DROP TABLE IF EXISTS public.sanciones CASCADE;
DROP TABLE IF EXISTS public.historial_turnos CASCADE;
DROP TABLE IF EXISTS public.turnos CASCADE;
DROP TABLE IF EXISTS public.estados_turno CASCADE;
DROP TABLE IF EXISTS public.bloqueos_agenda CASCADE;
DROP TABLE IF EXISTS public.horarios_atencion CASCADE;
DROP TABLE IF EXISTS public.profesional_salita CASCADE;
DROP TABLE IF EXISTS public.profesional_especialidad CASCADE;
DROP TABLE IF EXISTS public.profesionales CASCADE;
DROP TABLE IF EXISTS public.especialidades CASCADE;
DROP TABLE IF EXISTS public.paciente_tutores CASCADE;
DROP TABLE IF EXISTS public.tutores CASCADE;
DROP TABLE IF EXISTS public.pacientes CASCADE;
DROP TABLE IF EXISTS public.usuario_salita CASCADE;
DROP TABLE IF EXISTS public.salita_barrios CASCADE;
DROP TABLE IF EXISTS public.salitas CASCADE;
DROP TABLE IF EXISTS public.barrios CASCADE;
DROP TABLE IF EXISTS public.zonas CASCADE;
DROP TABLE IF EXISTS public.usuario_identidades CASCADE;
DROP TABLE IF EXISTS public.tokens_verificacion_email CASCADE;
DROP TABLE IF EXISTS public.tokens_recuperacion CASCADE;
DROP TABLE IF EXISTS public.sesiones_refresh CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;
DROP TABLE IF EXISTS public.personas CASCADE;
DROP TABLE IF EXISTS public.rol_permisos CASCADE;
DROP TABLE IF EXISTS public.permisos CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;


-- UUID seguros y restricciones de rangos para evitar turnos superpuestos.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Mantiene fecha_actualizacion al modificar un registro.
CREATE OR REPLACE FUNCTION public.actualizar_fecha_modificacion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.fecha_actualizacion := NOW();
    RETURN NEW;
END;
$$;

/* ========================================================================== */
/* 1. SEGURIDAD Y AUTENTICACION PROPIA                                       */
/* ========================================================================== */

-- Roles generales de acceso al sistema.
CREATE TABLE public.roles (
    id_rol              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo              VARCHAR(50) NOT NULL UNIQUE,
    nombre              VARCHAR(100) NOT NULL UNIQUE,
    descripcion         TEXT,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_roles_codigo CHECK (codigo ~ '^[A-Z][A-Z0-9_]*$')
);

-- Acciones que pueden asignarse a los roles.
CREATE TABLE public.permisos (
    id_permiso          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo              VARCHAR(80) NOT NULL UNIQUE,
    nombre              VARCHAR(120) NOT NULL,
    descripcion         TEXT,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_permisos_codigo CHECK (codigo ~ '^[A-Z][A-Z0-9_]*$')
);

-- Relacion muchos a muchos entre roles y permisos.
CREATE TABLE public.rol_permisos (
    id_rol              UUID NOT NULL REFERENCES public.roles(id_rol) ON DELETE CASCADE,
    id_permiso          UUID NOT NULL REFERENCES public.permisos(id_permiso) ON DELETE CASCADE,
    fecha_asignacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id_rol, id_permiso)
);

-- Identidad real y datos personales reutilizables por distintos perfiles.
CREATE TABLE public.personas (
    id_persona          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dni                 VARCHAR(15) NOT NULL UNIQUE,
    nombres             VARCHAR(100) NOT NULL,
    apellidos           VARCHAR(100) NOT NULL,
    fecha_nacimiento    DATE,
    sexo                VARCHAR(20),
    telefono            VARCHAR(30),
    email               VARCHAR(254),
    direccion           VARCHAR(250),
    localidad           VARCHAR(120) NOT NULL DEFAULT 'Goya',
    provincia           VARCHAR(120) NOT NULL DEFAULT 'Corrientes',
    codigo_postal       VARCHAR(12),
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_persona_dni CHECK (dni ~ '^[0-9]{7,15}$'),
    CONSTRAINT ck_persona_nacimiento CHECK (
        fecha_nacimiento IS NULL OR fecha_nacimiento <= CURRENT_DATE
    ),
    CONSTRAINT ck_persona_sexo CHECK (
        sexo IS NULL OR sexo IN ('FEMENINO','MASCULINO','X','NO_INFORMA')
    ),
    CONSTRAINT ck_persona_email CHECK (
        email IS NULL OR position('@' IN email) > 1
    )
);

CREATE INDEX ix_personas_nombre
    ON public.personas (lower(apellidos), lower(nombres));
CREATE INDEX ix_personas_activo
    ON public.personas (activo);
-- Un correo puede estar en la cuenta y su persona, pero no en dos personas.
CREATE UNIQUE INDEX uq_personas_email_lower ON public.personas (lower(email));

-- Cuentas propias de la aplicacion; no depende de auth.users de Supabase.
CREATE TABLE public.usuarios (
    id_usuario          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_persona          UUID UNIQUE REFERENCES public.personas(id_persona) ON DELETE SET NULL,
    id_rol              UUID NOT NULL REFERENCES public.roles(id_rol) ON DELETE RESTRICT,
    nombre_usuario      VARCHAR(60) NOT NULL,
    email               VARCHAR(254) NOT NULL,
    password_hash       TEXT,
    email_verificado    BOOLEAN NOT NULL DEFAULT FALSE,
    intentos_fallidos   SMALLINT NOT NULL DEFAULT 0,
    bloqueado_hasta     TIMESTAMPTZ,
    ultimo_acceso       TIMESTAMPTZ,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_usuario_nombre CHECK (char_length(trim(nombre_usuario)) BETWEEN 3 AND 60),
    CONSTRAINT ck_usuario_email CHECK (position('@' IN email) > 1),
    CONSTRAINT ck_usuario_hash CHECK (password_hash IS NULL OR char_length(password_hash) >= 20),
    CONSTRAINT ck_usuario_intentos CHECK (intentos_fallidos >= 0)
);

-- Unicidad sin distinguir mayusculas y minusculas.
CREATE UNIQUE INDEX uq_usuarios_nombre_lower ON public.usuarios (lower(nombre_usuario));
CREATE UNIQUE INDEX uq_usuarios_email_lower ON public.usuarios (lower(email));
CREATE INDEX ix_usuarios_rol ON public.usuarios (id_rol) WHERE activo;

-- Refresh tokens: solo se guarda su hash, nunca el token original.
CREATE TABLE public.sesiones_refresh (
    id_sesion           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario          UUID NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    token_hash          TEXT NOT NULL UNIQUE,
    ip_origen           INET,
    user_agent          TEXT,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_expiracion    TIMESTAMPTZ NOT NULL,
    fecha_revocacion    TIMESTAMPTZ,
    CONSTRAINT ck_sesion_expiracion CHECK (fecha_expiracion > fecha_creacion)
);

CREATE INDEX ix_sesiones_usuario ON public.sesiones_refresh (id_usuario);
CREATE INDEX ix_sesiones_vigentes ON public.sesiones_refresh (fecha_expiracion)
    WHERE fecha_revocacion IS NULL;

-- Tokens de recuperacion; el backend envia el token y almacena solamente el hash.
CREATE TABLE public.tokens_recuperacion (
    id_token            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario          UUID NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    token_hash          TEXT NOT NULL UNIQUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_expiracion    TIMESTAMPTZ NOT NULL,
    fecha_uso           TIMESTAMPTZ,
    ip_solicitud        INET,
    CONSTRAINT ck_token_expiracion CHECK (fecha_expiracion > fecha_creacion),
    CONSTRAINT ck_token_uso CHECK (fecha_uso IS NULL OR fecha_uso >= fecha_creacion)
);

CREATE INDEX ix_tokens_recuperacion_usuario ON public.tokens_recuperacion (id_usuario);


-- Tokens para verificar el correo electronico.
CREATE TABLE public.tokens_verificacion_email (
    id_token            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario          UUID NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    token_hash          TEXT NOT NULL UNIQUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_expiracion    TIMESTAMPTZ NOT NULL,
    fecha_uso           TIMESTAMPTZ,
    ip_solicitud        INET,
    intentos            SMALLINT NOT NULL DEFAULT 0,
    nuevo_email         VARCHAR(254),
    email_anterior      VARCHAR(254),
    CONSTRAINT ck_token_email_expiracion CHECK (fecha_expiracion > fecha_creacion),
    CONSTRAINT ck_token_email_uso CHECK (fecha_uso IS NULL OR fecha_uso >= fecha_creacion),
    CONSTRAINT ck_token_email_intentos CHECK (intentos BETWEEN 0 AND 5)
);

CREATE INDEX ix_tokens_verificacion_email_usuario
    ON public.tokens_verificacion_email (id_usuario);

-- Identidades de proveedores externos, por ejemplo Google.
CREATE TABLE public.usuario_identidades (
    id_identidad        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario          UUID NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    proveedor           VARCHAR(30) NOT NULL,
    proveedor_usuario_id VARCHAR(255) NOT NULL,
    email_proveedor     VARCHAR(254),
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_usuario_identidad_proveedor
        CHECK (proveedor ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT uq_usuario_identidad_proveedor
        UNIQUE (proveedor, proveedor_usuario_id)
);

CREATE INDEX ix_usuario_identidades_usuario
    ON public.usuario_identidades (id_usuario);

/* ========================================================================== */
/* 2. ESTRUCTURA MUNICIPAL                                                    */
/* ========================================================================== */

-- Agrupa barrios por sector geografico municipal.
CREATE TABLE public.zonas (
    id_zona             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre              VARCHAR(100) NOT NULL,
    descripcion         TEXT,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_zonas_nombre_lower ON public.zonas (lower(nombre));

-- Barrios pertenecientes a una zona.
CREATE TABLE public.barrios (
    id_barrio           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_zona             UUID NOT NULL REFERENCES public.zonas(id_zona) ON DELETE RESTRICT,
    nombre              VARCHAR(120) NOT NULL,
    codigo_postal       VARCHAR(12),
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_barrios_zona_nombre ON public.barrios (id_zona, lower(nombre));
CREATE INDEX ix_barrios_zona ON public.barrios (id_zona) WHERE activo;

-- Establecimientos SAPS administrados por el municipio.
CREATE TABLE public.salitas (
    id_salita           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo              VARCHAR(30) NOT NULL UNIQUE,
    nombre              VARCHAR(150) NOT NULL,
    direccion           VARCHAR(250) NOT NULL,
    id_barrio           UUID NOT NULL REFERENCES public.barrios(id_barrio) ON DELETE RESTRICT,
    telefono            VARCHAR(30),
    email               VARCHAR(254),
    latitud             NUMERIC(9,6),
    longitud            NUMERIC(9,6),
    horario_apertura    TIME,
    horario_cierre      TIME,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_salitas_codigo CHECK (codigo ~ '^[A-Z0-9_-]+$'),
    CONSTRAINT ck_salitas_latitud CHECK (latitud IS NULL OR latitud BETWEEN -90 AND 90),
    CONSTRAINT ck_salitas_longitud CHECK (longitud IS NULL OR longitud BETWEEN -180 AND 180),
    CONSTRAINT ck_salitas_horario CHECK (
        (horario_apertura IS NULL AND horario_cierre IS NULL)
        OR (horario_apertura IS NOT NULL AND horario_cierre IS NOT NULL
            AND horario_apertura < horario_cierre)
    )
);

CREATE UNIQUE INDEX uq_salitas_nombre_lower ON public.salitas (lower(nombre));
CREATE INDEX ix_salitas_barrio ON public.salitas (id_barrio) WHERE activo;

-- Barrios que forman el area de cobertura de cada salita.
CREATE TABLE public.salita_barrios (
    id_salita           UUID NOT NULL REFERENCES public.salitas(id_salita) ON DELETE CASCADE,
    id_barrio           UUID NOT NULL REFERENCES public.barrios(id_barrio) ON DELETE RESTRICT,
    es_barrio_sede      BOOLEAN NOT NULL DEFAULT FALSE,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_desde         DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_hasta         DATE,
    PRIMARY KEY (id_salita, id_barrio),
    CONSTRAINT ck_salita_barrio_fechas CHECK (fecha_hasta IS NULL OR fecha_hasta >= fecha_desde)
);

CREATE INDEX ix_salita_barrios_barrio ON public.salita_barrios (id_barrio) WHERE activo;
CREATE UNIQUE INDEX uq_salita_barrio_sede ON public.salita_barrios (id_salita)
    WHERE es_barrio_sede AND activo;

-- Define que usuarios administrativos trabajan en cada salita.
-- El Super Admin no necesita filas aqui porque su alcance es global.
CREATE TABLE public.usuario_salita (
    id_usuario          UUID NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    id_salita           UUID NOT NULL REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    es_principal        BOOLEAN NOT NULL DEFAULT FALSE,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_desde         DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_hasta         DATE,
    PRIMARY KEY (id_usuario, id_salita),
    CONSTRAINT ck_usuario_salita_fechas CHECK (fecha_hasta IS NULL OR fecha_hasta >= fecha_desde)
);

CREATE INDEX ix_usuario_salita_salita ON public.usuario_salita (id_salita) WHERE activo;
CREATE UNIQUE INDEX uq_usuario_salita_principal ON public.usuario_salita (id_usuario)
    WHERE es_principal AND activo;

/* ========================================================================== */
/* 3. PERSONAS, PACIENTES Y GRUPO FAMILIAR                                    */
/* ========================================================================== */

-- El perfil PACIENTE contiene solamente datos propios de la atencion.
-- La identidad y los datos personales viven en public.personas.
CREATE TABLE public.pacientes (
    id_paciente                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_persona                  UUID NOT NULL UNIQUE
                                REFERENCES public.personas(id_persona) ON DELETE RESTRICT,
    id_barrio                   UUID NOT NULL REFERENCES public.barrios(id_barrio) ON DELETE RESTRICT,
    id_salita_asignada          UUID NOT NULL REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    obra_social                 VARCHAR(150),
    numero_afiliado             VARCHAR(80),
    contacto_emergencia_nombre  VARCHAR(200),
    contacto_emergencia_telefono VARCHAR(30),
    activo                      BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_pacientes_barrio
    ON public.pacientes (id_barrio) WHERE activo;
CREATE INDEX ix_pacientes_salita
    ON public.pacientes (id_salita_asignada) WHERE activo;

-- Confirma que la salita elegida cubra el barrio declarado por el paciente.
CREATE OR REPLACE FUNCTION public.validar_cobertura_paciente()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM public.salita_barrios sb
         WHERE sb.id_salita = NEW.id_salita_asignada
           AND sb.id_barrio = NEW.id_barrio
           AND sb.activo
           AND sb.fecha_desde <= CURRENT_DATE
           AND (sb.fecha_hasta IS NULL OR sb.fecha_hasta >= CURRENT_DATE)
    ) THEN
        RAISE EXCEPTION 'La salita asignada no cubre el barrio del paciente';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_pacientes_validar_cobertura
BEFORE INSERT OR UPDATE OF id_barrio, id_salita_asignada ON public.pacientes
FOR EACH ROW EXECUTE FUNCTION public.validar_cobertura_paciente();

-- Un paciente debe apuntar a una persona con los datos requeridos para atencion.
CREATE OR REPLACE FUNCTION public.validar_persona_paciente()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.activo AND NOT EXISTS (
        SELECT 1
          FROM public.personas p
         WHERE p.id_persona = NEW.id_persona
           AND p.activo
           AND p.fecha_nacimiento IS NOT NULL
           AND p.sexo IS NOT NULL
           AND NULLIF(trim(p.direccion), '') IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'La persona del paciente debe estar activa y tener fecha de nacimiento, sexo y direccion';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_pacientes_validar_persona
BEFORE INSERT OR UPDATE OF id_persona, activo ON public.pacientes
FOR EACH ROW EXECUTE FUNCTION public.validar_persona_paciente();

-- Evita quitar datos obligatorios de una persona que ya posee perfil de paciente.
CREATE OR REPLACE FUNCTION public.proteger_datos_persona_paciente()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM public.pacientes pa
         WHERE pa.id_persona = NEW.id_persona
           AND pa.activo
    ) AND (
        NEW.fecha_nacimiento IS NULL
        OR NEW.sexo IS NULL
        OR NULLIF(trim(NEW.direccion), '') IS NULL
    ) THEN
        RAISE EXCEPTION
            'Una persona con perfil de paciente activo debe conservar fecha de nacimiento, sexo y direccion';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_personas_proteger_paciente
BEFORE UPDATE OF fecha_nacimiento, sexo, direccion ON public.personas
FOR EACH ROW EXECUTE FUNCTION public.proteger_datos_persona_paciente();

-- Responsables legales o familiares. Sus datos personales viven en personas.
CREATE TABLE public.tutores (
    id_tutor            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_persona          UUID NOT NULL UNIQUE
                        REFERENCES public.personas(id_persona) ON DELETE RESTRICT,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un tutor debe poseer un telefono de contacto.
CREATE OR REPLACE FUNCTION public.validar_persona_tutor()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.activo AND NOT EXISTS (
        SELECT 1
          FROM public.personas p
         WHERE p.id_persona = NEW.id_persona
           AND p.activo
           AND NULLIF(trim(p.telefono), '') IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'La persona del tutor debe estar activa y tener telefono';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_tutores_validar_persona
BEFORE INSERT OR UPDATE OF id_persona, activo ON public.tutores
FOR EACH ROW EXECUTE FUNCTION public.validar_persona_tutor();

-- Evita quitar el telefono de una persona con perfil de tutor activo.
CREATE OR REPLACE FUNCTION public.proteger_datos_persona_tutor()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM public.tutores tu
         WHERE tu.id_persona = NEW.id_persona
           AND tu.activo
    ) AND NULLIF(trim(NEW.telefono), '') IS NULL THEN
        RAISE EXCEPTION
            'Una persona con perfil de tutor activo debe conservar un telefono';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_personas_proteger_tutor
BEFORE UPDATE OF telefono ON public.personas
FOR EACH ROW EXECUTE FUNCTION public.proteger_datos_persona_tutor();

-- Vincula cada paciente a uno o varios responsables.
CREATE TABLE public.paciente_tutores (
    id_paciente         UUID NOT NULL REFERENCES public.pacientes(id_paciente) ON DELETE CASCADE,
    id_tutor            UUID NOT NULL REFERENCES public.tutores(id_tutor) ON DELETE CASCADE,
    parentesco          VARCHAR(50) NOT NULL,
    es_principal        BOOLEAN NOT NULL DEFAULT FALSE,
    puede_gestionar_turnos BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_desde         DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_hasta         DATE,
    PRIMARY KEY (id_paciente, id_tutor),
    CONSTRAINT ck_paciente_tutor_fechas CHECK (fecha_hasta IS NULL OR fecha_hasta >= fecha_desde)
);

CREATE INDEX ix_paciente_tutores_tutor ON public.paciente_tutores (id_tutor);
CREATE UNIQUE INDEX uq_paciente_tutor_principal ON public.paciente_tutores (id_paciente)
    WHERE es_principal AND fecha_hasta IS NULL;

/* ========================================================================== */
/* 4. PROFESIONALES Y ESPECIALIDADES                                          */
/* ========================================================================== */

-- Catalogo municipal de especialidades y prestaciones.
CREATE TABLE public.especialidades (
    id_especialidad     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo              VARCHAR(40) NOT NULL UNIQUE,
    nombre              VARCHAR(120) NOT NULL,
    descripcion         TEXT,
    requiere_profesional BOOLEAN NOT NULL DEFAULT TRUE,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_especialidad_codigo CHECK (codigo ~ '^[A-Z0-9_]+$')
);

CREATE UNIQUE INDEX uq_especialidades_nombre_lower ON public.especialidades (lower(nombre));

-- Profesional unico aunque atienda en varias salitas.
-- Sus datos personales viven en public.personas.
CREATE TABLE public.profesionales (
    id_profesional      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_persona          UUID NOT NULL UNIQUE
                        REFERENCES public.personas(id_persona) ON DELETE RESTRICT,
    matricula           VARCHAR(50) NOT NULL UNIQUE,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_alta          DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_baja          DATE,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_profesional_fechas CHECK (
        fecha_baja IS NULL OR fecha_baja >= fecha_alta
    )
);

-- Un profesional activo debe referenciar una persona activa.
CREATE OR REPLACE FUNCTION public.validar_persona_profesional()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.activo AND NOT EXISTS (
        SELECT 1
          FROM public.personas p
         WHERE p.id_persona = NEW.id_persona
           AND p.activo
    ) THEN
        RAISE EXCEPTION 'La persona del profesional no existe o esta inactiva';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_profesionales_validar_persona
BEFORE INSERT OR UPDATE OF id_persona, activo ON public.profesionales
FOR EACH ROW EXECUTE FUNCTION public.validar_persona_profesional();


-- Especialidades habilitadas para cada profesional.
CREATE TABLE public.profesional_especialidad (
    id_profesional      UUID NOT NULL REFERENCES public.profesionales(id_profesional) ON DELETE CASCADE,
    id_especialidad     UUID NOT NULL REFERENCES public.especialidades(id_especialidad) ON DELETE RESTRICT,
    fecha_desde         DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_hasta         DATE,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_profesional, id_especialidad),
    CONSTRAINT ck_prof_especialidad_fechas CHECK (fecha_hasta IS NULL OR fecha_hasta >= fecha_desde)
);

CREATE INDEX ix_prof_especialidad_especialidad ON public.profesional_especialidad (id_especialidad)
    WHERE activo;

-- Salitas donde presta servicio cada profesional.
CREATE TABLE public.profesional_salita (
    id_profesional      UUID NOT NULL REFERENCES public.profesionales(id_profesional) ON DELETE CASCADE,
    id_salita           UUID NOT NULL REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    fecha_desde         DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_hasta         DATE,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_profesional, id_salita),
    CONSTRAINT ck_prof_salita_fechas CHECK (fecha_hasta IS NULL OR fecha_hasta >= fecha_desde)
);

CREATE INDEX ix_prof_salita_salita ON public.profesional_salita (id_salita) WHERE activo;

/* ========================================================================== */
/* 5. AGENDA                                                                  */
/* ========================================================================== */

-- Horario semanal usado para calcular turnos disponibles.
-- dia_semana sigue ISO: lunes=1 y domingo=7.
CREATE TABLE public.horarios_atencion (
    id_horario              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_profesional          UUID NOT NULL,
    id_especialidad         UUID NOT NULL,
    id_salita               UUID NOT NULL,
    dia_semana              SMALLINT NOT NULL,
    hora_inicio             TIME NOT NULL,
    hora_fin                TIME NOT NULL,
    duracion_turno_minutos  SMALLINT NOT NULL DEFAULT 20,
    cupo_maximo_diario      SMALLINT,
    vigencia_desde          DATE NOT NULL DEFAULT CURRENT_DATE,
    vigencia_hasta          DATE,
    activo                  BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (id_profesional, id_especialidad)
        REFERENCES public.profesional_especialidad(id_profesional, id_especialidad) ON DELETE RESTRICT,
    FOREIGN KEY (id_profesional, id_salita)
        REFERENCES public.profesional_salita(id_profesional, id_salita) ON DELETE RESTRICT,
    CONSTRAINT ck_horario_dia CHECK (dia_semana BETWEEN 1 AND 7),
    CONSTRAINT ck_horario_horas CHECK (hora_inicio < hora_fin),
    CONSTRAINT ck_horario_duracion CHECK (duracion_turno_minutos BETWEEN 5 AND 240),
    CONSTRAINT ck_horario_cupo CHECK (cupo_maximo_diario IS NULL OR cupo_maximo_diario > 0),
    CONSTRAINT ck_horario_vigencia CHECK (vigencia_hasta IS NULL OR vigencia_hasta >= vigencia_desde)
);

CREATE INDEX ix_horarios_busqueda ON public.horarios_atencion
    (id_salita, id_especialidad, dia_semana) WHERE activo;
CREATE INDEX ix_horarios_profesional ON public.horarios_atencion
    (id_profesional, dia_semana) WHERE activo;

-- Evita horarios semanales superpuestos para el mismo profesional y dia.
ALTER TABLE public.horarios_atencion
    ADD CONSTRAINT ex_horarios_profesional_solapados
    EXCLUDE USING gist (
        id_profesional WITH =,
        dia_semana WITH =,
        tsrange(
            timestamp '2000-01-01' + hora_inicio,
            timestamp '2000-01-01' + hora_fin,
            '[)'
        ) WITH &&,
        daterange(vigencia_desde, COALESCE(vigencia_hasta + 1, 'infinity'::date), '[)') WITH &&
    ) WHERE (activo);

-- Ausencias, feriados o cierres que bloquean una agenda.
CREATE TABLE public.bloqueos_agenda (
    id_bloqueo          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_profesional      UUID REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    id_salita           UUID NOT NULL REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    id_especialidad     UUID REFERENCES public.especialidades(id_especialidad) ON DELETE RESTRICT,
    fecha               DATE NOT NULL,
    hora_inicio         TIME,
    hora_fin            TIME,
    dia_completo        BOOLEAN NOT NULL DEFAULT FALSE,
    motivo              TEXT NOT NULL,
    creado_por          UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_bloqueo_fecha CHECK (fecha >= DATE '2020-01-01'),
    CONSTRAINT ck_bloqueo_horas CHECK (
        (dia_completo AND hora_inicio IS NULL AND hora_fin IS NULL)
        OR (NOT dia_completo AND hora_inicio IS NOT NULL AND hora_fin IS NOT NULL
            AND hora_inicio < hora_fin)
    )
);

CREATE INDEX ix_bloqueos_agenda_busqueda ON public.bloqueos_agenda
    (id_salita, fecha, id_profesional) WHERE activo;

/* ========================================================================== */
/* 6. TURNOS, ESTADOS E HISTORIAL                                             */
/* ========================================================================== */

-- Estados configurables. Los indicadores permiten aplicar reglas en PostgreSQL.
CREATE TABLE public.estados_turno (
    id_estado                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo                          VARCHAR(40) NOT NULL UNIQUE,
    nombre                          VARCHAR(100) NOT NULL UNIQUE,
    descripcion                     TEXT,
    ocupa_agenda                    BOOLEAN NOT NULL DEFAULT FALSE,
    impide_otro_misma_especialidad  BOOLEAN NOT NULL DEFAULT FALSE,
    es_estado_final                 BOOLEAN NOT NULL DEFAULT FALSE,
    orden                           SMALLINT NOT NULL DEFAULT 0,
    activo                          BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_estado_codigo CHECK (codigo ~ '^[A-Z][A-Z0-9_]*$')
);

-- Turno central con datos necesarios para el comprobante.
CREATE TABLE public.turnos (
    id_turno                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_turno                VARCHAR(30) NOT NULL UNIQUE,
    id_paciente                 UUID NOT NULL REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    id_profesional              UUID NOT NULL REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    id_especialidad             UUID NOT NULL REFERENCES public.especialidades(id_especialidad) ON DELETE RESTRICT,
    id_salita                   UUID NOT NULL REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    id_horario                  UUID REFERENCES public.horarios_atencion(id_horario) ON DELETE SET NULL,
    id_estado                   UUID NOT NULL REFERENCES public.estados_turno(id_estado) ON DELETE RESTRICT,
    fecha_hora_inicio           TIMESTAMPTZ NOT NULL,
    fecha_hora_fin              TIMESTAMPTZ NOT NULL,
    periodo                     TSTZRANGE GENERATED ALWAYS AS
                                (tstzrange(fecha_hora_inicio, fecha_hora_fin, '[)')) STORED,
    motivo_consulta             TEXT,
    observaciones               TEXT,
    motivo_cancelacion          TEXT,
    cancelado_por               UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    fecha_cancelacion           TIMESTAMPTZ,
    id_turno_origen             UUID REFERENCES public.turnos(id_turno) ON DELETE SET NULL,
    creado_por                  UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    fecha_solicitud             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ocupa_agenda                BOOLEAN NOT NULL DEFAULT TRUE,
    impide_otro_misma_especialidad BOOLEAN NOT NULL DEFAULT TRUE,
    version                     INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT ck_turno_fechas CHECK (fecha_hora_fin > fecha_hora_inicio),
    CONSTRAINT ck_turno_cancelacion CHECK (
        (fecha_cancelacion IS NULL AND cancelado_por IS NULL)
        OR fecha_cancelacion IS NOT NULL
    ),
    CONSTRAINT ck_turno_version CHECK (version > 0)
);

CREATE INDEX ix_turnos_paciente_fecha ON public.turnos (id_paciente, fecha_hora_inicio DESC);
CREATE INDEX ix_turnos_agenda ON public.turnos (id_salita, id_profesional, fecha_hora_inicio);
CREATE INDEX ix_turnos_especialidad ON public.turnos (id_salita, id_especialidad, fecha_hora_inicio);
CREATE INDEX ix_turnos_estado ON public.turnos (id_estado, fecha_hora_inicio);

-- Un profesional y un paciente no pueden ocupar dos turnos superpuestos.
ALTER TABLE public.turnos
    ADD CONSTRAINT ex_turnos_profesional_solapados
    EXCLUDE USING gist (id_profesional WITH =, periodo WITH &&)
    WHERE (ocupa_agenda);

ALTER TABLE public.turnos
    ADD CONSTRAINT ex_turnos_paciente_solapados
    EXCLUDE USING gist (id_paciente WITH =, periodo WITH &&)
    WHERE (ocupa_agenda);

-- Solo puede existir un turno abierto por paciente y especialidad.
CREATE UNIQUE INDEX uq_turno_abierto_paciente_especialidad
    ON public.turnos (id_paciente, id_especialidad)
    WHERE impide_otro_misma_especialidad;

-- Sincroniza los indicadores del turno con su estado.
CREATE OR REPLACE FUNCTION public.sincronizar_estado_turno()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_ocupa BOOLEAN;
    v_impide BOOLEAN;
BEGIN
    SELECT ocupa_agenda, impide_otro_misma_especialidad
      INTO v_ocupa, v_impide
      FROM public.estados_turno
     WHERE id_estado = NEW.id_estado AND activo;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El estado del turno no existe o esta inactivo';
    END IF;

    NEW.ocupa_agenda := v_ocupa;
    NEW.impide_otro_misma_especialidad := v_impide;
    NEW.fecha_actualizacion := NOW();

    IF TG_OP = 'UPDATE' THEN
        NEW.version := OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_turnos_sincronizar_estado
BEFORE INSERT OR UPDATE ON public.turnos
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_estado_turno();

-- Valida asociaciones, horario, bloqueos y cupo diario antes de reservar.
CREATE OR REPLACE FUNCTION public.validar_turno()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_horario public.horarios_atencion%ROWTYPE;
    v_fecha_local DATE;
    v_hora_inicio TIME;
    v_hora_fin TIME;
    v_cantidad INTEGER;
BEGIN
    IF NOT NEW.ocupa_agenda THEN
        RETURN NEW;
    END IF;

    -- La agenda municipal se interpreta con la zona horaria argentina.
    v_fecha_local := (NEW.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
    v_hora_inicio := (NEW.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::time;
    v_hora_fin := (NEW.fecha_hora_fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::time;

    IF NEW.id_horario IS NOT NULL THEN
        SELECT * INTO v_horario
          FROM public.horarios_atencion
         WHERE id_horario = NEW.id_horario AND activo
         FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El horario seleccionado no existe o esta inactivo';
        END IF;

        IF v_horario.id_profesional <> NEW.id_profesional
           OR v_horario.id_especialidad <> NEW.id_especialidad
           OR v_horario.id_salita <> NEW.id_salita THEN
            RAISE EXCEPTION 'El turno no coincide con el profesional, especialidad o salita del horario';
        END IF;

        IF EXTRACT(ISODOW FROM v_fecha_local)::SMALLINT <> v_horario.dia_semana
           OR v_fecha_local < v_horario.vigencia_desde
           OR (v_horario.vigencia_hasta IS NOT NULL AND v_fecha_local > v_horario.vigencia_hasta)
           OR v_hora_inicio < v_horario.hora_inicio
           OR v_hora_fin > v_horario.hora_fin THEN
            RAISE EXCEPTION 'El turno esta fuera de la vigencia o franja del horario';
        END IF;

        IF EXTRACT(EPOCH FROM (NEW.fecha_hora_fin - NEW.fecha_hora_inicio)) / 60
           <> v_horario.duracion_turno_minutos THEN
            RAISE EXCEPTION 'La duracion del turno no coincide con el horario configurado';
        END IF;

        IF MOD(
            (EXTRACT(EPOCH FROM (v_hora_inicio - v_horario.hora_inicio)) / 60)::INTEGER,
            v_horario.duracion_turno_minutos
        ) <> 0 THEN
            RAISE EXCEPTION 'La hora de inicio no coincide con un bloque valido de la agenda';
        END IF;

        IF v_horario.cupo_maximo_diario IS NOT NULL THEN
            SELECT COUNT(*) INTO v_cantidad
              FROM public.turnos t
             WHERE t.id_horario = NEW.id_horario
               AND t.ocupa_agenda
               AND (t.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = v_fecha_local
               AND t.id_turno <> NEW.id_turno;

            IF v_cantidad >= v_horario.cupo_maximo_diario THEN
                RAISE EXCEPTION 'Se alcanzo el cupo maximo diario del horario';
            END IF;
        END IF;
    ELSE
        -- Los turnos manuales igualmente requieren asociaciones vigentes.
        IF NOT EXISTS (
            SELECT 1 FROM public.profesional_especialidad pe
             WHERE pe.id_profesional = NEW.id_profesional
               AND pe.id_especialidad = NEW.id_especialidad AND pe.activo
        ) OR NOT EXISTS (
            SELECT 1 FROM public.profesional_salita ps
             WHERE ps.id_profesional = NEW.id_profesional
               AND ps.id_salita = NEW.id_salita AND ps.activo
        ) THEN
            RAISE EXCEPTION 'El profesional no esta habilitado para esa especialidad o salita';
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM public.bloqueos_agenda b
         WHERE b.activo
           AND b.id_salita = NEW.id_salita
           AND b.fecha = v_fecha_local
           AND (b.id_profesional IS NULL OR b.id_profesional = NEW.id_profesional)
           AND (b.id_especialidad IS NULL OR b.id_especialidad = NEW.id_especialidad)
           AND (b.dia_completo OR (v_hora_inicio < b.hora_fin AND v_hora_fin > b.hora_inicio))
    ) THEN
        RAISE EXCEPTION 'La agenda esta bloqueada para la fecha y horario solicitados';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_turnos_validar
BEFORE INSERT OR UPDATE OF id_horario, id_profesional, id_especialidad, id_salita,
    fecha_hora_inicio, fecha_hora_fin, id_estado
ON public.turnos
FOR EACH ROW EXECUTE FUNCTION public.validar_turno();

-- Impide crear un bloqueo que alcance turnos vigentes.
CREATE OR REPLACE FUNCTION public.validar_bloqueo_agenda()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.activo AND EXISTS (
        SELECT 1
          FROM public.turnos t
         WHERE t.ocupa_agenda
           AND t.id_salita = NEW.id_salita
           AND (NEW.id_profesional IS NULL OR t.id_profesional = NEW.id_profesional)
           AND (NEW.id_especialidad IS NULL OR t.id_especialidad = NEW.id_especialidad)
           AND (t.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = NEW.fecha
           AND (
               NEW.dia_completo
               OR (
                   (t.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::time < NEW.hora_fin
                   AND (t.fecha_hora_fin AT TIME ZONE 'America/Argentina/Buenos_Aires')::time > NEW.hora_inicio
               )
           )
    ) THEN
        RAISE EXCEPTION 'No se puede bloquear una franja con turnos vigentes; primero deben reprogramarse o cancelarse';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_bloqueos_validar
BEFORE INSERT OR UPDATE ON public.bloqueos_agenda
FOR EACH ROW EXECUTE FUNCTION public.validar_bloqueo_agenda();

-- Registro especifico y legible de los cambios de un turno.
CREATE TABLE public.historial_turnos (
    id_historial        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_turno            UUID NOT NULL REFERENCES public.turnos(id_turno) ON DELETE RESTRICT,
    id_usuario          UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    accion              VARCHAR(50) NOT NULL,
    id_estado_anterior  UUID REFERENCES public.estados_turno(id_estado) ON DELETE SET NULL,
    id_estado_nuevo     UUID REFERENCES public.estados_turno(id_estado) ON DELETE SET NULL,
    fecha_hora_anterior TIMESTAMPTZ,
    fecha_hora_nueva    TIMESTAMPTZ,
    detalle             TEXT,
    fecha               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_historial_turno_fecha ON public.historial_turnos (id_turno, fecha DESC);

-- Genera el historial automaticamente. La API puede definir app.current_user_id.
CREATE OR REPLACE FUNCTION public.registrar_historial_turno()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_usuario UUID;
    v_accion VARCHAR(50);
BEGIN
    v_usuario := NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.historial_turnos
            (id_turno, id_usuario, accion, id_estado_nuevo, fecha_hora_nueva, detalle)
        VALUES
            (NEW.id_turno, COALESCE(v_usuario, NEW.creado_por), 'CREACION',
             NEW.id_estado, NEW.fecha_hora_inicio, 'Turno creado');
        RETURN NEW;
    END IF;

    v_accion := CASE
        WHEN OLD.id_estado IS DISTINCT FROM NEW.id_estado THEN 'CAMBIO_ESTADO'
        WHEN OLD.fecha_hora_inicio IS DISTINCT FROM NEW.fecha_hora_inicio
          OR OLD.fecha_hora_fin IS DISTINCT FROM NEW.fecha_hora_fin THEN 'REPROGRAMACION'
        WHEN OLD.id_profesional IS DISTINCT FROM NEW.id_profesional THEN 'CAMBIO_PROFESIONAL'
        ELSE 'MODIFICACION'
    END;

    INSERT INTO public.historial_turnos
        (id_turno, id_usuario, accion, id_estado_anterior, id_estado_nuevo,
         fecha_hora_anterior, fecha_hora_nueva, detalle)
    VALUES
        (NEW.id_turno, COALESCE(v_usuario, NEW.creado_por), v_accion,
         OLD.id_estado, NEW.id_estado, OLD.fecha_hora_inicio, NEW.fecha_hora_inicio,
         'Cambio registrado automaticamente');
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_turnos_historial
AFTER INSERT OR UPDATE ON public.turnos
FOR EACH ROW EXECUTE FUNCTION public.registrar_historial_turno();

/* ========================================================================== */
/* 7. SANCIONES POR INASISTENCIA                                              */
/* ========================================================================== */

-- Restriccion temporal por no asistir a un turno de una especialidad.
CREATE TABLE public.sanciones (
    id_sancion          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_paciente         UUID NOT NULL REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    id_especialidad     UUID NOT NULL REFERENCES public.especialidades(id_especialidad) ON DELETE RESTRICT,
    id_turno            UUID NOT NULL UNIQUE REFERENCES public.turnos(id_turno) ON DELETE RESTRICT,
    motivo              TEXT NOT NULL,
    fecha_inicio        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_fin           TIMESTAMPTZ NOT NULL,
    anulada             BOOLEAN NOT NULL DEFAULT FALSE,
    motivo_anulacion    TEXT,
    anulada_por         UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    creado_por          UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_sancion_fechas CHECK (fecha_fin > fecha_inicio),
    CONSTRAINT ck_sancion_anulacion CHECK (
        (NOT anulada AND motivo_anulacion IS NULL AND anulada_por IS NULL)
        OR anulada
    )
);

CREATE INDEX ix_sanciones_vigentes ON public.sanciones
    (id_paciente, id_especialidad, fecha_fin) WHERE NOT anulada;

-- La sancion debe corresponder al paciente y especialidad del turno informado.
CREATE OR REPLACE FUNCTION public.validar_sancion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.turnos t
         WHERE t.id_turno = NEW.id_turno
           AND t.id_paciente = NEW.id_paciente
           AND t.id_especialidad = NEW.id_especialidad
    ) THEN
        RAISE EXCEPTION 'La sancion no coincide con el paciente y especialidad del turno';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_sanciones_validar
BEFORE INSERT OR UPDATE ON public.sanciones
FOR EACH ROW EXECUTE FUNCTION public.validar_sancion();

-- Bloquea nuevos turnos durante una sancion vigente.
CREATE OR REPLACE FUNCTION public.validar_sancion_turno()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.ocupa_agenda AND EXISTS (
        SELECT 1 FROM public.sanciones s
         WHERE s.id_paciente = NEW.id_paciente
           AND s.id_especialidad = NEW.id_especialidad
           AND NOT s.anulada
           AND NEW.fecha_hora_inicio >= s.fecha_inicio
           AND NEW.fecha_hora_inicio < s.fecha_fin
    ) THEN
        RAISE EXCEPTION 'El paciente posee una restriccion vigente para esta especialidad';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_turnos_validar_sancion
BEFORE INSERT OR UPDATE OF id_paciente, id_especialidad, fecha_hora_inicio, id_estado
ON public.turnos
FOR EACH ROW EXECUTE FUNCTION public.validar_sancion_turno();

/* ========================================================================== */
/* 8. NOTIFICACIONES, CONFIGURACION Y AUDITORIA                               */
/* ========================================================================== */

-- Avisos internos, por correo u otros canales futuros.
CREATE TABLE public.notificaciones (
    id_notificacion     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario          UUID NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    id_turno            UUID REFERENCES public.turnos(id_turno) ON DELETE SET NULL,
    tipo                VARCHAR(50) NOT NULL,
    canal               VARCHAR(20) NOT NULL DEFAULT 'SISTEMA',
    titulo              VARCHAR(160) NOT NULL,
    mensaje             TEXT NOT NULL,
    estado_envio        VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    fecha_programada    TIMESTAMPTZ,
    fecha_envio         TIMESTAMPTZ,
    fecha_lectura       TIMESTAMPTZ,
    leida               BOOLEAN NOT NULL DEFAULT FALSE,
    intentos_envio      SMALLINT NOT NULL DEFAULT 0,
    error_envio         TEXT,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_notificacion_canal CHECK (canal IN ('SISTEMA','EMAIL','WHATSAPP')),
    CONSTRAINT ck_notificacion_estado CHECK (estado_envio IN ('PENDIENTE','ENVIADA','FALLIDA','CANCELADA')),
    CONSTRAINT ck_notificacion_intentos CHECK (intentos_envio >= 0),
    CONSTRAINT ck_notificacion_lectura CHECK (NOT leida OR fecha_lectura IS NOT NULL)
);

CREATE INDEX ix_notificaciones_usuario ON public.notificaciones (id_usuario, fecha_creacion DESC);
CREATE INDEX ix_notificaciones_pendientes ON public.notificaciones (fecha_programada)
    WHERE estado_envio = 'PENDIENTE';

-- Parametros globales o particulares de una salita.
CREATE TABLE public.configuracion (
    id_configuracion    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_salita           UUID REFERENCES public.salitas(id_salita) ON DELETE CASCADE,
    clave               VARCHAR(100) NOT NULL,
    valor               JSONB NOT NULL,
    descripcion         TEXT,
    es_publica          BOOLEAN NOT NULL DEFAULT FALSE,
    actualizado_por    UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_configuracion_clave CHECK (clave ~ '^[a-z][a-z0-9_.-]*$')
);

CREATE UNIQUE INDEX uq_configuracion_global ON public.configuracion (clave) WHERE id_salita IS NULL;
CREATE UNIQUE INDEX uq_configuracion_salita ON public.configuracion (id_salita, clave) WHERE id_salita IS NOT NULL;

-- Auditoria general con valores anteriores y nuevos en JSON.
CREATE TABLE public.auditoria (
    id_auditoria        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario          UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    id_salita           UUID REFERENCES public.salitas(id_salita) ON DELETE SET NULL,
    esquema             VARCHAR(63) NOT NULL,
    entidad             VARCHAR(100) NOT NULL,
    id_entidad          TEXT,
    accion              VARCHAR(10) NOT NULL,
    datos_anteriores    JSONB,
    datos_nuevos        JSONB,
    ip_origen           INET,
    fecha               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_auditoria_accion CHECK (accion IN ('INSERT','UPDATE','DELETE'))
);

CREATE INDEX ix_auditoria_entidad ON public.auditoria (entidad, id_entidad, fecha DESC);
CREATE INDEX ix_auditoria_usuario ON public.auditoria (id_usuario, fecha DESC);
CREATE INDEX ix_auditoria_salita ON public.auditoria (id_salita, fecha DESC);

-- Funcion generica de auditoria. La API debe configurar usuario, salita e IP por transaccion.
CREATE OR REPLACE FUNCTION public.auditar_cambios()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_usuario UUID;
    v_salita UUID;
    v_ip INET;
    v_anterior JSONB;
    v_nuevo JSONB;
    v_id TEXT;
BEGIN
    v_usuario := NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
    v_salita := NULLIF(current_setting('app.current_salita_id', TRUE), '')::UUID;
    v_ip := NULLIF(current_setting('app.client_ip', TRUE), '')::INET;

    IF TG_OP = 'DELETE' THEN
        v_anterior := to_jsonb(OLD);
        v_id := COALESCE(v_anterior ->> TG_ARGV[0], '');
    ELSIF TG_OP = 'UPDATE' THEN
        v_anterior := to_jsonb(OLD);
        v_nuevo := to_jsonb(NEW);
        v_id := COALESCE(v_nuevo ->> TG_ARGV[0], '');
    ELSE
        v_nuevo := to_jsonb(NEW);
        v_id := COALESCE(v_nuevo ->> TG_ARGV[0], '');
    END IF;

    -- Los hashes de contrasena nunca se copian al registro de auditoria.
    IF TG_TABLE_NAME = 'usuarios' THEN
        v_anterior := v_anterior - 'password_hash';
        v_nuevo := v_nuevo - 'password_hash';
    END IF;

    INSERT INTO public.auditoria
        (id_usuario, id_salita, esquema, entidad, id_entidad, accion,
         datos_anteriores, datos_nuevos, ip_origen)
    VALUES
        (v_usuario, v_salita, TG_TABLE_SCHEMA, TG_TABLE_NAME, v_id, TG_OP,
         v_anterior, v_nuevo, v_ip);

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- Auditoria aplicada a las entidades mas sensibles del sistema.
CREATE TRIGGER tr_auditar_personas AFTER INSERT OR UPDATE OR DELETE ON public.personas
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_persona');
CREATE TRIGGER tr_auditar_usuarios AFTER INSERT OR UPDATE OR DELETE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_usuario');
CREATE TRIGGER tr_auditar_salitas AFTER INSERT OR UPDATE OR DELETE ON public.salitas
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_salita');
CREATE TRIGGER tr_auditar_pacientes AFTER INSERT OR UPDATE OR DELETE ON public.pacientes
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_paciente');
CREATE TRIGGER tr_auditar_tutores AFTER INSERT OR UPDATE OR DELETE ON public.tutores
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_tutor');
CREATE TRIGGER tr_auditar_paciente_tutores AFTER INSERT OR UPDATE OR DELETE ON public.paciente_tutores
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_paciente');
CREATE TRIGGER tr_auditar_profesionales AFTER INSERT OR UPDATE OR DELETE ON public.profesionales
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_profesional');
CREATE TRIGGER tr_auditar_horarios AFTER INSERT OR UPDATE OR DELETE ON public.horarios_atencion
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_horario');
CREATE TRIGGER tr_auditar_bloqueos AFTER INSERT OR UPDATE OR DELETE ON public.bloqueos_agenda
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_bloqueo');
CREATE TRIGGER tr_auditar_turnos AFTER INSERT OR UPDATE OR DELETE ON public.turnos
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_turno');
CREATE TRIGGER tr_auditar_sanciones AFTER INSERT OR UPDATE OR DELETE ON public.sanciones
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_sancion');

/* ========================================================================== */
/* 10. TRIGGERS DE FECHA DE ACTUALIZACION                                     */
/* ========================================================================== */

CREATE TRIGGER tr_roles_fecha BEFORE UPDATE ON public.roles
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();
CREATE TRIGGER tr_personas_fecha BEFORE UPDATE ON public.personas
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();
CREATE TRIGGER tr_usuarios_fecha BEFORE UPDATE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();
CREATE TRIGGER tr_zonas_fecha BEFORE UPDATE ON public.zonas
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();
CREATE TRIGGER tr_barrios_fecha BEFORE UPDATE ON public.barrios
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();
CREATE TRIGGER tr_salitas_fecha BEFORE UPDATE ON public.salitas
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();
CREATE TRIGGER tr_pacientes_fecha BEFORE UPDATE ON public.pacientes
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();
CREATE TRIGGER tr_tutores_fecha BEFORE UPDATE ON public.tutores
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();
CREATE TRIGGER tr_especialidades_fecha BEFORE UPDATE ON public.especialidades
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();
CREATE TRIGGER tr_profesionales_fecha BEFORE UPDATE ON public.profesionales
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();
CREATE TRIGGER tr_horarios_fecha BEFORE UPDATE ON public.horarios_atencion
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();
CREATE TRIGGER tr_configuracion_fecha BEFORE UPDATE ON public.configuracion
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();

/* ========================================================================== */
/* 11. DATOS INICIALES                                                        */
/* ========================================================================== */

INSERT INTO public.roles (codigo, nombre, descripcion) VALUES
('SUPER_ADMIN', 'Super Administrador', 'Administra y supervisa todas las salitas.'),
('ADMIN_SALITA', 'Administrador de Salita', 'Gestiona solamente las salitas asignadas.'),
('RECEPCION', 'Recepcion o Enfermeria', 'Gestiona pacientes, agendas y turnos de su salita.'),
('PROFESIONAL', 'Profesional', 'Consulta su agenda y sus turnos asignados.'),
('PACIENTE', 'Paciente', 'Gestiona su perfil, familiares y turnos.');

INSERT INTO public.permisos (codigo, nombre, descripcion) VALUES
('GESTIONAR_ROLES', 'Gestionar roles', 'Alta y modificacion de roles y permisos.'),
('GESTIONAR_USUARIOS', 'Gestionar usuarios', 'Alta y modificacion de cuentas.'),
('GESTIONAR_ESTRUCTURA', 'Gestionar estructura municipal', 'Gestion de zonas, barrios y salitas.'),
('GESTIONAR_PACIENTES', 'Gestionar pacientes', 'Alta, consulta y modificacion de pacientes.'),
('GESTIONAR_PROFESIONALES', 'Gestionar profesionales', 'Alta y asignacion de profesionales.'),
('GESTIONAR_AGENDAS', 'Gestionar agendas', 'Horarios, cupos y bloqueos.'),
('GESTIONAR_TURNOS', 'Gestionar turnos', 'Alta, confirmacion, cancelacion y reprogramacion.'),
('GESTIONAR_SANCIONES', 'Gestionar sanciones', 'Alta o anulacion de restricciones.'),
('VER_REPORTES', 'Ver reportes', 'Consulta y exportacion de informes.'),
('VER_AUDITORIA', 'Ver auditoria', 'Consulta del registro general de cambios.'),
('GESTIONAR_CONFIGURACION', 'Gestionar configuracion', 'Modificacion de parametros del sistema.'),
('GESTIONAR_PERFIL_PROPIO', 'Gestionar perfil propio', 'Consulta y actualizacion de datos permitidos.'),
('GESTIONAR_TURNOS_PROPIOS', 'Gestionar turnos propios', 'Solicitud y cancelacion de turnos propios o familiares.');

-- El Super Admin recibe todos los permisos activos.
INSERT INTO public.rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM public.roles r CROSS JOIN public.permisos p
WHERE r.codigo = 'SUPER_ADMIN' AND p.activo;

-- Permisos del administrador de cada salita.
INSERT INTO public.rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM public.roles r JOIN public.permisos p ON p.codigo IN (
    'GESTIONAR_USUARIOS','GESTIONAR_PACIENTES','GESTIONAR_PROFESIONALES',
    'GESTIONAR_AGENDAS','GESTIONAR_TURNOS','GESTIONAR_SANCIONES','VER_REPORTES',
    'VER_AUDITORIA','GESTIONAR_CONFIGURACION','GESTIONAR_PERFIL_PROPIO'
)
WHERE r.codigo = 'ADMIN_SALITA';

-- Permisos de recepcion o enfermeria.
INSERT INTO public.rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM public.roles r JOIN public.permisos p ON p.codigo IN (
    'GESTIONAR_PACIENTES','GESTIONAR_AGENDAS','GESTIONAR_TURNOS',
    'GESTIONAR_SANCIONES','VER_REPORTES','GESTIONAR_PERFIL_PROPIO'
)
WHERE r.codigo = 'RECEPCION';

-- Permisos de profesionales.
INSERT INTO public.rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM public.roles r JOIN public.permisos p ON p.codigo IN (
    'GESTIONAR_PERFIL_PROPIO'
)
WHERE r.codigo = 'PROFESIONAL';

-- Permisos de pacientes.
INSERT INTO public.rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM public.roles r JOIN public.permisos p ON p.codigo IN (
    'GESTIONAR_PERFIL_PROPIO','GESTIONAR_TURNOS_PROPIOS'
)
WHERE r.codigo = 'PACIENTE';

INSERT INTO public.estados_turno
    (codigo, nombre, descripcion, ocupa_agenda, impide_otro_misma_especialidad, es_estado_final, orden)
VALUES
('SOLICITADO', 'Solicitado', 'Turno solicitado y pendiente de confirmacion.', TRUE, TRUE, FALSE, 10),
('CONFIRMADO', 'Confirmado', 'Turno confirmado por la salita.', TRUE, TRUE, FALSE, 20),
('EN_ESPERA', 'En espera', 'Paciente presente y esperando atencion.', TRUE, TRUE, FALSE, 30),
('ATENDIDO', 'Atendido', 'Atencion realizada.', FALSE, FALSE, TRUE, 40),
('NO_ASISTIO', 'No asistio', 'El paciente no se presento.', FALSE, FALSE, TRUE, 50),
('CANCELADO', 'Cancelado', 'Turno cancelado.', FALSE, FALSE, TRUE, 60),
('REPROGRAMADO', 'Reprogramado', 'Turno reemplazado por otro horario.', FALSE, FALSE, TRUE, 70);

-- Parametros iniciales que la API puede consultar y modificar.
INSERT INTO public.configuracion (clave, valor, descripcion, es_publica) VALUES
('sistema.nombre', '"SAPS Turno"'::jsonb, 'Nombre visible del sistema.', TRUE),
('turnos.cancelacion_minima_horas', '24'::jsonb, 'Anticipacion minima para cancelar sin sancion.', TRUE),
('turnos.sancion_inasistencia_dias', '7'::jsonb, 'Duracion inicial de la restriccion por inasistencia.', FALSE),
('sistema.zona_horaria', '"America/Argentina/Buenos_Aires"'::jsonb, 'Zona horaria utilizada por la agenda.', TRUE);

/* ========================================================================== */
/* 12. VISTAS DE CONSULTA                                                     */
/* ========================================================================== */

-- Agenda legible para paneles y comprobantes.
CREATE OR REPLACE VIEW public.vw_agenda_turnos AS
SELECT
    t.id_turno,
    t.codigo_turno,
    t.fecha_hora_inicio,
    t.fecha_hora_fin,
    et.codigo AS estado_codigo,
    et.nombre AS estado,
    pp.dni AS paciente_dni,
    concat_ws(' ', pp.nombres, pp.apellidos) AS paciente,
    pr.matricula,
    concat_ws(' ', ppr.nombres, ppr.apellidos) AS profesional,
    e.nombre AS especialidad,
    s.codigo AS salita_codigo,
    s.nombre AS salita,
    t.motivo_consulta
FROM public.turnos t
JOIN public.estados_turno et ON et.id_estado = t.id_estado
JOIN public.pacientes p ON p.id_paciente = t.id_paciente
JOIN public.personas pp ON pp.id_persona = p.id_persona
JOIN public.profesionales pr ON pr.id_profesional = t.id_profesional
JOIN public.personas ppr ON ppr.id_persona = pr.id_persona
JOIN public.especialidades e ON e.id_especialidad = t.id_especialidad
JOIN public.salitas s ON s.id_salita = t.id_salita;

-- Resumen diario por salita para reportes del Super Admin.
CREATE OR REPLACE VIEW public.vw_resumen_turnos_diarios AS
SELECT
    t.id_salita,
    s.nombre AS salita,
    (t.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS fecha,
    et.codigo AS estado_codigo,
    COUNT(*) AS cantidad
FROM public.turnos t
JOIN public.salitas s ON s.id_salita = t.id_salita
JOIN public.estados_turno et ON et.id_estado = t.id_estado
GROUP BY t.id_salita, s.nombre,
         (t.fecha_hora_inicio AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
         et.codigo;

/* ========================================================================== */
/* 13. SEGURIDAD PARA USAR SUPABASE SOLO COMO BASE DE DATOS                   */
/* ========================================================================== */

-- Se habilita RLS sin politicas publicas: anon/authenticated no acceden directo.
-- La API debe conectarse mediante una credencial de servidor protegida.
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rol_permisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_refresh ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens_recuperacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens_verificacion_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_identidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zonas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barrios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salita_barrios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_salita ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paciente_tutores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.especialidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profesionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profesional_especialidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profesional_salita ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_atencion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueos_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estados_turno ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sanciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- Reduce permisos directos de clientes web. El backend conserva acceso de servidor.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- service_role es exclusiva del backend y nunca debe enviarse al frontend.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Comprobacion minima: si falla, toda la transaccion se revierte.
DO $$
BEGIN
    IF to_regclass('public.personas') IS NULL THEN
        RAISE EXCEPTION 'Validacion fallida: no se creo public.personas';
    END IF;

    IF (SELECT COUNT(*) FROM public.roles) <> 5 THEN
        RAISE EXCEPTION 'Validacion fallida: se esperaban 5 roles iniciales';
    END IF;
    IF (SELECT COUNT(*) FROM public.estados_turno) <> 7 THEN
        RAISE EXCEPTION 'Validacion fallida: se esperaban 7 estados de turno';
    END IF;
    IF NOT EXISTS (
        SELECT 1
          FROM public.rol_permisos rp
          JOIN public.roles r ON r.id_rol = rp.id_rol
         WHERE r.codigo = 'SUPER_ADMIN'
    ) THEN
        RAISE EXCEPTION 'Validacion fallida: el Super Admin no tiene permisos';
    END IF;
END;
$$;

COMMIT;

/*
===============================================================================
 NOTAS PARA LA API

 1. PERSONAS es la fuente unica para DNI, nombres, apellidos y datos de contacto.
 2. USUARIOS representa cuentas de acceso y puede vincularse opcionalmente con PERSONAS.
 3. Guardar password_hash con Argon2; puede ser NULL solo para cuentas externas como Google.
 4. Antes de operaciones auditables, dentro de la misma transaccion ejecutar:
      SELECT set_config('app.current_user_id', '<uuid>', true);
      SELECT set_config('app.current_salita_id', '<uuid>', true);
      SELECT set_config('app.client_ip', '<ip>', true);
 5. El Super Admin se identifica por rol y no necesita usuario_salita.
 6. Admin y Recepcion deben filtrarse por sus registros activos en usuario_salita.
 7. La disponibilidad se calcula con horarios_atencion, bloqueos_agenda y turnos.
 8. No se incluye derivacion ni autorizacion entre salitas, segun alcance acordado.
 9. Crear el primer Super Admin desde un script seguro del backend.
10. Crear/actualizar persona + perfil relacionado desde la API de forma transaccional cuando corresponda.

 CONSULTAS MANUALES DE VERIFICACION DESPUES DE EJECUTAR

 SELECT COUNT(*) AS tablas_creadas
 FROM information_schema.tables
 WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

 SELECT codigo, nombre FROM public.roles ORDER BY nombre;
 SELECT codigo, nombre, ocupa_agenda FROM public.estados_turno ORDER BY orden;
 SELECT r.codigo AS rol, COUNT(*) AS permisos
 FROM public.roles r
 LEFT JOIN public.rol_permisos rp ON rp.id_rol = r.id_rol
 GROUP BY r.codigo ORDER BY r.codigo;
===============================================================================
*/
