-- Aplicar manualmente sobre la base existente después de SAPS_Turno_BBDD3_FINAL.sql
-- y las migraciones previas (20261031_solicitudes_vinculacion.sql y 20261109_profesional_salita_vigencia.sql).
-- No modifica tablas ni registros existentes y no altera migraciones anteriores.

BEGIN;

/* ========================================================================== */
/* 1. PERMISOS CLÍNICOS Y ASIGNACIÓN IDEMPOTENTE AL ROL PROFESIONAL          */
/* ========================================================================== */

INSERT INTO public.permisos (codigo, nombre, descripcion)
VALUES
    ('VER_HISTORIA_CLINICA', 'Ver historia clínica', 'Consulta de la historia clínica de pacientes autorizados según alcance.'),
    ('CREAR_CONSULTA_CLINICA', 'Crear consulta clínica', 'Registro, firma y anulación de borradores de consultas médicas.'),
    ('GESTIONAR_ANTECEDENTES_CLINICOS', 'Gestionar antecedentes clínicos', 'Registro y actualización de antecedentes clínicos y alergias del paciente.'),
    ('REGISTRAR_DIAGNOSTICOS', 'Registrar diagnósticos', 'Registro y actualización de diagnósticos asociados a consultas médicas.'),
    ('REGISTRAR_EVOLUCIONES', 'Registrar evoluciones', 'Registro y rectificación trazable de evoluciones clínicas.'),
    ('GESTIONAR_TRATAMIENTOS', 'Gestionar tratamientos', 'Prescripción y seguimiento de tratamientos clínicos.'),
    ('GESTIONAR_ESTUDIOS_CLINICOS', 'Gestionar estudios clínicos', 'Solicitud, cambio de estado e informe de resultados de estudios clínicos.'),
    ('VER_AUDITORIA_CLINICA', 'Ver auditoría clínica', 'Consulta del registro inmutable de accesos y operaciones clínicas.'),
    ('GESTIONAR_DERIVACIONES_CLINICAS', 'Gestionar derivaciones clínicas', 'Solicitud, autorización, rechazo y revocación de derivaciones o autorizaciones entre salitas.')
ON CONFLICT (codigo) DO NOTHING;

-- Solo se asignan los permisos operativos asistenciales al rol PROFESIONAL.
-- ADMIN_SALITA, RECEPCION y SUPER_ADMIN no reciben lectura clínica automática.
-- VER_AUDITORIA_CLINICA tampoco se asigna automáticamente para preservar separación de funciones.
INSERT INTO public.rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
  FROM public.roles r
  JOIN public.permisos p
    ON p.codigo IN (
        'VER_HISTORIA_CLINICA',
        'CREAR_CONSULTA_CLINICA',
        'GESTIONAR_ANTECEDENTES_CLINICOS',
        'REGISTRAR_DIAGNOSTICOS',
        'REGISTRAR_EVOLUCIONES',
        'GESTIONAR_TRATAMIENTOS',
        'GESTIONAR_ESTUDIOS_CLINICOS',
        'GESTIONAR_DERIVACIONES_CLINICAS'
    )
 WHERE r.codigo = 'PROFESIONAL'
   AND p.activo
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

/* ========================================================================== */
/* 2. FUNCIONES AUXILIARES DE INMUTABILIDAD                                   */
/* ========================================================================== */

CREATE OR REPLACE FUNCTION public.impedir_eliminacion_clinica()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'No se permite eliminar físicamente registros clínicos o de auditoría clínica (%).', TG_TABLE_NAME;
END;
$$;

/* ========================================================================== */
/* 3. MODELO CLÍNICO LONGITUDINAL                                             */
/* ========================================================================== */

-- 3.1 Expediente único por paciente (relación 1:1 con public.pacientes).
CREATE TABLE IF NOT EXISTS public.historias_clinicas (
    id_historia_clinica     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_paciente             UUID NOT NULL UNIQUE
                            REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    estado                  VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
    observaciones_generales TEXT,
    creado_por              UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    fecha_apertura          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_hc_estado CHECK (estado IN ('ACTIVA', 'INACTIVA', 'ARCHIVADA'))
);

CREATE INDEX IF NOT EXISTS ix_historias_clinicas_estado
    ON public.historias_clinicas (estado) WHERE estado = 'ACTIVA';

-- 3.2 Autorizaciones y derivaciones clínicas entre salitas con alcance explícito.
CREATE TABLE IF NOT EXISTS public.derivaciones_autorizaciones_clinicas (
    id_derivacion               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo                        VARCHAR(30) NOT NULL DEFAULT 'DERIVACION',
    alcance                     VARCHAR(30) NOT NULL DEFAULT 'ESPECIALIDAD',
    id_paciente                 UUID NOT NULL
                                REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    id_salita_origen            UUID NOT NULL
                                REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    id_salita_destino           UUID NOT NULL
                                REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    id_profesional_destino      UUID REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    id_especialidad_destino     UUID REFERENCES public.especialidades(id_especialidad) ON DELETE RESTRICT,
    motivo                      TEXT NOT NULL,
    fecha_desde                 DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_hasta                 DATE NOT NULL,
    estado                      VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    id_usuario_solicita         UUID NOT NULL
                                REFERENCES public.usuarios(id_usuario) ON DELETE RESTRICT,
    id_profesional_solicita     UUID REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    id_usuario_autoriza         UUID REFERENCES public.usuarios(id_usuario) ON DELETE RESTRICT,
    fecha_resolucion            TIMESTAMPTZ,
    motivo_resolucion           TEXT,
    id_usuario_revoca           UUID REFERENCES public.usuarios(id_usuario) ON DELETE RESTRICT,
    fecha_revocacion            TIMESTAMPTZ,
    motivo_revocacion           TEXT,
    fecha_creacion              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_derivacion_tipo
        CHECK (tipo IN ('DERIVACION', 'AUTORIZACION_ACCESO')),
    CONSTRAINT ck_derivacion_alcance
        CHECK (alcance IN ('PROFESIONAL', 'ESPECIALIDAD', 'LONGITUDINAL')),
    CONSTRAINT ck_derivacion_alcance_coherencia
        CHECK (
            (alcance = 'PROFESIONAL' AND id_profesional_destino IS NOT NULL)
            OR (alcance = 'ESPECIALIDAD' AND id_especialidad_destino IS NOT NULL)
            OR (alcance = 'LONGITUDINAL' AND tipo = 'AUTORIZACION_ACCESO'
                AND id_profesional_destino IS NOT NULL AND id_especialidad_destino IS NULL)
        ),
    CONSTRAINT ck_derivacion_salitas_distintas
        CHECK (id_salita_origen <> id_salita_destino),
    CONSTRAINT ck_derivacion_destinatario
        CHECK (id_profesional_destino IS NOT NULL OR id_especialidad_destino IS NOT NULL),
    CONSTRAINT ck_derivacion_motivo
        CHECK (char_length(trim(motivo)) >= 5),
    CONSTRAINT ck_derivacion_fechas
        CHECK (fecha_hasta >= fecha_desde),
    CONSTRAINT ck_derivacion_estado
        CHECK (estado IN ('PENDIENTE', 'AUTORIZADA', 'RECHAZADA', 'REVOCADA', 'VENCIDA')),
    CONSTRAINT ck_derivacion_resolucion
        CHECK (
            (estado = 'PENDIENTE' AND id_usuario_autoriza IS NULL AND fecha_resolucion IS NULL AND motivo_resolucion IS NULL)
            OR (estado IN ('AUTORIZADA', 'RECHAZADA', 'REVOCADA') AND id_usuario_autoriza IS NOT NULL AND fecha_resolucion IS NOT NULL)
            OR (estado = 'VENCIDA')
        ),
    CONSTRAINT ck_derivacion_rechazo
        CHECK (
            estado <> 'RECHAZADA'
            OR NULLIF(trim(motivo_resolucion), '') IS NOT NULL
        ),
    CONSTRAINT ck_derivacion_revocacion
        CHECK (
            (estado = 'REVOCADA' AND id_usuario_revoca IS NOT NULL AND fecha_revocacion IS NOT NULL AND NULLIF(trim(motivo_revocacion), '') IS NOT NULL)
            OR (estado <> 'REVOCADA' AND id_usuario_revoca IS NULL AND fecha_revocacion IS NULL AND motivo_revocacion IS NULL)
        )
);

CREATE INDEX IF NOT EXISTS ix_derivaciones_paciente_destino
    ON public.derivaciones_autorizaciones_clinicas (id_paciente, id_salita_destino, estado, alcance, fecha_desde, fecha_hasta);
CREATE INDEX IF NOT EXISTS ix_derivaciones_profesional_destino
    ON public.derivaciones_autorizaciones_clinicas (id_profesional_destino, estado, fecha_hasta)
    WHERE id_profesional_destino IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_derivaciones_salita_origen
    ON public.derivaciones_autorizaciones_clinicas (id_salita_origen, estado, fecha_creacion DESC);

-- Trazabilidad histórica inmutable de cambios en derivaciones/autorizaciones.
CREATE TABLE IF NOT EXISTS public.derivaciones_autorizaciones_historial (
    id_historial        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_derivacion       UUID NOT NULL
                        REFERENCES public.derivaciones_autorizaciones_clinicas(id_derivacion) ON DELETE RESTRICT,
    id_usuario_actor    UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    accion              VARCHAR(10) NOT NULL,
    estado_anterior     VARCHAR(20),
    estado_nuevo        VARCHAR(20) NOT NULL,
    datos_anteriores    JSONB,
    datos_nuevos        JSONB NOT NULL,
    fecha               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_derivaciones_hist_accion CHECK (accion IN ('INSERT', 'UPDATE'))
);

CREATE INDEX IF NOT EXISTS ix_derivaciones_hist_derivacion
    ON public.derivaciones_autorizaciones_historial (id_derivacion, fecha DESC);

-- 3.3 Antecedentes clínicos (personales y familiares).
CREATE TABLE IF NOT EXISTS public.antecedentes_clinicos (
    id_antecedente          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_historia_clinica     UUID NOT NULL
                            REFERENCES public.historias_clinicas(id_historia_clinica) ON DELETE RESTRICT,
    id_paciente             UUID NOT NULL
                            REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    tipo                    VARCHAR(30) NOT NULL,
    categoria               VARCHAR(100),
    descripcion             TEXT NOT NULL,
    fecha_antecedente       DATE NOT NULL DEFAULT CURRENT_DATE,
    estado                  VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    id_profesional_autor    UUID NOT NULL
                            REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    id_salita_registro      UUID REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_antecedente_tipo
        CHECK (tipo IN ('PERSONAL', 'FAMILIAR', 'QUIRURGICO', 'PATOLOGICO', 'GINECOLOGICO', 'OTRO')),
    CONSTRAINT ck_antecedente_descripcion
        CHECK (char_length(trim(descripcion)) > 0),
    CONSTRAINT ck_antecedente_estado
        CHECK (estado IN ('ACTIVO', 'RESUELTO', 'INACTIVO', 'ANULADO'))
);

CREATE INDEX IF NOT EXISTS ix_antecedentes_historia_fecha
    ON public.antecedentes_clinicos (id_historia_clinica, fecha_antecedente DESC);
CREATE INDEX IF NOT EXISTS ix_antecedentes_paciente_tipo
    ON public.antecedentes_clinicos (id_paciente, tipo, estado);

-- 3.4 Alergias del paciente.
CREATE TABLE IF NOT EXISTS public.alergias_paciente (
    id_alergia              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_historia_clinica     UUID NOT NULL
                            REFERENCES public.historias_clinicas(id_historia_clinica) ON DELETE RESTRICT,
    id_paciente             UUID NOT NULL
                            REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    alergeno                VARCHAR(150) NOT NULL,
    tipo_reaccion           VARCHAR(150) NOT NULL,
    gravedad                VARCHAR(20) NOT NULL,
    observaciones           TEXT,
    estado                  VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
    fecha_deteccion         DATE,
    id_profesional_autor    UUID NOT NULL
                            REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    id_salita_registro      UUID REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_alergia_alergeno
        CHECK (char_length(trim(alergeno)) > 0),
    CONSTRAINT ck_alergia_reaccion
        CHECK (char_length(trim(tipo_reaccion)) > 0),
    CONSTRAINT ck_alergia_gravedad
        CHECK (gravedad IN ('LEVE', 'MODERADA', 'GRAVE', 'DESCONOCIDA')),
    CONSTRAINT ck_alergia_estado
        CHECK (estado IN ('ACTIVA', 'RESUELTA', 'DESCARTADA', 'ANULADA'))
);

CREATE INDEX IF NOT EXISTS ix_alergias_historia_estado
    ON public.alergias_paciente (id_historia_clinica, estado, gravedad);
CREATE INDEX IF NOT EXISTS ix_alergias_paciente
    ON public.alergias_paciente (id_paciente, estado);

-- 3.5 Consultas médicas (con turno opcional o atención espontánea).
CREATE TABLE IF NOT EXISTS public.consultas_medicas (
    id_consulta             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_historia_clinica     UUID NOT NULL
                            REFERENCES public.historias_clinicas(id_historia_clinica) ON DELETE RESTRICT,
    id_paciente             UUID NOT NULL
                            REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    id_profesional          UUID NOT NULL
                            REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    id_especialidad         UUID NOT NULL
                            REFERENCES public.especialidades(id_especialidad) ON DELETE RESTRICT,
    id_salita               UUID NOT NULL
                            REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    id_turno                UUID UNIQUE
                            REFERENCES public.turnos(id_turno) ON DELETE RESTRICT,
    id_autorizacion_clinica UUID
                            REFERENCES public.derivaciones_autorizaciones_clinicas(id_derivacion) ON DELETE RESTRICT,
    acompanante_tutor_id    UUID REFERENCES public.tutores(id_tutor) ON DELETE RESTRICT,
    tutor_verificado        BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_atencion          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    motivo_consulta         TEXT NOT NULL,
    sintomas                TEXT,
    examen_fisico           TEXT,
    observaciones           TEXT,
    estado                  VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
    firmada_en              TIMESTAMPTZ,
    motivo_anulacion        TEXT,
    anulada_en              TIMESTAMPTZ,
    id_profesional_autor    UUID NOT NULL
                            REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    version                 INTEGER NOT NULL DEFAULT 1,
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_consulta_motivo
        CHECK (char_length(trim(motivo_consulta)) > 0),
    CONSTRAINT ck_consulta_estado
        CHECK (estado IN ('BORRADOR', 'FIRMADA', 'ANULADA')),
    CONSTRAINT ck_consulta_firma
        CHECK (
            (estado = 'FIRMADA' AND firmada_en IS NOT NULL AND anulada_en IS NULL AND motivo_anulacion IS NULL)
            OR (estado = 'BORRADOR' AND firmada_en IS NULL AND anulada_en IS NULL AND motivo_anulacion IS NULL)
            OR (estado = 'ANULADA' AND firmada_en IS NULL AND anulada_en IS NOT NULL AND NULLIF(trim(motivo_anulacion), '') IS NOT NULL)
        ),
    CONSTRAINT ck_consulta_version
        CHECK (version > 0),
    CONSTRAINT ck_consulta_tutor_verificado
        CHECK (acompanante_tutor_id IS NOT NULL OR tutor_verificado = FALSE)
);

CREATE INDEX IF NOT EXISTS ix_consultas_historia_fecha
    ON public.consultas_medicas (id_historia_clinica, fecha_atencion DESC);
CREATE INDEX IF NOT EXISTS ix_consultas_paciente_fecha
    ON public.consultas_medicas (id_paciente, fecha_atencion DESC);
CREATE INDEX IF NOT EXISTS ix_consultas_profesional_fecha
    ON public.consultas_medicas (id_profesional, fecha_atencion DESC);
CREATE INDEX IF NOT EXISTS ix_consultas_salita_fecha
    ON public.consultas_medicas (id_salita, fecha_atencion DESC);

-- 3.6 Diagnósticos clínicos.
CREATE TABLE IF NOT EXISTS public.diagnosticos_clinicos (
    id_diagnostico          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_consulta             UUID NOT NULL
                            REFERENCES public.consultas_medicas(id_consulta) ON DELETE RESTRICT,
    id_historia_clinica     UUID NOT NULL
                            REFERENCES public.historias_clinicas(id_historia_clinica) ON DELETE RESTRICT,
    id_paciente             UUID NOT NULL
                            REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    codigo                  VARCHAR(30),
    descripcion             VARCHAR(300) NOT NULL,
    tipo                    VARCHAR(20) NOT NULL DEFAULT 'PRESUNTIVO',
    fecha_diagnostico       DATE NOT NULL DEFAULT CURRENT_DATE,
    observaciones           TEXT,
    estado                  VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    id_profesional_autor    UUID NOT NULL
                            REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_diagnostico_descripcion
        CHECK (char_length(trim(descripcion)) > 0),
    CONSTRAINT ck_diagnostico_tipo
        CHECK (tipo IN ('PRESUNTIVO', 'CONFIRMADO', 'DIFERENCIAL', 'PRINCIPAL', 'SECUNDARIO', 'DESCARTADO')),
    CONSTRAINT ck_diagnostico_estado
        CHECK (estado IN ('ACTIVO', 'RESUELTO', 'DESCARTADO', 'ANULADO'))
);

CREATE INDEX IF NOT EXISTS ix_diagnosticos_consulta
    ON public.diagnosticos_clinicos (id_consulta);
CREATE INDEX IF NOT EXISTS ix_diagnosticos_historia_fecha
    ON public.diagnosticos_clinicos (id_historia_clinica, fecha_diagnostico DESC);

-- 3.7 Evoluciones clínicas con versionado lineal y rectificaciones trazables.
CREATE TABLE IF NOT EXISTS public.evoluciones_clinicas (
    id_evolucion                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_consulta                 UUID NOT NULL
                                REFERENCES public.consultas_medicas(id_consulta) ON DELETE RESTRICT,
    id_historia_clinica         UUID NOT NULL
                                REFERENCES public.historias_clinicas(id_historia_clinica) ON DELETE RESTRICT,
    id_paciente                 UUID NOT NULL
                                REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    evolucion                   TEXT NOT NULL,
    observaciones               TEXT,
    id_profesional_responsable  UUID NOT NULL
                                REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    fecha_evolucion             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version                     INTEGER NOT NULL DEFAULT 1,
    es_correccion               BOOLEAN NOT NULL DEFAULT FALSE,
    id_evolucion_origen         UUID REFERENCES public.evoluciones_clinicas(id_evolucion) ON DELETE RESTRICT,
    motivo_correccion           TEXT,
    estado                      VARCHAR(20) NOT NULL DEFAULT 'FIRMADA',
    firmada_en                  TIMESTAMPTZ,
    fecha_creacion              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_evolucion_texto
        CHECK (char_length(trim(evolucion)) > 0),
    CONSTRAINT ck_evolucion_version
        CHECK (version > 0),
    CONSTRAINT ck_evolucion_estado
        CHECK (estado IN ('BORRADOR', 'FIRMADA', 'RECTIFICADA', 'ANULADA')),
    CONSTRAINT ck_evolucion_firma
        CHECK (
            (estado IN ('FIRMADA', 'RECTIFICADA') AND firmada_en IS NOT NULL)
            OR (estado IN ('BORRADOR', 'ANULADA') AND firmada_en IS NULL)
        ),
    CONSTRAINT ck_evolucion_correccion
        CHECK (
            (es_correccion = FALSE AND id_evolucion_origen IS NULL AND motivo_correccion IS NULL)
            OR (es_correccion = TRUE AND id_evolucion_origen IS NOT NULL AND NULLIF(trim(motivo_correccion), '') IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS ix_evoluciones_consulta_version
    ON public.evoluciones_clinicas (id_consulta, version DESC, fecha_evolucion DESC);
CREATE INDEX IF NOT EXISTS ix_evoluciones_historia_fecha
    ON public.evoluciones_clinicas (id_historia_clinica, fecha_evolucion DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_evoluciones_origen_unico
    ON public.evoluciones_clinicas (id_evolucion_origen)
    WHERE id_evolucion_origen IS NOT NULL;

-- 3.8 Tratamientos clínicos.
CREATE TABLE IF NOT EXISTS public.tratamientos_clinicos (
    id_tratamiento              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_consulta                 UUID NOT NULL
                                REFERENCES public.consultas_medicas(id_consulta) ON DELETE RESTRICT,
    id_historia_clinica         UUID NOT NULL
                                REFERENCES public.historias_clinicas(id_historia_clinica) ON DELETE RESTRICT,
    id_paciente                 UUID NOT NULL
                                REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    medicacion                  VARCHAR(200) NOT NULL,
    dosis                       VARCHAR(120) NOT NULL,
    frecuencia                  VARCHAR(120) NOT NULL,
    duracion                    VARCHAR(120),
    indicaciones                TEXT,
    fecha_inicio                DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin                   DATE,
    estado                      VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    id_profesional_responsable  UUID NOT NULL
                                REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    fecha_creacion              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_tratamiento_medicacion
        CHECK (char_length(trim(medicacion)) > 0),
    CONSTRAINT ck_tratamiento_dosis
        CHECK (char_length(trim(dosis)) > 0),
    CONSTRAINT ck_tratamiento_frecuencia
        CHECK (char_length(trim(frecuencia)) > 0),
    CONSTRAINT ck_tratamiento_fechas
        CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
    CONSTRAINT ck_tratamiento_estado
        CHECK (estado IN ('ACTIVO', 'FINALIZADO', 'SUSPENDIDO', 'ANULADO'))
);

CREATE INDEX IF NOT EXISTS ix_tratamientos_consulta
    ON public.tratamientos_clinicos (id_consulta);
CREATE INDEX IF NOT EXISTS ix_tratamientos_historia_fecha
    ON public.tratamientos_clinicos (id_historia_clinica, fecha_inicio DESC);

-- 3.9 Estudios clínicos.
CREATE TABLE IF NOT EXISTS public.estudios_clinicos (
    id_estudio                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_consulta                 UUID NOT NULL
                                REFERENCES public.consultas_medicas(id_consulta) ON DELETE RESTRICT,
    id_historia_clinica         UUID NOT NULL
                                REFERENCES public.historias_clinicas(id_historia_clinica) ON DELETE RESTRICT,
    id_paciente                 UUID NOT NULL
                                REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    tipo_estudio                VARCHAR(120) NOT NULL,
    descripcion                 TEXT NOT NULL,
    fecha_solicitud             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resultado                   TEXT,
    fecha_resultado             TIMESTAMPTZ,
    estado                      VARCHAR(20) NOT NULL DEFAULT 'SOLICITADO',
    id_profesional_solicitante  UUID NOT NULL
                                REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    id_profesional_informa      UUID REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    fecha_creacion              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_estudio_tipo
        CHECK (char_length(trim(tipo_estudio)) > 0),
    CONSTRAINT ck_estudio_descripcion
        CHECK (char_length(trim(descripcion)) > 0),
    CONSTRAINT ck_estudio_estado
        CHECK (estado IN ('SOLICITADO', 'EN_PROCESO', 'COMPLETADO', 'CANCELADO')),
    CONSTRAINT ck_estudio_resultado
        CHECK (
            (estado = 'COMPLETADO' AND NULLIF(trim(resultado), '') IS NOT NULL AND fecha_resultado IS NOT NULL AND id_profesional_informa IS NOT NULL)
            OR (estado <> 'COMPLETADO' AND resultado IS NULL AND fecha_resultado IS NULL AND id_profesional_informa IS NULL)
        )
);

CREATE INDEX IF NOT EXISTS ix_estudios_consulta
    ON public.estudios_clinicos (id_consulta);
CREATE INDEX IF NOT EXISTS ix_estudios_historia_fecha
    ON public.estudios_clinicos (id_historia_clinica, fecha_solicitud DESC);

/* ========================================================================== */
/* 4. AUDITORÍA CLÍNICA INMUTABLE E INDEPENDIENTE                             */
/* ========================================================================== */

-- Registra fecha del acceso (fecha_hora) y fecha del acto clínico (fecha_acto_clinico) por separado.
CREATE TABLE IF NOT EXISTS public.auditoria_clinica (
    id_auditoria_clinica    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario              UUID NOT NULL
                            REFERENCES public.usuarios(id_usuario) ON DELETE RESTRICT,
    id_profesional          UUID REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    id_paciente             UUID NOT NULL
                            REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    id_historia_clinica     UUID REFERENCES public.historias_clinicas(id_historia_clinica) ON DELETE RESTRICT,
    id_salita               UUID NOT NULL
                            REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    tipo_operacion          VARCHAR(20) NOT NULL,
    recurso                 VARCHAR(60) NOT NULL DEFAULT 'HISTORIA_CLINICA',
    id_recurso              UUID,
    alcance_acceso          VARCHAR(30),
    fecha_acto_clinico      DATE,
    motivo_acceso           TEXT NOT NULL,
    id_derivacion           UUID REFERENCES public.derivaciones_autorizaciones_clinicas(id_derivacion) ON DELETE RESTRICT,
    ip_origen               INET,
    fecha_hora              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_auditoria_clinica_operacion
        CHECK (tipo_operacion IN ('CONSULTA', 'CREACION', 'MODIFICACION', 'CORRECCION', 'EXPORTACION')),
    CONSTRAINT ck_auditoria_clinica_alcance
        CHECK (alcance_acceso IS NULL OR alcance_acceso IN ('SALITA_ASIGNADA', 'PROFESIONAL', 'ESPECIALIDAD', 'LONGITUDINAL', 'ADMINISTRATIVO')),
    CONSTRAINT ck_auditoria_clinica_motivo
        CHECK (char_length(trim(motivo_acceso)) >= 3)
);

CREATE INDEX IF NOT EXISTS ix_auditoria_clinica_paciente_fecha
    ON public.auditoria_clinica (id_paciente, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS ix_auditoria_clinica_usuario_fecha
    ON public.auditoria_clinica (id_usuario, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS ix_auditoria_clinica_salita_fecha
    ON public.auditoria_clinica (id_salita, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS ix_auditoria_clinica_profesional_fecha
    ON public.auditoria_clinica (id_profesional, fecha_hora DESC)
    WHERE id_profesional IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_auditoria_clinica_derivacion
    ON public.auditoria_clinica (id_derivacion)
    WHERE id_derivacion IS NOT NULL;

-- Tabla separada e inmutable para auditar lecturas sobre auditoria_clinica sin recursión ni nulos en id_paciente.
CREATE TABLE IF NOT EXISTS public.auditoria_accesos_auditoria (
    id_acceso_auditoria     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario              UUID NOT NULL
                            REFERENCES public.usuarios(id_usuario) ON DELETE RESTRICT,
    rol_usuario             VARCHAR(50) NOT NULL,
    id_salita               UUID REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    id_paciente_filtrado    UUID REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    filtros                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_origen               INET,
    fecha_hora              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_auditoria_acc_aud_usuario
    ON public.auditoria_accesos_auditoria (id_usuario, fecha_hora DESC);

CREATE OR REPLACE FUNCTION public.inmutabilidad_auditoria_clinica()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Los registros de auditoría clínica (%) son inmutables y no admiten modificación ni eliminación.', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS tr_auditoria_clinica_inmutable ON public.auditoria_clinica;
CREATE TRIGGER tr_auditoria_clinica_inmutable
BEFORE UPDATE OR DELETE ON public.auditoria_clinica
FOR EACH ROW EXECUTE FUNCTION public.inmutabilidad_auditoria_clinica();

DROP TRIGGER IF EXISTS tr_auditoria_acc_aud_inmutable ON public.auditoria_accesos_auditoria;
CREATE TRIGGER tr_auditoria_acc_aud_inmutable
BEFORE UPDATE OR DELETE ON public.auditoria_accesos_auditoria
FOR EACH ROW EXECUTE FUNCTION public.inmutabilidad_auditoria_clinica();

/* ========================================================================== */
/* 5. TRIGGERS DE VALIDACIÓN, INMUTABILIDAD, CONSISTENCIA Y AUDITORÍA         */
/* ========================================================================== */

-- 5.1 Derivaciones entre salitas: valida salita origen, destinatarios y protege periodo/datos en UPDATE.
CREATE OR REPLACE FUNCTION public.validar_derivacion_clinica()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_salita_paciente   UUID;
    v_today             DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
BEGIN
    SELECT pa.id_salita_asignada INTO v_salita_paciente
      FROM public.pacientes pa
     WHERE pa.id_paciente = NEW.id_paciente
       AND pa.activo;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El paciente de la derivación no existe o está inactivo';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.id_salita_origen <> v_salita_paciente THEN
            RAISE EXCEPTION 'La salita de origen de la derivación debe coincidir con la salita asignada del paciente';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.salitas s WHERE s.id_salita = NEW.id_salita_origen AND s.activo)
           OR NOT EXISTS (SELECT 1 FROM public.salitas s WHERE s.id_salita = NEW.id_salita_destino AND s.activo) THEN
            RAISE EXCEPTION 'La salita de origen y destino deben existir y estar activas';
        END IF;

        IF NEW.id_profesional_destino IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1
                  FROM public.profesionales pr
                  JOIN public.profesional_salita ps ON ps.id_profesional = pr.id_profesional
                 WHERE pr.id_profesional = NEW.id_profesional_destino
                   AND pr.activo
                   AND ps.id_salita = NEW.id_salita_destino
                   AND ps.activo
                   AND ps.fecha_desde <= NEW.fecha_hasta
                   AND (ps.fecha_hasta IS NULL OR ps.fecha_hasta >= NEW.fecha_desde)
            ) THEN
                RAISE EXCEPTION 'El profesional destinatario no tiene asociación vigente en la salita destino para el período solicitado';
            END IF;
        END IF;

        IF NEW.id_especialidad_destino IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.especialidades e
                 WHERE e.id_especialidad = NEW.id_especialidad_destino AND e.activo
            ) THEN
                RAISE EXCEPTION 'La especialidad destinataria no existe o está inactiva';
            END IF;

            IF NEW.id_profesional_destino IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM public.profesional_especialidad pe
                 WHERE pe.id_profesional = NEW.id_profesional_destino
                   AND pe.id_especialidad = NEW.id_especialidad_destino
                   AND pe.activo
                   AND pe.fecha_desde <= NEW.fecha_hasta
                   AND (pe.fecha_hasta IS NULL OR pe.fecha_hasta >= NEW.fecha_desde)
            ) THEN
                RAISE EXCEPTION 'El profesional destinatario no posee la especialidad solicitada vigente en el período';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    -- UPDATE: impide alterar alcance, fechas (fecha_desde/fecha_hasta), origen, destino o solicitantes.
    IF NEW.tipo IS DISTINCT FROM OLD.tipo
       OR NEW.alcance IS DISTINCT FROM OLD.alcance
       OR NEW.id_paciente IS DISTINCT FROM OLD.id_paciente
       OR NEW.id_salita_origen IS DISTINCT FROM OLD.id_salita_origen
       OR NEW.id_salita_destino IS DISTINCT FROM OLD.id_salita_destino
       OR NEW.id_profesional_destino IS DISTINCT FROM OLD.id_profesional_destino
       OR NEW.id_especialidad_destino IS DISTINCT FROM OLD.id_especialidad_destino
       OR NEW.motivo IS DISTINCT FROM OLD.motivo
       OR NEW.fecha_desde IS DISTINCT FROM OLD.fecha_desde
       OR NEW.fecha_hasta IS DISTINCT FROM OLD.fecha_hasta
       OR NEW.id_usuario_solicita IS DISTINCT FROM OLD.id_usuario_solicita
       OR NEW.id_profesional_solicita IS DISTINCT FROM OLD.id_profesional_solicita
       OR NEW.fecha_creacion IS DISTINCT FROM OLD.fecha_creacion THEN
        RAISE EXCEPTION 'No se pueden alterar los datos base, alcance ni vigencia de una derivación o autorización clínica';
    END IF;

    IF OLD.estado IN ('RECHAZADA', 'REVOCADA', 'VENCIDA') THEN
        RAISE EXCEPTION 'Una derivación en estado % es definitiva y no admite modificaciones', OLD.estado;
    END IF;

    IF OLD.estado = 'PENDIENTE' THEN
        IF NEW.estado NOT IN ('AUTORIZADA', 'RECHAZADA', 'VENCIDA') THEN
            RAISE EXCEPTION 'Transición de derivación inválida desde PENDIENTE hacia %', NEW.estado;
        END IF;
        IF NEW.estado = 'AUTORIZADA' THEN
            IF NEW.fecha_hasta < v_today THEN
                RAISE EXCEPTION 'No puede autorizarse una derivación cuya fecha_hasta ya venció';
            END IF;
            IF NEW.id_usuario_autoriza = OLD.id_usuario_solicita THEN
                RAISE EXCEPTION 'El usuario que solicita una derivación no puede autoautorizarla';
            END IF;
            IF NEW.id_usuario_revoca IS NOT NULL OR NEW.fecha_revocacion IS NOT NULL OR NEW.motivo_revocacion IS NOT NULL THEN
                RAISE EXCEPTION 'Una autorización no puede incluir datos de revocación';
            END IF;
        ELSIF NEW.estado = 'VENCIDA' THEN
            IF NEW.id_usuario_autoriza IS NOT NULL OR NEW.fecha_resolucion IS NOT NULL OR NEW.motivo_resolucion IS NOT NULL THEN
                RAISE EXCEPTION 'Una solicitud vencida sin resolver no puede registrar autorizador';
            END IF;
        END IF;
    ELSIF OLD.estado = 'AUTORIZADA' THEN
        IF NEW.estado NOT IN ('REVOCADA', 'VENCIDA') THEN
            RAISE EXCEPTION 'Transición de derivación inválida desde AUTORIZADA hacia %', NEW.estado;
        END IF;
        IF NEW.id_usuario_autoriza IS DISTINCT FROM OLD.id_usuario_autoriza
           OR NEW.fecha_resolucion IS DISTINCT FROM OLD.fecha_resolucion
           OR NEW.motivo_resolucion IS DISTINCT FROM OLD.motivo_resolucion THEN
            RAISE EXCEPTION 'No puede alterarse el registro original de autorización';
        END IF;
    END IF;

    IF NEW.estado = 'VENCIDA' AND NEW.fecha_hasta >= v_today THEN
        RAISE EXCEPTION 'Solo puede marcarse como VENCIDA una derivación cuya vigencia haya finalizado';
    END IF;

    RETURN NEW;
END;
$$;

-- 5.2 Consistencia entre historia clínica y paciente.
CREATE OR REPLACE FUNCTION public.validar_consistencia_historia_clinica()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_hc RECORD;
BEGIN
    SELECT hc.id_paciente, hc.estado INTO v_hc
      FROM public.historias_clinicas hc
     WHERE hc.id_historia_clinica = NEW.id_historia_clinica;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La historia clínica referenciada no existe';
    END IF;

    IF v_hc.id_paciente <> NEW.id_paciente THEN
        RAISE EXCEPTION 'Inconsistencia clínica: la historia clínica no corresponde al paciente indicado';
    END IF;

    IF TG_OP = 'INSERT' AND v_hc.estado <> 'ACTIVA' THEN
        RAISE EXCEPTION 'La historia clínica no se encuentra activa';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.id_historia_clinica IS DISTINCT FROM OLD.id_historia_clinica
           OR NEW.id_paciente IS DISTINCT FROM OLD.id_paciente
           OR NEW.fecha_creacion IS DISTINCT FROM OLD.fecha_creacion THEN
            RAISE EXCEPTION 'No se puede reasignar la historia clínica, el paciente ni la fecha de creación';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.proteger_autoria_antecedente_alergia()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NEW.id_profesional_autor IS DISTINCT FROM OLD.id_profesional_autor
       OR NEW.id_salita_registro IS DISTINCT FROM OLD.id_salita_registro THEN
        RAISE EXCEPTION 'No se puede alterar el profesional autor ni la salita de registro original';
    END IF;
    RETURN NEW;
END;
$$;

-- 5.3 Consistencia de detalles dependientes de consultas_medicas (incluye coherencia de evoluciones con estado de consulta).
CREATE OR REPLACE FUNCTION public.validar_consistencia_detalle_consulta()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_consulta RECORD;
BEGIN
    SELECT id_historia_clinica, id_paciente, estado
      INTO v_consulta
      FROM public.consultas_medicas
     WHERE id_consulta = NEW.id_consulta;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La consulta médica referenciada no existe';
    END IF;

    IF v_consulta.id_historia_clinica <> NEW.id_historia_clinica
       OR v_consulta.id_paciente <> NEW.id_paciente THEN
        RAISE EXCEPTION 'Inconsistencia clínica: el detalle no coincide con la consulta, historia o paciente';
    END IF;

    IF TG_OP = 'INSERT' AND v_consulta.estado = 'ANULADA' THEN
        RAISE EXCEPTION 'No se pueden agregar registros clínicos a una consulta médica anulada';
    END IF;

    IF TG_TABLE_NAME = 'evoluciones_clinicas' THEN
        IF NEW.estado IN ('FIRMADA', 'RECTIFICADA') AND v_consulta.estado <> 'FIRMADA' THEN
            RAISE EXCEPTION 'No pueden existir evoluciones firmadas o rectificadas sobre una consulta que no esté FIRMADA';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.id_consulta IS DISTINCT FROM OLD.id_consulta
           OR NEW.id_historia_clinica IS DISTINCT FROM OLD.id_historia_clinica
           OR NEW.id_paciente IS DISTINCT FROM OLD.id_paciente
           OR NEW.fecha_creacion IS DISTINCT FROM OLD.fecha_creacion THEN
            RAISE EXCEPTION 'No se puede reasignar la consulta, historia, paciente ni fecha de creación de un registro clínico';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.proteger_autoria_detalle_consulta()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF TG_TABLE_NAME = 'diagnosticos_clinicos' THEN
        IF NEW.id_profesional_autor IS DISTINCT FROM OLD.id_profesional_autor THEN
            RAISE EXCEPTION 'No se puede alterar el profesional autor del diagnóstico clínico';
        END IF;
    ELSIF TG_TABLE_NAME = 'tratamientos_clinicos' THEN
        IF NEW.id_profesional_responsable IS DISTINCT FROM OLD.id_profesional_responsable THEN
            RAISE EXCEPTION 'No se puede alterar el profesional responsable del tratamiento clínico';
        END IF;
    ELSIF TG_TABLE_NAME = 'estudios_clinicos' THEN
        IF NEW.id_profesional_solicitante IS DISTINCT FROM OLD.id_profesional_solicitante
           OR NEW.tipo_estudio IS DISTINCT FROM OLD.tipo_estudio
           OR NEW.descripcion IS DISTINCT FROM OLD.descripcion
           OR NEW.fecha_solicitud IS DISTINCT FROM OLD.fecha_solicitud THEN
            RAISE EXCEPTION 'No se puede alterar el profesional solicitante ni los datos originales de solicitud del estudio clínico';
        END IF;
        IF COALESCE(current_setting('app.operacion_estudio_rpc', TRUE), '') <> 'true' THEN
            RAISE EXCEPTION 'Las actualizaciones de estudios clínicos deben realizarse mediante la RPC autorizada';
        END IF;
        IF OLD.estado IN ('COMPLETADO', 'CANCELADO') THEN
            RAISE EXCEPTION 'Un estudio clínico en estado % no admite modificaciones', OLD.estado;
        END IF;
        IF OLD.estado = 'SOLICITADO' AND NEW.estado NOT IN ('SOLICITADO', 'EN_PROCESO', 'COMPLETADO', 'CANCELADO') THEN
            RAISE EXCEPTION 'Transición de estudio clínico inválida';
        END IF;
        IF OLD.estado = 'EN_PROCESO' AND NEW.estado NOT IN ('EN_PROCESO', 'COMPLETADO', 'CANCELADO') THEN
            RAISE EXCEPTION 'Transición de estudio clínico inválida';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- 5.4 Validación integral de consultas_medicas contra fecha de atención (v_consult_date).
CREATE OR REPLACE FUNCTION public.validar_consulta_medica()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_turno             RECORD;
    v_today             DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
    v_consult_date      DATE := (NEW.fecha_atencion AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
    v_salita_paciente   UUID;
BEGIN
    IF v_consult_date > v_today THEN
        RAISE EXCEPTION 'La fecha de atención de la consulta no puede ser futura';
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

-- 5.5 Firma e inmutabilidad de consultas_medicas con candado transaccional de RPC.
CREATE OR REPLACE FUNCTION public.proteger_consulta_firmada()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF COALESCE(current_setting('app.operacion_consulta_rpc', TRUE), '') <> 'true' THEN
        RAISE EXCEPTION 'Las modificaciones de consultas médicas deben realizarse mediante las RPC autorizadas';
    END IF;

    IF NEW.id_historia_clinica IS DISTINCT FROM OLD.id_historia_clinica
       OR NEW.id_paciente IS DISTINCT FROM OLD.id_paciente
       OR NEW.id_profesional IS DISTINCT FROM OLD.id_profesional
       OR NEW.id_especialidad IS DISTINCT FROM OLD.id_especialidad
       OR NEW.id_salita IS DISTINCT FROM OLD.id_salita
       OR NEW.id_autorizacion_clinica IS DISTINCT FROM OLD.id_autorizacion_clinica
       OR NEW.id_profesional_autor IS DISTINCT FROM OLD.id_profesional_autor
       OR NEW.fecha_creacion IS DISTINCT FROM OLD.fecha_creacion THEN
        RAISE EXCEPTION 'No se pueden alterar el paciente, la salita, la especialidad, la autorización ni la autoría de una consulta médica';
    END IF;

    IF OLD.estado IN ('FIRMADA', 'ANULADA') THEN
        RAISE EXCEPTION 'Una consulta médica en estado % es inmutable y no admite modificaciones', OLD.estado;
    END IF;

    IF OLD.estado = 'BORRADOR' AND NEW.estado NOT IN ('BORRADOR', 'FIRMADA', 'ANULADA') THEN
        RAISE EXCEPTION 'Transición de consulta médica inválida hacia %', NEW.estado;
    END IF;

    IF OLD.estado = 'BORRADOR' AND NEW.estado = 'FIRMADA' THEN
        NEW.firmada_en := COALESCE(NEW.firmada_en, NOW());
    ELSIF OLD.estado = 'BORRADOR' AND NEW.estado = 'ANULADA' THEN
        NEW.anulada_en := COALESCE(NEW.anulada_en, NOW());
        NEW.firmada_en := NULL;
    END IF;

    NEW.version := OLD.version + 1;
    RETURN NEW;
END;
$$;

-- 5.6 Firma e inmutabilidad de evoluciones_clinicas.
CREATE OR REPLACE FUNCTION public.proteger_evolucion_firmada()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NEW.id_consulta IS DISTINCT FROM OLD.id_consulta
       OR NEW.id_historia_clinica IS DISTINCT FROM OLD.id_historia_clinica
       OR NEW.id_paciente IS DISTINCT FROM OLD.id_paciente
       OR NEW.id_profesional_responsable IS DISTINCT FROM OLD.id_profesional_responsable
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.es_correccion IS DISTINCT FROM OLD.es_correccion
       OR NEW.id_evolucion_origen IS DISTINCT FROM OLD.id_evolucion_origen
       OR NEW.motivo_correccion IS DISTINCT FROM OLD.motivo_correccion
       OR NEW.fecha_creacion IS DISTINCT FROM OLD.fecha_creacion THEN
        RAISE EXCEPTION 'No se puede alterar la autoría, versión ni vínculos de una evolución clínica';
    END IF;

    IF OLD.estado IN ('RECTIFICADA', 'ANULADA') THEN
        RAISE EXCEPTION 'Una evolución clínica en estado % es inmutable', OLD.estado;
    END IF;

    IF OLD.estado = 'BORRADOR' THEN
        IF COALESCE(current_setting('app.operacion_consulta_rpc', TRUE), '') <> 'true' THEN
            RAISE EXCEPTION 'Las transiciones de evoluciones en borrador deben realizarse mediante RPC autorizada';
        END IF;
        IF NEW.estado NOT IN ('BORRADOR', 'FIRMADA', 'ANULADA') THEN
            RAISE EXCEPTION 'Transición inválida desde BORRADOR hacia %', NEW.estado;
        END IF;
        IF NEW.estado = 'FIRMADA' THEN
            NEW.firmada_en := COALESCE(NEW.firmada_en, NOW());
        ELSIF NEW.estado = 'ANULADA' THEN
            NEW.firmada_en := NULL;
        END IF;
        RETURN NEW;
    END IF;

    -- OLD.estado = 'FIRMADA'
    IF NEW.estado <> 'RECTIFICADA'
       OR NEW.evolucion IS DISTINCT FROM OLD.evolucion
       OR NEW.observaciones IS DISTINCT FROM OLD.observaciones
       OR NEW.fecha_evolucion IS DISTINCT FROM OLD.fecha_evolucion
       OR NEW.firmada_en IS DISTINCT FROM OLD.firmada_en
       OR COALESCE(current_setting('app.rectificando_evolucion', TRUE), '') <> 'true' THEN
        RAISE EXCEPTION 'Una evolución clínica firmada es inmutable; utilice rectificar_evolucion_clinica para emitir una nueva versión trazable';
    END IF;

    RETURN NEW;
END;
$$;

-- 5.7 Historial automático de derivaciones/autorizaciones.
CREATE OR REPLACE FUNCTION public.registrar_historial_derivacion_clinica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_usuario UUID;
BEGIN
    v_usuario := COALESCE(
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID,
        CASE WHEN TG_OP = 'INSERT' THEN NEW.id_usuario_solicita
             ELSE COALESCE(NEW.id_usuario_revoca, NEW.id_usuario_autoriza, NEW.id_usuario_solicita)
        END
    );

    INSERT INTO public.derivaciones_autorizaciones_historial (
        id_derivacion,
        id_usuario_actor,
        accion,
        estado_anterior,
        estado_nuevo,
        datos_anteriores,
        datos_nuevos
    )
    VALUES (
        NEW.id_derivacion,
        v_usuario,
        TG_OP,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado ELSE NULL END,
        NEW.estado,
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        to_jsonb(NEW)
    );

    RETURN NEW;
END;
$$;

-- Triggers de fecha_actualizacion
DROP TRIGGER IF EXISTS tr_historias_clinicas_fecha ON public.historias_clinicas;
CREATE TRIGGER tr_historias_clinicas_fecha
BEFORE UPDATE ON public.historias_clinicas
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();

DROP TRIGGER IF EXISTS tr_derivaciones_clinicas_fecha ON public.derivaciones_autorizaciones_clinicas;
CREATE TRIGGER tr_derivaciones_clinicas_fecha
BEFORE UPDATE ON public.derivaciones_autorizaciones_clinicas
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();

DROP TRIGGER IF EXISTS tr_antecedentes_clinicos_fecha ON public.antecedentes_clinicos;
CREATE TRIGGER tr_antecedentes_clinicos_fecha
BEFORE UPDATE ON public.antecedentes_clinicos
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();

DROP TRIGGER IF EXISTS tr_alergias_paciente_fecha ON public.alergias_paciente;
CREATE TRIGGER tr_alergias_paciente_fecha
BEFORE UPDATE ON public.alergias_paciente
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();

DROP TRIGGER IF EXISTS tr_consultas_medicas_fecha ON public.consultas_medicas;
CREATE TRIGGER tr_consultas_medicas_fecha
BEFORE UPDATE ON public.consultas_medicas
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();

DROP TRIGGER IF EXISTS tr_diagnosticos_clinicos_fecha ON public.diagnosticos_clinicos;
CREATE TRIGGER tr_diagnosticos_clinicos_fecha
BEFORE UPDATE ON public.diagnosticos_clinicos
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();

DROP TRIGGER IF EXISTS tr_evoluciones_clinicas_fecha ON public.evoluciones_clinicas;
CREATE TRIGGER tr_evoluciones_clinicas_fecha
BEFORE UPDATE ON public.evoluciones_clinicas
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();

DROP TRIGGER IF EXISTS tr_tratamientos_clinicos_fecha ON public.tratamientos_clinicos;
CREATE TRIGGER tr_tratamientos_clinicos_fecha
BEFORE UPDATE ON public.tratamientos_clinicos
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();

DROP TRIGGER IF EXISTS tr_estudios_clinicos_fecha ON public.estudios_clinicos;
CREATE TRIGGER tr_estudios_clinicos_fecha
BEFORE UPDATE ON public.estudios_clinicos
FOR EACH ROW EXECUTE FUNCTION public.actualizar_fecha_modificacion();

-- Triggers de validación e inmutabilidad
DROP TRIGGER IF EXISTS tr_derivaciones_validar ON public.derivaciones_autorizaciones_clinicas;
CREATE TRIGGER tr_derivaciones_validar
BEFORE INSERT OR UPDATE ON public.derivaciones_autorizaciones_clinicas
FOR EACH ROW EXECUTE FUNCTION public.validar_derivacion_clinica();

DROP TRIGGER IF EXISTS tr_antecedentes_consistencia_hc ON public.antecedentes_clinicos;
CREATE TRIGGER tr_antecedentes_consistencia_hc
BEFORE INSERT OR UPDATE OF id_historia_clinica, id_paciente, fecha_creacion ON public.antecedentes_clinicos
FOR EACH ROW EXECUTE FUNCTION public.validar_consistencia_historia_clinica();

DROP TRIGGER IF EXISTS tr_antecedentes_autoria ON public.antecedentes_clinicos;
CREATE TRIGGER tr_antecedentes_autoria
BEFORE UPDATE ON public.antecedentes_clinicos
FOR EACH ROW EXECUTE FUNCTION public.proteger_autoria_antecedente_alergia();

DROP TRIGGER IF EXISTS tr_alergias_consistencia_hc ON public.alergias_paciente;
CREATE TRIGGER tr_alergias_consistencia_hc
BEFORE INSERT OR UPDATE OF id_historia_clinica, id_paciente, fecha_creacion ON public.alergias_paciente
FOR EACH ROW EXECUTE FUNCTION public.validar_consistencia_historia_clinica();

DROP TRIGGER IF EXISTS tr_alergias_autoria ON public.alergias_paciente;
CREATE TRIGGER tr_alergias_autoria
BEFORE UPDATE ON public.alergias_paciente
FOR EACH ROW EXECUTE FUNCTION public.proteger_autoria_antecedente_alergia();

DROP TRIGGER IF EXISTS tr_consultas_consistencia_hc ON public.consultas_medicas;
CREATE TRIGGER tr_consultas_consistencia_hc
BEFORE INSERT OR UPDATE OF id_historia_clinica, id_paciente, fecha_creacion ON public.consultas_medicas
FOR EACH ROW EXECUTE FUNCTION public.validar_consistencia_historia_clinica();

DROP TRIGGER IF EXISTS tr_consultas_validar ON public.consultas_medicas;
CREATE TRIGGER tr_consultas_validar
BEFORE INSERT OR UPDATE ON public.consultas_medicas
FOR EACH ROW EXECUTE FUNCTION public.validar_consulta_medica();

DROP TRIGGER IF EXISTS tr_consultas_proteger_firmada ON public.consultas_medicas;
CREATE TRIGGER tr_consultas_proteger_firmada
BEFORE UPDATE ON public.consultas_medicas
FOR EACH ROW EXECUTE FUNCTION public.proteger_consulta_firmada();

DROP TRIGGER IF EXISTS tr_diagnosticos_consistencia ON public.diagnosticos_clinicos;
CREATE TRIGGER tr_diagnosticos_consistencia
BEFORE INSERT OR UPDATE OF id_consulta, id_historia_clinica, id_paciente, fecha_creacion ON public.diagnosticos_clinicos
FOR EACH ROW EXECUTE FUNCTION public.validar_consistencia_detalle_consulta();

DROP TRIGGER IF EXISTS tr_diagnosticos_autoria ON public.diagnosticos_clinicos;
CREATE TRIGGER tr_diagnosticos_autoria
BEFORE UPDATE ON public.diagnosticos_clinicos
FOR EACH ROW EXECUTE FUNCTION public.proteger_autoria_detalle_consulta();

DROP TRIGGER IF EXISTS tr_evoluciones_consistencia ON public.evoluciones_clinicas;
CREATE TRIGGER tr_evoluciones_consistencia
BEFORE INSERT OR UPDATE OF id_consulta, id_historia_clinica, id_paciente, estado, fecha_creacion ON public.evoluciones_clinicas
FOR EACH ROW EXECUTE FUNCTION public.validar_consistencia_detalle_consulta();

DROP TRIGGER IF EXISTS tr_evoluciones_proteger_firmada ON public.evoluciones_clinicas;
CREATE TRIGGER tr_evoluciones_proteger_firmada
BEFORE UPDATE ON public.evoluciones_clinicas
FOR EACH ROW EXECUTE FUNCTION public.proteger_evolucion_firmada();

DROP TRIGGER IF EXISTS tr_tratamientos_consistencia ON public.tratamientos_clinicos;
CREATE TRIGGER tr_tratamientos_consistencia
BEFORE INSERT OR UPDATE OF id_consulta, id_historia_clinica, id_paciente, fecha_creacion ON public.tratamientos_clinicos
FOR EACH ROW EXECUTE FUNCTION public.validar_consistencia_detalle_consulta();

DROP TRIGGER IF EXISTS tr_tratamientos_autoria ON public.tratamientos_clinicos;
CREATE TRIGGER tr_tratamientos_autoria
BEFORE UPDATE ON public.tratamientos_clinicos
FOR EACH ROW EXECUTE FUNCTION public.proteger_autoria_detalle_consulta();

DROP TRIGGER IF EXISTS tr_estudios_consistencia ON public.estudios_clinicos;
CREATE TRIGGER tr_estudios_consistencia
BEFORE INSERT OR UPDATE OF id_consulta, id_historia_clinica, id_paciente, fecha_creacion ON public.estudios_clinicos
FOR EACH ROW EXECUTE FUNCTION public.validar_consistencia_detalle_consulta();

DROP TRIGGER IF EXISTS tr_estudios_autoria ON public.estudios_clinicos;
CREATE TRIGGER tr_estudios_autoria
BEFORE UPDATE ON public.estudios_clinicos
FOR EACH ROW EXECUTE FUNCTION public.proteger_autoria_detalle_consulta();

-- Triggers contra eliminación física
DROP TRIGGER IF EXISTS tr_hc_no_delete ON public.historias_clinicas;
CREATE TRIGGER tr_hc_no_delete BEFORE DELETE ON public.historias_clinicas
FOR EACH ROW EXECUTE FUNCTION public.impedir_eliminacion_clinica();

DROP TRIGGER IF EXISTS tr_antecedentes_no_delete ON public.antecedentes_clinicos;
CREATE TRIGGER tr_antecedentes_no_delete BEFORE DELETE ON public.antecedentes_clinicos
FOR EACH ROW EXECUTE FUNCTION public.impedir_eliminacion_clinica();

DROP TRIGGER IF EXISTS tr_alergias_no_delete ON public.alergias_paciente;
CREATE TRIGGER tr_alergias_no_delete BEFORE DELETE ON public.alergias_paciente
FOR EACH ROW EXECUTE FUNCTION public.impedir_eliminacion_clinica();

DROP TRIGGER IF EXISTS tr_consultas_no_delete ON public.consultas_medicas;
CREATE TRIGGER tr_consultas_no_delete BEFORE DELETE ON public.consultas_medicas
FOR EACH ROW EXECUTE FUNCTION public.impedir_eliminacion_clinica();

DROP TRIGGER IF EXISTS tr_diagnosticos_no_delete ON public.diagnosticos_clinicos;
CREATE TRIGGER tr_diagnosticos_no_delete BEFORE DELETE ON public.diagnosticos_clinicos
FOR EACH ROW EXECUTE FUNCTION public.impedir_eliminacion_clinica();

DROP TRIGGER IF EXISTS tr_evoluciones_no_delete ON public.evoluciones_clinicas;
CREATE TRIGGER tr_evoluciones_no_delete BEFORE DELETE ON public.evoluciones_clinicas
FOR EACH ROW EXECUTE FUNCTION public.impedir_eliminacion_clinica();

DROP TRIGGER IF EXISTS tr_tratamientos_no_delete ON public.tratamientos_clinicos;
CREATE TRIGGER tr_tratamientos_no_delete BEFORE DELETE ON public.tratamientos_clinicos
FOR EACH ROW EXECUTE FUNCTION public.impedir_eliminacion_clinica();

DROP TRIGGER IF EXISTS tr_estudios_no_delete ON public.estudios_clinicos;
CREATE TRIGGER tr_estudios_no_delete BEFORE DELETE ON public.estudios_clinicos
FOR EACH ROW EXECUTE FUNCTION public.impedir_eliminacion_clinica();

DROP TRIGGER IF EXISTS tr_derivaciones_no_delete ON public.derivaciones_autorizaciones_clinicas;
CREATE TRIGGER tr_derivaciones_no_delete BEFORE DELETE ON public.derivaciones_autorizaciones_clinicas
FOR EACH ROW EXECUTE FUNCTION public.impedir_eliminacion_clinica();

DROP TRIGGER IF EXISTS tr_derivaciones_hist_no_delete ON public.derivaciones_autorizaciones_historial;
CREATE TRIGGER tr_derivaciones_hist_no_delete BEFORE DELETE ON public.derivaciones_autorizaciones_historial
FOR EACH ROW EXECUTE FUNCTION public.impedir_eliminacion_clinica();

-- Triggers de historial y auditoría general (public.auditar_cambios)
DROP TRIGGER IF EXISTS tr_derivaciones_historial ON public.derivaciones_autorizaciones_clinicas;
CREATE TRIGGER tr_derivaciones_historial
AFTER INSERT OR UPDATE ON public.derivaciones_autorizaciones_clinicas
FOR EACH ROW EXECUTE FUNCTION public.registrar_historial_derivacion_clinica();

DROP TRIGGER IF EXISTS tr_auditar_historias_clinicas ON public.historias_clinicas;
CREATE TRIGGER tr_auditar_historias_clinicas
AFTER INSERT OR UPDATE OR DELETE ON public.historias_clinicas
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_historia_clinica');

DROP TRIGGER IF EXISTS tr_auditar_antecedentes_clinicos ON public.antecedentes_clinicos;
CREATE TRIGGER tr_auditar_antecedentes_clinicos
AFTER INSERT OR UPDATE OR DELETE ON public.antecedentes_clinicos
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_antecedente');

DROP TRIGGER IF EXISTS tr_auditar_alergias_paciente ON public.alergias_paciente;
CREATE TRIGGER tr_auditar_alergias_paciente
AFTER INSERT OR UPDATE OR DELETE ON public.alergias_paciente
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_alergia');

DROP TRIGGER IF EXISTS tr_auditar_consultas_medicas ON public.consultas_medicas;
CREATE TRIGGER tr_auditar_consultas_medicas
AFTER INSERT OR UPDATE OR DELETE ON public.consultas_medicas
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_consulta');

DROP TRIGGER IF EXISTS tr_auditar_diagnosticos_clinicos ON public.diagnosticos_clinicos;
CREATE TRIGGER tr_auditar_diagnosticos_clinicos
AFTER INSERT OR UPDATE OR DELETE ON public.diagnosticos_clinicos
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_diagnostico');

DROP TRIGGER IF EXISTS tr_auditar_evoluciones_clinicas ON public.evoluciones_clinicas;
CREATE TRIGGER tr_auditar_evoluciones_clinicas
AFTER INSERT OR UPDATE OR DELETE ON public.evoluciones_clinicas
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_evolucion');

DROP TRIGGER IF EXISTS tr_auditar_tratamientos_clinicos ON public.tratamientos_clinicos;
CREATE TRIGGER tr_auditar_tratamientos_clinicos
AFTER INSERT OR UPDATE OR DELETE ON public.tratamientos_clinicos
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_tratamiento');

DROP TRIGGER IF EXISTS tr_auditar_estudios_clinicos ON public.estudios_clinicos;
CREATE TRIGGER tr_auditar_estudios_clinicos
AFTER INSERT OR UPDATE OR DELETE ON public.estudios_clinicos
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_estudio');

DROP TRIGGER IF EXISTS tr_auditar_derivaciones_clinicas ON public.derivaciones_autorizaciones_clinicas;
CREATE TRIGGER tr_auditar_derivaciones_clinicas
AFTER INSERT OR UPDATE OR DELETE ON public.derivaciones_autorizaciones_clinicas
FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios('id_derivacion');

/* ========================================================================== */
/* 6. FUNCIONES RPC DE AUTORIZACIÓN, LECTURA AUDITADA Y ESCRITURA CLÍNICA     */
/* ========================================================================== */

-- 6.1 Verifica identidad profesional, permiso, salita vigente en acceso y acto clínico,
--     y alcance explícito de derivación (PROFESIONAL / ESPECIALIDAD / LONGITUDINAL).
--     No omite restricciones de especialidad cuando p_especialidad es NULL.
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
    v_cuenta            RECORD;
    v_id_profesional    UUID;
    v_salita_paciente   UUID;
    v_derivacion        RECORD;
    v_fecha_acceso      DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
BEGIN
    IF p_usuario IS NULL OR p_paciente IS NULL OR p_salita IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Usuario, paciente y salita son requeridos';
    END IF;

    IF p_fecha_acto IS NOT NULL AND p_fecha_acto > v_fecha_acceso THEN
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

    -- Validación contra fecha de acceso actual (hoy en zona horaria municipal).
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

    -- Si se evalúa un acto clínico específico, valida también vigencia en fecha del acto.
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

        -- Validación obligatoria de especialidad para toda vía (propia o derivada).
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

    -- Vía A: paciente perteneciente a la salita desde la que accede el profesional.
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

    -- Vía B: otra salita -> exige derivación o autorización explícita acorde al alcance solicitado.
    SELECT d.id_derivacion, d.alcance, d.id_especialidad_destino, d.id_profesional_destino,
           d.fecha_desde, d.fecha_hasta
      INTO v_derivacion
      FROM public.derivaciones_autorizaciones_clinicas d
     WHERE d.id_paciente = p_paciente
       AND d.id_salita_origen = v_salita_paciente
       AND d.id_salita_destino = p_salita
       AND d.estado = 'AUTORIZADA'
       -- Vigente en fecha de acceso actual
       AND d.fecha_desde <= v_fecha_acceso
       AND d.fecha_hasta >= v_fecha_acceso
       -- Si corresponde a un acto clínico puntual y no es acceso longitudinal, debe cubrir la fecha del acto
       AND (
           p_fecha_acto IS NULL
           OR d.alcance = 'LONGITUDINAL'
           OR (d.fecha_desde <= p_fecha_acto AND d.fecha_hasta >= p_fecha_acto)
       )
       AND (
           -- Caso 1: Acceso longitudinal completo solo mediante AUTORIZACION_ACCESO LONGITUDINAL.
           (
               p_requiere_longitudinal = TRUE
               AND d.alcance = 'LONGITUDINAL'
               AND d.id_profesional_destino = v_id_profesional
           )
           OR
           -- Caso 2: Consulta acotada o acto clínico sin exigir longitudinal completo.
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

-- 6.2 Función interna de auditoría clínica: no ejecutable por service_role.
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
    ELSIF v_rol = 'ADMIN_SALITA' THEN
        IF v_recurso <> 'DERIVACION_CLINICA' OR p_tipo_operacion <> 'MODIFICACION' THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Un administrador solo puede auditar resoluciones administrativas de derivaciones';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.usuario_salita us
             WHERE us.id_usuario = p_usuario
               AND us.id_salita = p_salita
               AND us.activo
               AND us.fecha_desde <= v_today
               AND (us.fecha_hasta IS NULL OR us.fecha_hasta >= v_today)
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El administrador no posee relación vigente con la salita auditada';
        END IF;
    ELSIF v_rol = 'SUPER_ADMIN' THEN
        IF v_recurso <> 'DERIVACION_CLINICA' OR p_tipo_operacion <> 'MODIFICACION' THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Super Admin no posee acceso clínico directo para esta operación';
        END IF;
    ELSE
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Rol sin habilitación para generar eventos de auditoría clínica';
    END IF;

    -- Coherencia estricta entre alcance auditado, salita del paciente, derivación y recurso.
    IF p_alcance_acceso = 'SALITA_ASIGNADA' THEN
        IF v_salita_paciente IS DISTINCT FROM p_salita OR p_id_derivacion IS NOT NULL THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El alcance SALITA_ASIGNADA exige coincidencia con la salita del paciente y sin derivación';
        END IF;
    ELSIF p_alcance_acceso IN ('PROFESIONAL', 'ESPECIALIDAD', 'LONGITUDINAL') THEN
        IF p_id_derivacion IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El alcance delegado exige referencia explícita a una derivación o autorización';
        END IF;

        IF v_recurso = 'DERIVACION_CLINICA' THEN
            IF NOT EXISTS (
                SELECT 1
                  FROM public.derivaciones_autorizaciones_clinicas d
                 WHERE d.id_derivacion = p_id_derivacion
                   AND d.id_paciente = p_paciente
                   AND d.alcance = p_alcance_acceso
                   AND p_salita IN (d.id_salita_origen, d.id_salita_destino)
            ) THEN
                RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La derivación referenciada en auditoría no coincide en paciente, alcance o salitas participantes';
            END IF;
        ELSE
            IF v_salita_paciente IS NULL OR v_salita_paciente = p_salita OR NOT EXISTS (
                SELECT 1
                  FROM public.derivaciones_autorizaciones_clinicas d
                 WHERE d.id_derivacion = p_id_derivacion
                   AND d.id_paciente = p_paciente
                   AND d.alcance = p_alcance_acceso
                   AND d.id_salita_origen = v_salita_paciente
                   AND d.id_salita_destino = p_salita
                   AND d.estado = 'AUTORIZADA'
                   AND d.fecha_desde <= v_today
                   AND d.fecha_hasta >= v_today
                   AND (p_fecha_acto IS NULL OR d.alcance = 'LONGITUDINAL'
                        OR (d.fecha_desde <= p_fecha_acto AND d.fecha_hasta >= p_fecha_acto))
                   AND (d.alcance NOT IN ('PROFESIONAL','LONGITUDINAL') OR d.id_profesional_destino = v_id_profesional)
                   AND (d.alcance <> 'ESPECIALIDAD' OR EXISTS (
                        SELECT 1 FROM public.profesional_especialidad pe
                         WHERE pe.id_profesional = v_id_profesional
                           AND pe.id_especialidad = d.id_especialidad_destino
                           AND pe.activo
                           AND pe.fecha_desde <= v_today
                           AND (pe.fecha_hasta IS NULL OR pe.fecha_hasta >= v_today)
                           AND (p_fecha_acto IS NULL OR (pe.fecha_desde <= p_fecha_acto
                                AND (pe.fecha_hasta IS NULL OR pe.fecha_hasta >= p_fecha_acto)))
                   ))
            ) THEN
                RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La derivación auditada no está autorizada, vigente o no coincide con el profesional, paciente y salitas';
            END IF;
        END IF;
    ELSIF p_alcance_acceso = 'ADMINISTRATIVO' THEN
        IF v_recurso <> 'DERIVACION_CLINICA' OR p_id_derivacion IS NULL OR NOT EXISTS (
            SELECT 1
              FROM public.derivaciones_autorizaciones_clinicas d
             WHERE d.id_derivacion = p_id_derivacion
               AND d.id_paciente = p_paciente
               AND (v_rol = 'SUPER_ADMIN' OR p_salita IN (d.id_salita_origen, d.id_salita_destino))
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La auditoría administrativa solo aplica sobre derivaciones válidas del paciente';
        END IF;
    END IF;

    IF p_id_recurso IS NOT NULL THEN
        IF v_recurso = 'HISTORIA_CLINICA' AND NOT EXISTS (
            SELECT 1 FROM public.historias_clinicas hc
             WHERE hc.id_historia_clinica = p_id_recurso
               AND hc.id_paciente = p_paciente
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El identificador de historia clínica auditado no pertenece al paciente';
        ELSIF v_recurso = 'CONSULTA_MEDICA' AND NOT EXISTS (
            SELECT 1 FROM public.consultas_medicas c
             WHERE c.id_consulta = p_id_recurso
               AND c.id_paciente = p_paciente
               AND c.id_salita = p_salita
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La consulta médica auditada no pertenece al paciente ni a la salita';
        ELSIF v_recurso = 'EVOLUCION_CLINICA' AND NOT EXISTS (
            SELECT 1
              FROM public.evoluciones_clinicas ev
              JOIN public.consultas_medicas c ON c.id_consulta = ev.id_consulta
             WHERE ev.id_evolucion = p_id_recurso
               AND ev.id_paciente = p_paciente
               AND c.id_salita = p_salita
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La evolución clínica auditada no pertenece al paciente ni a la salita';
        ELSIF v_recurso = 'ESTUDIO_CLINICO' AND NOT EXISTS (
            SELECT 1
              FROM public.estudios_clinicos es
              JOIN public.consultas_medicas c ON c.id_consulta = es.id_consulta
             WHERE es.id_estudio = p_id_recurso
               AND es.id_paciente = p_paciente
               AND c.id_salita = p_salita
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El estudio clínico auditado no pertenece al paciente ni a la salita';
        ELSIF v_recurso = 'DERIVACION_CLINICA' AND p_id_recurso <> p_id_derivacion THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El recurso de derivación auditado no coincide con id_derivacion';
        END IF;
    END IF;

    SELECT hc.id_historia_clinica
      INTO v_id_hc
      FROM public.historias_clinicas hc
     WHERE hc.id_paciente = p_paciente;

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
        p_motivo_acceso,
        p_id_derivacion,
        NULLIF(trim(COALESCE(p_ip, '')), '')::INET
    )
    RETURNING id_auditoria_clinica INTO v_id_auditoria;

    RETURN v_id_auditoria;
END;
$$;

-- 6.3 Lectura clínica auditada:
--     - Si p_especialidad IS NULL y es inter-salita: exige alcance = 'LONGITUDINAL'.
--     - Si p_especialidad IS NOT NULL y deriva por ESPECIALIDAD/PROFESIONAL: filtra el expediente estrictamente a ese alcance.
CREATE OR REPLACE FUNCTION public.consultar_historia_clinica(
    p_usuario           UUID,
    p_paciente          UUID,
    p_salita            UUID,
    p_especialidad      UUID DEFAULT NULL,
    p_motivo_acceso     TEXT DEFAULT 'Consulta de historia clínica',
    p_es_exportacion    BOOLEAN DEFAULT FALSE,
    p_ip                TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_acceso            JSONB;
    v_alcance           TEXT;
    v_id_profesional    UUID;
    v_id_derivacion     UUID;
    v_esp_autorizada    UUID;
    v_derivacion_desde  DATE;
    v_derivacion_hasta  DATE;
    v_hc                public.historias_clinicas%ROWTYPE;
    v_hc_json           JSONB;
    v_paciente_resumen  JSONB;
    v_antecedentes      JSONB;
    v_alergias          JSONB;
    v_consultas         JSONB;
    v_tipo_op           TEXT;
    v_solo_alcance      BOOLEAN;
BEGIN
    v_acceso := public.verificar_acceso_clinico(
        p_usuario,
        p_paciente,
        p_salita,
        'VER_HISTORIA_CLINICA',
        NULL,
        p_especialidad,
        (p_especialidad IS NULL)
    );
    v_alcance := v_acceso->>'alcance';
    v_id_profesional := (v_acceso->>'id_profesional')::UUID;
    v_id_derivacion := NULLIF(v_acceso->>'id_derivacion', '')::UUID;
    v_esp_autorizada := COALESCE(NULLIF(v_acceso->>'id_especialidad_autorizada', '')::UUID, p_especialidad);
    v_derivacion_desde := NULLIF(v_acceso->>'fecha_desde_autorizada', '')::DATE;
    v_derivacion_hasta := NULLIF(v_acceso->>'fecha_hasta_autorizada', '')::DATE;
    v_solo_alcance := (v_acceso->>'via' = 'DERIVACION_AUTORIZADA' AND v_alcance IN ('PROFESIONAL', 'ESPECIALIDAD'));
    v_tipo_op := CASE WHEN COALESCE(p_es_exportacion, FALSE) THEN 'EXPORTACION' ELSE 'CONSULTA' END;

    SELECT * INTO v_hc
      FROM public.historias_clinicas
     WHERE id_paciente = p_paciente;

    -- Registra obligatoriamente el acceso antes de retornar cualquier dato clínico.
    PERFORM public.registrar_acceso_auditoria_clinica(
        p_usuario,
        p_paciente,
        p_salita,
        v_tipo_op,
        'HISTORIA_CLINICA',
        v_hc.id_historia_clinica,
        COALESCE(NULLIF(trim(COALESCE(p_motivo_acceso, '')), ''), 'Consulta de historia clínica'),
        v_id_derivacion,
        v_alcance,
        NULL,
        p_ip
    );

    SELECT jsonb_build_object(
        'id_paciente', pa.id_paciente,
        'id_salita_asignada', pa.id_salita_asignada,
        'obra_social', pa.obra_social,
        'dni', pe.dni,
        'nombres', pe.nombres,
        'apellidos', pe.apellidos,
        'fecha_nacimiento', pe.fecha_nacimiento,
        'sexo', pe.sexo
    )
    INTO v_paciente_resumen
    FROM public.pacientes pa
    JOIN public.personas pe ON pe.id_persona = pa.id_persona
    WHERE pa.id_paciente = p_paciente;

    IF v_solo_alcance THEN
        v_paciente_resumen := v_paciente_resumen - 'obra_social';
    END IF;

    IF v_hc.id_historia_clinica IS NULL THEN
        RETURN jsonb_build_object(
            'historia_clinica', NULL,
            'paciente', v_paciente_resumen,
            'via_acceso', v_acceso->>'via',
            'alcance', v_alcance,
            'id_derivacion', v_id_derivacion,
            'contenido_restringido_por_alcance', v_solo_alcance,
            'antecedentes', '[]'::jsonb,
            'alergias', '[]'::jsonb,
            'consultas', '[]'::jsonb
        );
    END IF;

    IF v_solo_alcance THEN
        -- En derivación acotada (PROFESIONAL o ESPECIALIDAD) no se exponen observaciones generales,
        -- antecedentes, alergias ni actos clínicos fuera de la derivación vigente.
        v_hc_json := to_jsonb(v_hc) - 'observaciones_generales' - 'creado_por';
        v_antecedentes := '[]'::jsonb;
        v_alergias := '[]'::jsonb;
    ELSE
        v_hc_json := to_jsonb(v_hc);

        SELECT COALESCE(jsonb_agg(to_jsonb(a.*) ORDER BY a.fecha_antecedente DESC, a.fecha_creacion DESC), '[]'::jsonb)
          INTO v_antecedentes
          FROM public.antecedentes_clinicos a
         WHERE a.id_historia_clinica = v_hc.id_historia_clinica;

        SELECT COALESCE(jsonb_agg(to_jsonb(al.*) ORDER BY al.estado ASC, al.fecha_creacion DESC), '[]'::jsonb)
          INTO v_alergias
          FROM public.alergias_paciente al
         WHERE al.id_historia_clinica = v_hc.id_historia_clinica;
    END IF;

    SELECT COALESCE(
        jsonb_agg(
            to_jsonb(c.*) || jsonb_build_object(
                'especialidad', e.nombre,
                'salita', s.nombre,
                'profesional', concat_ws(' ', pp.apellidos, pp.nombres),
                'diagnosticos', COALESCE((
                    SELECT jsonb_agg(to_jsonb(d.*) ORDER BY d.fecha_creacion ASC)
                      FROM public.diagnosticos_clinicos d
                     WHERE d.id_consulta = c.id_consulta
                ), '[]'::jsonb),
                'evoluciones', COALESCE((
                    SELECT jsonb_agg(to_jsonb(ev.*) ORDER BY ev.version ASC, ev.fecha_evolucion ASC)
                      FROM public.evoluciones_clinicas ev
                     WHERE ev.id_consulta = c.id_consulta
                       AND (ev.estado <> 'BORRADOR' OR ev.id_profesional_responsable = v_id_profesional)
                ), '[]'::jsonb),
                'tratamientos', COALESCE((
                    SELECT jsonb_agg(to_jsonb(tr.*) ORDER BY tr.fecha_inicio DESC, tr.fecha_creacion DESC)
                      FROM public.tratamientos_clinicos tr
                     WHERE tr.id_consulta = c.id_consulta
                ), '[]'::jsonb),
                'estudios', COALESCE((
                    SELECT jsonb_agg(to_jsonb(es.*) ORDER BY es.fecha_solicitud DESC)
                      FROM public.estudios_clinicos es
                     WHERE es.id_consulta = c.id_consulta
                ), '[]'::jsonb)
            )
            ORDER BY c.fecha_atencion DESC, c.fecha_creacion DESC
        ),
        '[]'::jsonb
    )
    INTO v_consultas
    FROM public.consultas_medicas c
    JOIN public.especialidades e ON e.id_especialidad = c.id_especialidad
    JOIN public.salitas s ON s.id_salita = c.id_salita
    JOIN public.profesionales pr ON pr.id_profesional = c.id_profesional
    JOIN public.personas pp ON pp.id_persona = pr.id_persona
    WHERE c.id_historia_clinica = v_hc.id_historia_clinica
      AND (c.estado <> 'BORRADOR' OR c.id_profesional_autor = v_id_profesional)
      AND (
          NOT v_solo_alcance
          OR (
              c.id_salita = p_salita
              AND (v_esp_autorizada IS NULL OR c.id_especialidad = v_esp_autorizada)
              AND (v_alcance <> 'PROFESIONAL' OR c.id_profesional = v_id_profesional)
              AND (
                  c.id_autorizacion_clinica = v_id_derivacion
                  OR (
                      v_derivacion_desde IS NOT NULL
                      AND v_derivacion_hasta IS NOT NULL
                      AND (c.fecha_atencion AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE BETWEEN v_derivacion_desde AND v_derivacion_hasta
                  )
              )
          )
      );

    RETURN jsonb_build_object(
        'historia_clinica', v_hc_json,
        'paciente', v_paciente_resumen,
        'via_acceso', v_acceso->>'via',
        'alcance', v_alcance,
        'id_derivacion', v_id_derivacion,
        'contenido_restringido_por_alcance', v_solo_alcance,
        'antecedentes', v_antecedentes,
        'alergias', v_alergias,
        'consultas', v_consultas
    );
END;
$$;

-- 6.4 Lectura puntual auditada de una consulta médica concreta.
--     Verifica paciente esperado, coincidencia exacta de salita del recurso, especialidad,
--     fecha del acto clínico y permiso específico.
CREATE OR REPLACE FUNCTION public.consultar_consulta_medica(
    p_usuario       UUID,
    p_consulta      UUID,
    p_salita        UUID,
    p_paciente      UUID DEFAULT NULL,
    p_motivo_acceso TEXT DEFAULT 'Consulta de detalle médico',
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
    v_id_derivacion     UUID;
    v_id_profesional    UUID;
    v_fecha_acto        DATE;
BEGIN
    SELECT * INTO v_consulta
      FROM public.consultas_medicas
     WHERE id_consulta = p_consulta;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Consulta médica no encontrada';
    END IF;

    IF p_paciente IS NOT NULL AND v_consulta.id_paciente <> p_paciente THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La consulta médica no pertenece al paciente indicado';
    END IF;

    IF v_consulta.id_salita <> p_salita THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La consulta médica pertenece a otra salita y no puede consultarse desde esta salita';
    END IF;

    v_fecha_acto := (v_consulta.fecha_atencion AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;

    v_acceso := public.verificar_acceso_clinico(
        p_usuario,
        v_consulta.id_paciente,
        p_salita,
        'VER_HISTORIA_CLINICA',
        v_fecha_acto,
        v_consulta.id_especialidad,
        FALSE
    );
    v_id_profesional := (v_acceso->>'id_profesional')::UUID;
    v_id_derivacion := NULLIF(v_acceso->>'id_derivacion', '')::UUID;

    IF v_consulta.estado = 'BORRADOR' AND v_consulta.id_profesional_autor <> v_id_profesional THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Los borradores clínicos solo pueden ser consultados por su profesional autor';
    END IF;

    IF v_acceso->>'via' = 'DERIVACION_AUTORIZADA'
       AND v_acceso->>'alcance' = 'PROFESIONAL'
       AND v_consulta.id_profesional <> v_id_profesional THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La autorización del profesional no habilita consultar actos clínicos de otro profesional';
    END IF;

    PERFORM public.registrar_acceso_auditoria_clinica(
        p_usuario,
        v_consulta.id_paciente,
        p_salita,
        'CONSULTA',
        'CONSULTA_MEDICA',
        v_consulta.id_consulta,
        COALESCE(NULLIF(trim(COALESCE(p_motivo_acceso, '')), ''), 'Consulta puntual de acto médico'),
        v_id_derivacion,
        v_acceso->>'alcance',
        v_fecha_acto,
        p_ip
    );

    RETURN to_jsonb(v_consulta) || jsonb_build_object(
        'via_acceso', v_acceso->>'via',
        'alcance', v_acceso->>'alcance',
        'id_derivacion', v_id_derivacion,
        'diagnosticos', COALESCE((SELECT jsonb_agg(to_jsonb(d.*) ORDER BY d.fecha_creacion ASC) FROM public.diagnosticos_clinicos d WHERE d.id_consulta = v_consulta.id_consulta), '[]'::jsonb),
        'evoluciones', COALESCE((SELECT jsonb_agg(to_jsonb(ev.*) ORDER BY ev.version ASC, ev.fecha_evolucion ASC) FROM public.evoluciones_clinicas ev WHERE ev.id_consulta = v_consulta.id_consulta AND (ev.estado <> 'BORRADOR' OR ev.id_profesional_responsable = v_id_profesional)), '[]'::jsonb),
        'tratamientos', COALESCE((SELECT jsonb_agg(to_jsonb(tr.*) ORDER BY tr.fecha_inicio DESC) FROM public.tratamientos_clinicos tr WHERE tr.id_consulta = v_consulta.id_consulta), '[]'::jsonb),
        'estudios', COALESCE((SELECT jsonb_agg(to_jsonb(es.*) ORDER BY es.fecha_solicitud DESC) FROM public.estudios_clinicos es WHERE es.id_consulta = v_consulta.id_consulta), '[]'::jsonb)
    );
END;
$$;

-- 6.5 Escritura clínica transaccional compuesta.
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
    v_acceso            JSONB;
    v_id_profesional    UUID;
    v_id_derivacion     UUID;
    v_id_paciente       UUID;
    v_id_especialidad   UUID;
    v_id_hc             UUID;
    v_id_consulta       UUID;
    v_firmar            BOOLEAN;
    v_fecha_atencion    TIMESTAMPTZ;
    v_fecha_atencion_d  DATE;
    v_today             DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
    v_item              JSONB;
BEGIN
    IF p_datos IS NULL OR jsonb_typeof(p_datos) <> 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Payload clínico inválido';
    END IF;

    v_id_paciente := NULLIF(p_datos->>'id_paciente', '')::UUID;
    v_id_especialidad := NULLIF(p_datos->>'id_especialidad', '')::UUID;
    v_firmar := COALESCE((p_datos->>'firmar')::BOOLEAN, FALSE);
    v_fecha_atencion := COALESCE(NULLIF(p_datos->>'fecha_atencion', '')::TIMESTAMPTZ, NOW());
    v_fecha_atencion_d := (v_fecha_atencion AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;

    IF v_id_paciente IS NULL OR v_id_especialidad IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Paciente y especialidad son requeridos';
    END IF;

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
        NULLIF(p_datos->>'id_turno', '')::UUID,
        v_id_derivacion,
        NULLIF(p_datos->>'acompanante_tutor_id', '')::UUID,
        v_fecha_atencion,
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
        'id_profesional', v_id_profesional,
        'via_acceso', v_acceso->>'via',
        'alcance', v_acceso->>'alcance',
        'id_derivacion', v_id_derivacion
    );
END;
$$;

-- 6.6 Firma consulta médica en borrador (y sus evoluciones en borrador asociadas).
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

    IF v_consulta.estado <> 'BORRADOR' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Solo puede firmarse una consulta médica en estado BORRADOR';
    END IF;

    v_fecha_acto := (v_consulta.fecha_atencion AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;

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

    RETURN jsonb_build_object('id_consulta', p_id_consulta, 'estado', 'FIRMADA');
END;
$$;

-- 6.7 Anula una consulta únicamente mientras esté en estado BORRADOR.
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

-- 6.8 Registra nueva evolución clínica firmada sobre una consulta existente ya FIRMADA.
CREATE OR REPLACE FUNCTION public.registrar_evolucion_clinica(
    p_usuario       UUID,
    p_salita        UUID,
    p_id_consulta   UUID,
    p_evolucion     TEXT,
    p_observaciones TEXT DEFAULT NULL,
    p_paciente      UUID DEFAULT NULL,
    p_motivo_acceso TEXT DEFAULT 'Registro de evolución clínica',
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
    v_id_evolucion      UUID;
    v_fecha_acto        DATE;
BEGIN
    SELECT * INTO v_consulta
      FROM public.consultas_medicas
     WHERE id_consulta = p_id_consulta
     FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'La consulta médica no existe';
    END IF;

    IF p_paciente IS NOT NULL AND v_consulta.id_paciente <> p_paciente THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La consulta médica no pertenece al paciente indicado';
    END IF;

    IF v_consulta.id_salita <> p_salita THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La consulta pertenece a otra salita y no admite evoluciones desde esta salita';
    END IF;

    IF v_consulta.estado <> 'FIRMADA' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Solo pueden registrarse evoluciones firmadas sobre una consulta en estado FIRMADA';
    END IF;

    v_fecha_acto := (v_consulta.fecha_atencion AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;

    v_acceso := public.verificar_acceso_clinico(
        p_usuario,
        v_consulta.id_paciente,
        p_salita,
        'REGISTRAR_EVOLUCIONES',
        v_fecha_acto,
        v_consulta.id_especialidad,
        FALSE
    );
    v_id_profesional := (v_acceso->>'id_profesional')::UUID;
    v_id_derivacion := NULLIF(v_acceso->>'id_derivacion', '')::UUID;

    IF NOT EXISTS (
        SELECT 1
          FROM public.profesional_especialidad pe
         WHERE pe.id_profesional = v_id_profesional
           AND pe.id_especialidad = v_consulta.id_especialidad
           AND pe.activo
           AND pe.fecha_desde <= (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE
           AND (pe.fecha_hasta IS NULL OR pe.fecha_hasta >= (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE)
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El profesional no posee habilitación vigente en la especialidad de la consulta';
    END IF;

    PERFORM set_config('app.current_user_id', p_usuario::TEXT, TRUE);
    PERFORM set_config('app.current_salita_id', p_salita::TEXT, TRUE);
    PERFORM set_config('app.client_ip', COALESCE(p_ip, ''), TRUE);

    INSERT INTO public.evoluciones_clinicas (
        id_consulta,
        id_historia_clinica,
        id_paciente,
        evolucion,
        observaciones,
        id_profesional_responsable,
        estado,
        firmada_en
    )
    VALUES (
        v_consulta.id_consulta,
        v_consulta.id_historia_clinica,
        v_consulta.id_paciente,
        p_evolucion,
        NULLIF(p_observaciones, ''),
        v_id_profesional,
        'FIRMADA',
        NOW()
    )
    RETURNING id_evolucion INTO v_id_evolucion;

    PERFORM public.registrar_acceso_auditoria_clinica(
        p_usuario,
        v_consulta.id_paciente,
        p_salita,
        'CREACION',
        'EVOLUCION_CLINICA',
        v_id_evolucion,
        COALESCE(NULLIF(trim(COALESCE(p_motivo_acceso, '')), ''), 'Registro de evolución clínica'),
        v_id_derivacion,
        v_acceso->>'alcance',
        (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE,
        p_ip
    );

    RETURN jsonb_build_object('id_evolucion', v_id_evolucion, 'estado', 'FIRMADA');
END;
$$;

-- 6.9 Rectifica una evolución clínica firmada validando consulta, salita, especialidad y autoría.
CREATE OR REPLACE FUNCTION public.rectificar_evolucion_clinica(
    p_usuario           UUID,
    p_salita            UUID,
    p_id_evolucion      UUID,
    p_nueva_evolucion   TEXT,
    p_observaciones     TEXT,
    p_motivo_correccion TEXT,
    p_paciente          UUID DEFAULT NULL,
    p_ip                TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_prev              public.evoluciones_clinicas%ROWTYPE;
    v_consulta          public.consultas_medicas%ROWTYPE;
    v_acceso            JSONB;
    v_id_profesional    UUID;
    v_id_derivacion     UUID;
    v_nueva_id          UUID;
    v_fecha_acto        DATE;
BEGIN
    IF NULLIF(trim(COALESCE(p_motivo_correccion, '')), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Debe indicar el motivo de la corrección';
    END IF;

    SELECT * INTO v_prev
      FROM public.evoluciones_clinicas
     WHERE id_evolucion = p_id_evolucion
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'La evolución clínica no existe';
    END IF;

    IF p_paciente IS NOT NULL AND v_prev.id_paciente <> p_paciente THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La evolución clínica no pertenece al paciente indicado';
    END IF;

    SELECT * INTO v_consulta
      FROM public.consultas_medicas
     WHERE id_consulta = v_prev.id_consulta
     FOR SHARE;

    IF v_consulta.id_salita <> p_salita THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La evolución pertenece a una consulta de otra salita y no puede rectificarse desde aquí';
    END IF;

    IF v_consulta.estado <> 'FIRMADA' OR v_prev.estado <> 'FIRMADA' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Solo puede rectificarse una evolución FIRMADA perteneciente a una consulta FIRMADA';
    END IF;

    v_fecha_acto := (v_prev.fecha_evolucion AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;

    v_acceso := public.verificar_acceso_clinico(
        p_usuario,
        v_prev.id_paciente,
        p_salita,
        'REGISTRAR_EVOLUCIONES',
        v_fecha_acto,
        v_consulta.id_especialidad,
        FALSE
    );
    v_id_profesional := (v_acceso->>'id_profesional')::UUID;
    v_id_derivacion := NULLIF(v_acceso->>'id_derivacion', '')::UUID;

    IF v_prev.id_profesional_responsable <> v_id_profesional THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo el profesional responsable puede rectificar su evolución firmada';
    END IF;

    PERFORM set_config('app.current_user_id', p_usuario::TEXT, TRUE);
    PERFORM set_config('app.current_salita_id', p_salita::TEXT, TRUE);
    PERFORM set_config('app.client_ip', COALESCE(p_ip, ''), TRUE);
    PERFORM set_config('app.rectificando_evolucion', 'true', TRUE);

    UPDATE public.evoluciones_clinicas
       SET estado = 'RECTIFICADA'
     WHERE id_evolucion = p_id_evolucion;

    INSERT INTO public.evoluciones_clinicas (
        id_consulta,
        id_historia_clinica,
        id_paciente,
        evolucion,
        observaciones,
        id_profesional_responsable,
        version,
        es_correccion,
        id_evolucion_origen,
        motivo_correccion,
        estado,
        firmada_en
    )
    VALUES (
        v_prev.id_consulta,
        v_prev.id_historia_clinica,
        v_prev.id_paciente,
        p_nueva_evolucion,
        NULLIF(p_observaciones, ''),
        v_id_profesional,
        v_prev.version + 1,
        TRUE,
        p_id_evolucion,
        trim(p_motivo_correccion),
        'FIRMADA',
        NOW()
    )
    RETURNING id_evolucion INTO v_nueva_id;

    PERFORM public.registrar_acceso_auditoria_clinica(
        p_usuario,
        v_prev.id_paciente,
        p_salita,
        'CORRECCION',
        'EVOLUCION_CLINICA',
        v_nueva_id,
        trim(p_motivo_correccion),
        v_id_derivacion,
        v_acceso->>'alcance',
        (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE,
        p_ip
    );

    RETURN jsonb_build_object(
        'id_evolucion_anterior', p_id_evolucion,
        'id_evolucion_nueva', v_nueva_id,
        'version', v_prev.version + 1
    );
END;
$$;

-- 6.10 Cambio de estado de estudios clínicos (EN_PROCESO / CANCELADO) con validación de recurso y salita.
CREATE OR REPLACE FUNCTION public.actualizar_estado_estudio_clinico(
    p_usuario       UUID,
    p_salita        UUID,
    p_id_estudio    UUID,
    p_nuevo_estado  TEXT,
    p_motivo        TEXT DEFAULT 'Actualización de estado de estudio clínico',
    p_paciente      UUID DEFAULT NULL,
    p_ip            TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_estudio           public.estudios_clinicos%ROWTYPE;
    v_consulta          public.consultas_medicas%ROWTYPE;
    v_acceso            JSONB;
    v_id_derivacion     UUID;
    v_fecha_acto        DATE;
BEGIN
    IF p_nuevo_estado NOT IN ('EN_PROCESO', 'CANCELADO') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Estado inválido para esta operación; utilice informar_estudio_clinico para completar';
    END IF;

    SELECT * INTO v_estudio
      FROM public.estudios_clinicos
     WHERE id_estudio = p_id_estudio
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Estudio clínico no encontrado';
    END IF;

    IF p_paciente IS NOT NULL AND v_estudio.id_paciente <> p_paciente THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El estudio clínico no pertenece al paciente indicado';
    END IF;

    SELECT * INTO v_consulta
      FROM public.consultas_medicas
     WHERE id_consulta = v_estudio.id_consulta
     FOR SHARE;

    IF v_consulta.id_salita <> p_salita THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El estudio clínico pertenece a una consulta de otra salita';
    END IF;

    IF v_consulta.estado = 'ANULADA' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La consulta asociada al estudio está anulada';
    END IF;

    IF v_estudio.estado IN ('COMPLETADO', 'CANCELADO') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Un estudio clínico en estado final no admite cambios';
    END IF;

    v_fecha_acto := (v_estudio.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;

    v_acceso := public.verificar_acceso_clinico(
        p_usuario,
        v_estudio.id_paciente,
        p_salita,
        'GESTIONAR_ESTUDIOS_CLINICOS',
        v_fecha_acto,
        v_consulta.id_especialidad,
        FALSE
    );
    v_id_derivacion := NULLIF(v_acceso->>'id_derivacion', '')::UUID;

    PERFORM set_config('app.current_user_id', p_usuario::TEXT, TRUE);
    PERFORM set_config('app.current_salita_id', p_salita::TEXT, TRUE);
    PERFORM set_config('app.client_ip', COALESCE(p_ip, ''), TRUE);
    PERFORM set_config('app.operacion_estudio_rpc', 'true', TRUE);

    UPDATE public.estudios_clinicos
       SET estado = p_nuevo_estado
     WHERE id_estudio = p_id_estudio;

    PERFORM public.registrar_acceso_auditoria_clinica(
        p_usuario,
        v_estudio.id_paciente,
        p_salita,
        'MODIFICACION',
        'ESTUDIO_CLINICO',
        p_id_estudio,
        COALESCE(NULLIF(trim(COALESCE(p_motivo, '')), ''), 'Cambio de estado de estudio clínico a ' || p_nuevo_estado),
        v_id_derivacion,
        v_acceso->>'alcance',
        (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE,
        p_ip
    );

    RETURN jsonb_build_object('id_estudio', p_id_estudio, 'estado', p_nuevo_estado);
END;
$$;

-- 6.11 Registra resultado de estudio clínico solicitado validando salita, paciente, especialidad y vigencia.
CREATE OR REPLACE FUNCTION public.informar_estudio_clinico(
    p_usuario       UUID,
    p_salita        UUID,
    p_id_estudio    UUID,
    p_resultado     TEXT,
    p_paciente      UUID DEFAULT NULL,
    p_motivo_acceso TEXT DEFAULT 'Informe de resultado de estudio clínico',
    p_ip            TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_estudio           public.estudios_clinicos%ROWTYPE;
    v_consulta          public.consultas_medicas%ROWTYPE;
    v_acceso            JSONB;
    v_id_profesional    UUID;
    v_id_derivacion     UUID;
    v_fecha_acto        DATE;
BEGIN
    IF NULLIF(trim(COALESCE(p_resultado, '')), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El resultado del estudio es obligatorio';
    END IF;

    SELECT * INTO v_estudio
      FROM public.estudios_clinicos
     WHERE id_estudio = p_id_estudio
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Estudio clínico no encontrado';
    END IF;

    IF p_paciente IS NOT NULL AND v_estudio.id_paciente <> p_paciente THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El estudio clínico no pertenece al paciente indicado';
    END IF;

    SELECT * INTO v_consulta
      FROM public.consultas_medicas
     WHERE id_consulta = v_estudio.id_consulta
     FOR SHARE;

    IF v_consulta.id_salita <> p_salita THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El estudio clínico pertenece a una consulta de otra salita';
    END IF;

    IF v_consulta.estado = 'ANULADA' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'No puede informarse un estudio cuya consulta fue anulada';
    END IF;

    IF v_estudio.estado NOT IN ('SOLICITADO', 'EN_PROCESO') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Solo pueden informarse estudios en estado SOLICITADO o EN_PROCESO';
    END IF;

    v_fecha_acto := (v_estudio.fecha_solicitud AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;

    v_acceso := public.verificar_acceso_clinico(
        p_usuario,
        v_estudio.id_paciente,
        p_salita,
        'GESTIONAR_ESTUDIOS_CLINICOS',
        v_fecha_acto,
        v_consulta.id_especialidad,
        FALSE
    );
    v_id_profesional := (v_acceso->>'id_profesional')::UUID;
    v_id_derivacion := NULLIF(v_acceso->>'id_derivacion', '')::UUID;

    PERFORM set_config('app.current_user_id', p_usuario::TEXT, TRUE);
    PERFORM set_config('app.current_salita_id', p_salita::TEXT, TRUE);
    PERFORM set_config('app.client_ip', COALESCE(p_ip, ''), TRUE);
    PERFORM set_config('app.operacion_estudio_rpc', 'true', TRUE);

    UPDATE public.estudios_clinicos
       SET estado = 'COMPLETADO',
           resultado = trim(p_resultado),
           fecha_resultado = NOW(),
           id_profesional_informa = v_id_profesional
     WHERE id_estudio = p_id_estudio;

    PERFORM public.registrar_acceso_auditoria_clinica(
        p_usuario,
        v_estudio.id_paciente,
        p_salita,
        'MODIFICACION',
        'ESTUDIO_CLINICO',
        p_id_estudio,
        COALESCE(NULLIF(trim(COALESCE(p_motivo_acceso, '')), ''), 'Carga de resultado de estudio clínico'),
        v_id_derivacion,
        v_acceso->>'alcance',
        (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE,
        p_ip
    );

    RETURN jsonb_build_object('id_estudio', p_id_estudio, 'estado', 'COMPLETADO');
END;
$$;

-- 6.12 Solicitud transaccional de derivación o autorización entre salitas con alcance explícito.
CREATE OR REPLACE FUNCTION public.solicitar_derivacion_clinica(
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
    v_acceso            JSONB;
    v_id_profesional    UUID;
    v_id_paciente       UUID;
    v_id_derivacion     UUID;
    v_tipo              TEXT;
    v_alcance           TEXT;
    v_today             DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
BEGIN
    v_id_paciente := NULLIF(p_datos->>'id_paciente', '')::UUID;
    v_tipo := COALESCE(NULLIF(p_datos->>'tipo', ''), 'DERIVACION');
    v_alcance := COALESCE(
        NULLIF(p_datos->>'alcance', ''),
        CASE WHEN v_tipo = 'AUTORIZACION_ACCESO' THEN 'LONGITUDINAL' ELSE 'ESPECIALIDAD' END
    );

    v_acceso := public.verificar_acceso_clinico(
        p_usuario,
        v_id_paciente,
        p_salita,
        'GESTIONAR_DERIVACIONES_CLINICAS',
        NULL,
        NULL,
        FALSE
    );
    v_id_profesional := (v_acceso->>'id_profesional')::UUID;

    IF (v_acceso->>'via') <> 'SALITA_ASIGNADA' THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Las derivaciones deben originarse desde la salita asignada del paciente';
    END IF;

    PERFORM set_config('app.current_user_id', p_usuario::TEXT, TRUE);
    PERFORM set_config('app.current_salita_id', p_salita::TEXT, TRUE);
    PERFORM set_config('app.client_ip', COALESCE(p_ip, ''), TRUE);

    INSERT INTO public.derivaciones_autorizaciones_clinicas (
        tipo,
        alcance,
        id_paciente,
        id_salita_origen,
        id_salita_destino,
        id_profesional_destino,
        id_especialidad_destino,
        motivo,
        fecha_desde,
        fecha_hasta,
        estado,
        id_usuario_solicita,
        id_profesional_solicita
    )
    VALUES (
        v_tipo,
        v_alcance,
        v_id_paciente,
        p_salita,
        (p_datos->>'id_salita_destino')::UUID,
        NULLIF(p_datos->>'id_profesional_destino', '')::UUID,
        NULLIF(p_datos->>'id_especialidad_destino', '')::UUID,
        p_datos->>'motivo',
        COALESCE(NULLIF(p_datos->>'fecha_desde', '')::DATE, v_today),
        (p_datos->>'fecha_hasta')::DATE,
        'PENDIENTE',
        p_usuario,
        v_id_profesional
    )
    RETURNING id_derivacion INTO v_id_derivacion;

    PERFORM public.registrar_acceso_auditoria_clinica(
        p_usuario,
        v_id_paciente,
        p_salita,
        'CREACION',
        'DERIVACION_CLINICA',
        v_id_derivacion,
        p_datos->>'motivo',
        v_id_derivacion,
        v_alcance,
        v_today,
        p_ip
    );

    RETURN jsonb_build_object(
        'id_derivacion', v_id_derivacion,
        'tipo', v_tipo,
        'alcance', v_alcance,
        'estado', 'PENDIENTE'
    );
END;
$$;

-- 6.13 Resolución (autorizar / rechazar / revocar) transaccional de derivaciones o autorizaciones.
CREATE OR REPLACE FUNCTION public.resolver_derivacion_clinica(
    p_usuario       UUID,
    p_salita        UUID,
    p_id_derivacion UUID,
    p_nuevo_estado  TEXT,
    p_motivo        TEXT DEFAULT NULL,
    p_ip            TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_derivacion        public.derivaciones_autorizaciones_clinicas%ROWTYPE;
    v_rol               TEXT;
    v_id_profesional    UUID;
    v_today             DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
BEGIN
    IF p_nuevo_estado NOT IN ('AUTORIZADA', 'RECHAZADA', 'REVOCADA') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Estado de resolución inválido';
    END IF;

    SELECT * INTO v_derivacion
      FROM public.derivaciones_autorizaciones_clinicas
     WHERE id_derivacion = p_id_derivacion
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Derivación o autorización no encontrada';
    END IF;

    SELECT r.codigo INTO v_rol
      FROM public.usuarios u
      JOIN public.roles r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = p_usuario AND u.activo AND r.activo;

    IF v_rol IS NULL OR v_rol NOT IN ('PROFESIONAL', 'ADMIN_SALITA', 'SUPER_ADMIN') THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Rol no autorizado para resolver derivaciones';
    END IF;

    IF v_rol = 'PROFESIONAL' THEN
        IF NOT EXISTS (
            SELECT 1
              FROM public.usuarios u
              JOIN public.rol_permisos rp ON rp.id_rol = u.id_rol
              JOIN public.permisos pe ON pe.id_permiso = rp.id_permiso
             WHERE u.id_usuario = p_usuario
               AND pe.codigo = 'GESTIONAR_DERIVACIONES_CLINICAS'
               AND pe.activo
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El profesional no posee permiso para gestionar derivaciones clínicas';
        END IF;

        SELECT pr.id_profesional INTO v_id_profesional
          FROM public.usuarios u
          JOIN public.profesionales pr ON pr.id_persona = u.id_persona AND pr.activo
         WHERE u.id_usuario = p_usuario;

        IF v_id_profesional IS NULL OR NOT EXISTS (
            SELECT 1 FROM public.profesional_salita ps
             WHERE ps.id_profesional = v_id_profesional
               AND ps.id_salita = p_salita
               AND ps.activo
               AND ps.fecha_desde <= v_today
               AND (ps.fecha_hasta IS NULL OR ps.fecha_hasta >= v_today)
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Profesional sin vigencia en la salita indicada';
        END IF;

        IF p_nuevo_estado = 'AUTORIZADA' AND v_derivacion.id_usuario_solicita = p_usuario THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'El usuario solicitante no puede autoautorizar su propia derivación';
        END IF;
    ELSIF v_rol = 'ADMIN_SALITA' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.usuario_salita us
             WHERE us.id_usuario = p_usuario
               AND us.id_salita = p_salita
               AND us.activo
               AND us.fecha_desde <= v_today
               AND (us.fecha_hasta IS NULL OR us.fecha_hasta >= v_today)
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Administrador sin vigencia en la salita indicada';
        END IF;
    END IF;

    IF v_rol <> 'SUPER_ADMIN' AND p_salita NOT IN (v_derivacion.id_salita_origen, v_derivacion.id_salita_destino) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La salita no participa de la derivación';
    END IF;

    PERFORM set_config('app.current_user_id', p_usuario::TEXT, TRUE);
    PERFORM set_config('app.current_salita_id', p_salita::TEXT, TRUE);
    PERFORM set_config('app.client_ip', COALESCE(p_ip, ''), TRUE);

    IF p_nuevo_estado IN ('AUTORIZADA', 'RECHAZADA') THEN
        IF v_derivacion.estado <> 'PENDIENTE' THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Solo pueden resolverse solicitudes en estado PENDIENTE';
        END IF;
        IF p_nuevo_estado = 'RECHAZADA' AND NULLIF(trim(COALESCE(p_motivo, '')), '') IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Debe indicar el motivo del rechazo';
        END IF;
        IF v_rol <> 'SUPER_ADMIN' AND p_salita <> v_derivacion.id_salita_destino THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La autorización o rechazo debe emitirse desde la salita de destino';
        END IF;

        UPDATE public.derivaciones_autorizaciones_clinicas
           SET estado = p_nuevo_estado,
               id_usuario_autoriza = p_usuario,
               fecha_resolucion = NOW(),
               motivo_resolucion = NULLIF(trim(COALESCE(p_motivo, '')), '')
         WHERE id_derivacion = p_id_derivacion;
    ELSE
        IF v_derivacion.estado <> 'AUTORIZADA' THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Solo pueden revocarse autorizaciones vigentes en estado AUTORIZADA';
        END IF;
        IF NULLIF(trim(COALESCE(p_motivo, '')), '') IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Debe indicar el motivo de la revocación';
        END IF;

        UPDATE public.derivaciones_autorizaciones_clinicas
           SET estado = 'REVOCADA',
               id_usuario_revoca = p_usuario,
               fecha_revocacion = NOW(),
               motivo_revocacion = trim(p_motivo)
         WHERE id_derivacion = p_id_derivacion;
    END IF;

    PERFORM public.registrar_acceso_auditoria_clinica(
        p_usuario,
        v_derivacion.id_paciente,
        p_salita,
        'MODIFICACION',
        'DERIVACION_CLINICA',
        p_id_derivacion,
        COALESCE(NULLIF(trim(COALESCE(p_motivo, '')), ''), 'Cambio de estado de derivación clínica a ' || p_nuevo_estado),
        p_id_derivacion,
        CASE WHEN v_rol = 'PROFESIONAL' THEN v_derivacion.alcance ELSE 'ADMINISTRATIVO' END,
        v_today,
        p_ip
    );

    RETURN jsonb_build_object('id_derivacion', p_id_derivacion, 'estado', p_nuevo_estado);
END;
$$;

-- 6.14 Consulta controlada de derivaciones de una salita (sin exponer datos clínicos).
CREATE OR REPLACE FUNCTION public.listar_derivaciones_clinicas(
    p_usuario   UUID,
    p_salita    UUID,
    p_paciente  UUID DEFAULT NULL,
    p_estado    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_rol               TEXT;
    v_id_persona        UUID;
    v_id_profesional    UUID;
    v_today             DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
    v_rows              JSONB;
BEGIN
    SELECT r.codigo, u.id_persona
      INTO v_rol, v_id_persona
      FROM public.usuarios u
      JOIN public.roles r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = p_usuario AND u.activo AND r.activo;

    IF v_rol IS NULL OR v_rol NOT IN ('PROFESIONAL', 'ADMIN_SALITA', 'SUPER_ADMIN') THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado a consultar derivaciones';
    END IF;

    IF v_rol = 'PROFESIONAL' THEN
        IF NOT EXISTS (
            SELECT 1
              FROM public.usuarios u
              JOIN public.rol_permisos rp ON rp.id_rol = u.id_rol
              JOIN public.permisos pe ON pe.id_permiso = rp.id_permiso
             WHERE u.id_usuario = p_usuario
               AND pe.codigo = 'GESTIONAR_DERIVACIONES_CLINICAS'
               AND pe.activo
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Falta permiso GESTIONAR_DERIVACIONES_CLINICAS';
        END IF;

        SELECT pr.id_profesional INTO v_id_profesional
          FROM public.profesionales pr
         WHERE pr.id_persona = v_id_persona AND pr.activo;

        IF v_id_profesional IS NULL OR NOT EXISTS (
            SELECT 1 FROM public.profesional_salita ps
             WHERE ps.id_profesional = v_id_profesional
               AND ps.id_salita = p_salita
               AND ps.activo
               AND ps.fecha_desde <= v_today
               AND (ps.fecha_hasta IS NULL OR ps.fecha_hasta >= v_today)
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Profesional sin vigencia en la salita indicada';
        END IF;
    ELSIF v_rol = 'ADMIN_SALITA' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.usuario_salita us
             WHERE us.id_usuario = p_usuario
               AND us.id_salita = p_salita
               AND us.activo
               AND us.fecha_desde <= v_today
               AND (us.fecha_hasta IS NULL OR us.fecha_hasta >= v_today)
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Administrador sin vigencia en la salita indicada';
        END IF;
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(d.*) ORDER BY d.fecha_creacion DESC), '[]'::jsonb)
      INTO v_rows
      FROM public.derivaciones_autorizaciones_clinicas d
     WHERE (v_rol = 'SUPER_ADMIN' OR p_salita IN (d.id_salita_origen, d.id_salita_destino))
       AND (p_paciente IS NULL OR d.id_paciente = p_paciente)
       AND (p_estado IS NULL OR d.estado = p_estado);

    RETURN v_rows;
END;
$$;

-- 6.15 Consulta controlada y auditada sobre auditoria_clinica con protección antirrecursión.
CREATE OR REPLACE FUNCTION public.consultar_auditoria_clinica(
    p_usuario       UUID,
    p_salita        UUID DEFAULT NULL,
    p_paciente      UUID DEFAULT NULL,
    p_fecha_desde   TIMESTAMPTZ DEFAULT NULL,
    p_fecha_hasta   TIMESTAMPTZ DEFAULT NULL,
    p_limit         INTEGER DEFAULT 50,
    p_offset        INTEGER DEFAULT 0,
    p_ip            TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_rol               TEXT;
    v_id_rol            UUID;
    v_id_persona        UUID;
    v_id_profesional    UUID;
    v_today             DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
    v_rows              JSONB;
BEGIN
    IF p_fecha_desde IS NOT NULL AND p_fecha_hasta IS NOT NULL AND p_fecha_desde > p_fecha_hasta THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La fecha_desde no puede ser posterior a fecha_hasta';
    END IF;

    IF p_limit IS NOT NULL AND (p_limit < 1 OR p_limit > 200) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El límite de auditoría debe estar entre 1 y 200';
    END IF;

    IF p_offset IS NOT NULL AND p_offset < 0 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El offset de auditoría no puede ser negativo';
    END IF;

    SELECT r.id_rol, r.codigo, u.id_persona
      INTO v_id_rol, v_rol, v_id_persona
      FROM public.usuarios u
      JOIN public.roles r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = p_usuario AND u.activo AND r.activo;

    IF NOT FOUND OR NOT EXISTS (
        SELECT 1
          FROM public.rol_permisos rp
          JOIN public.permisos pe ON pe.id_permiso = rp.id_permiso
         WHERE rp.id_rol = v_id_rol
           AND pe.codigo = 'VER_AUDITORIA_CLINICA'
           AND pe.activo
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No posee el permiso VER_AUDITORIA_CLINICA';
    END IF;

    IF v_rol = 'SUPER_ADMIN' THEN
        IF p_salita IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.salitas s WHERE s.id_salita = p_salita AND s.activo
        ) THEN
            RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Salita inexistente o inactiva para consulta de auditoría';
        END IF;
    ELSIF v_rol = 'PROFESIONAL' THEN
        IF p_salita IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Debe especificar la salita para consultar auditoría clínica';
        END IF;

        SELECT pr.id_profesional INTO v_id_profesional
          FROM public.profesionales pr
         WHERE pr.id_persona = v_id_persona AND pr.activo;

        IF v_id_profesional IS NULL OR NOT EXISTS (
            SELECT 1
              FROM public.profesional_salita ps
              JOIN public.salitas s ON s.id_salita = ps.id_salita
             WHERE ps.id_profesional = v_id_profesional
               AND ps.id_salita = p_salita
               AND ps.activo
               AND s.activo
               AND ps.fecha_desde <= v_today
               AND (ps.fecha_hasta IS NULL OR ps.fecha_hasta >= v_today)
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Salita fuera del alcance vigente del profesional';
        END IF;
    ELSIF v_rol IN ('ADMIN_SALITA', 'RECEPCION') THEN
        IF p_salita IS NULL OR NOT EXISTS (
            SELECT 1
              FROM public.usuario_salita us
              JOIN public.salitas s ON s.id_salita = us.id_salita
             WHERE us.id_usuario = p_usuario
               AND us.id_salita = p_salita
               AND us.activo
               AND s.activo
               AND us.fecha_desde <= v_today
               AND (us.fecha_hasta IS NULL OR us.fecha_hasta >= v_today)
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Salita fuera del alcance vigente del usuario';
        END IF;
    ELSE
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Rol no habilitado para consultar auditoría clínica';
    END IF;

    IF p_paciente IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.pacientes pa WHERE pa.id_paciente = p_paciente AND pa.activo
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Paciente inexistente o inactivo para filtro de auditoría';
    END IF;

    -- Registra la consulta a auditoría clínica con protección transaccional antirrecursión.
    IF COALESCE(current_setting('app.auditando_consulta_auditoria', TRUE), '') <> 'true' THEN
        PERFORM set_config('app.auditando_consulta_auditoria', 'true', TRUE);

        INSERT INTO public.auditoria_accesos_auditoria (
            id_usuario,
            rol_usuario,
            id_salita,
            id_paciente_filtrado,
            filtros,
            ip_origen
        )
        VALUES (
            p_usuario,
            v_rol,
            p_salita,
            p_paciente,
            jsonb_build_object(
                'fecha_desde', p_fecha_desde,
                'fecha_hasta', p_fecha_hasta,
                'limit', LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200),
                'offset', GREATEST(COALESCE(p_offset, 0), 0)
            ),
            NULLIF(trim(COALESCE(p_ip, '')), '')::INET
        );

        PERFORM set_config('app.auditando_consulta_auditoria', 'false', TRUE);
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(sub.*)), '[]'::jsonb)
      INTO v_rows
      FROM (
          SELECT ac.*
            FROM public.auditoria_clinica ac
           WHERE (p_salita IS NULL OR ac.id_salita = p_salita)
             AND (p_paciente IS NULL OR ac.id_paciente = p_paciente)
             AND (p_fecha_desde IS NULL OR ac.fecha_hora >= p_fecha_desde)
             AND (p_fecha_hasta IS NULL OR ac.fecha_hora <= p_fecha_hasta)
           ORDER BY ac.fecha_hora DESC, ac.id_auditoria_clinica DESC
           LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
          OFFSET GREATEST(COALESCE(p_offset, 0), 0)
      ) sub;

    RETURN v_rows;
END;
$$;

/* ========================================================================== */
/* 7. SEGURIDAD RLS Y REGLAS DE ACCESO ESTRICTO VÍA RPC                       */
/* ========================================================================== */

ALTER TABLE public.historias_clinicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.antecedentes_clinicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alergias_paciente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas_medicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnosticos_clinicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evoluciones_clinicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tratamientos_clinicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estudios_clinicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.derivaciones_autorizaciones_clinicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.derivaciones_autorizaciones_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_clinica ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_accesos_auditoria ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.historias_clinicas FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.antecedentes_clinicos FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.alergias_paciente FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.consultas_medicas FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.diagnosticos_clinicos FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.evoluciones_clinicas FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.tratamientos_clinicos FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.estudios_clinicos FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.derivaciones_autorizaciones_clinicas FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.derivaciones_autorizaciones_historial FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.auditoria_clinica FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.auditoria_accesos_auditoria FROM PUBLIC, anon, authenticated, service_role;

-- Funciones internas y de triggers no ejecutables ni siquiera por service_role.
REVOKE ALL ON FUNCTION public.impedir_eliminacion_clinica() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.inmutabilidad_auditoria_clinica() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.validar_derivacion_clinica() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.validar_consistencia_historia_clinica() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.proteger_autoria_antecedente_alergia() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.validar_consistencia_detalle_consulta() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.proteger_autoria_detalle_consulta() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.validar_consulta_medica() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.proteger_consulta_firmada() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.proteger_evolucion_firmada() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.registrar_historial_derivacion_clinica() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.registrar_acceso_auditoria_clinica(UUID, UUID, UUID, TEXT, TEXT, UUID, TEXT, UUID, TEXT, DATE, TEXT) FROM PUBLIC, anon, authenticated, service_role;

-- Solo las RPC públicas del módulo quedan ejecutables por service_role.
REVOKE ALL ON FUNCTION public.verificar_acceso_clinico(UUID, UUID, UUID, TEXT, DATE, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consultar_historia_clinica(UUID, UUID, UUID, UUID, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consultar_consulta_medica(UUID, UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_consulta_clinica(UUID, UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.firmar_consulta_medica(UUID, UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.anular_consulta_borrador(UUID, UUID, UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_evolucion_clinica(UUID, UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rectificar_evolucion_clinica(UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.actualizar_estado_estudio_clinico(UUID, UUID, UUID, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.informar_estudio_clinico(UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.solicitar_derivacion_clinica(UUID, UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolver_derivacion_clinica(UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.listar_derivaciones_clinicas(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consultar_auditoria_clinica(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.verificar_acceso_clinico(UUID, UUID, UUID, TEXT, DATE, UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.consultar_historia_clinica(UUID, UUID, UUID, UUID, TEXT, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.consultar_consulta_medica(UUID, UUID, UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_consulta_clinica(UUID, UUID, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.firmar_consulta_medica(UUID, UUID, UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.anular_consulta_borrador(UUID, UUID, UUID, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_evolucion_clinica(UUID, UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rectificar_evolucion_clinica(UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.actualizar_estado_estudio_clinico(UUID, UUID, UUID, TEXT, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.informar_estudio_clinico(UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.solicitar_derivacion_clinica(UUID, UUID, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolver_derivacion_clinica(UUID, UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.listar_derivaciones_clinicas(UUID, UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.consultar_auditoria_clinica(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER, TEXT) TO service_role;

-- El backend no necesita crear objetos en public; se elimina CREATE de los roles de API.
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated, service_role;

-- Verificación en tiempo de migración de RLS, ownership, search_path y ACL efectivos.
-- PUBLIC se inspecciona mediante ACL (grantee = 0); no se trata como un rol de pg_roles.
DO $$
DECLARE
    v_tablas TEXT[] := ARRAY[
        'historias_clinicas','derivaciones_autorizaciones_clinicas',
        'derivaciones_autorizaciones_historial','antecedentes_clinicos',
        'alergias_paciente','consultas_medicas','diagnosticos_clinicos',
        'evoluciones_clinicas','tratamientos_clinicos','estudios_clinicos',
        'auditoria_clinica','auditoria_accesos_auditoria'
    ];
    v_rpcs TEXT[] := ARRAY[
        'verificar_acceso_clinico','consultar_historia_clinica','consultar_consulta_medica',
        'registrar_consulta_clinica','firmar_consulta_medica','anular_consulta_borrador',
        'registrar_evolucion_clinica','rectificar_evolucion_clinica',
        'actualizar_estado_estudio_clinico','informar_estudio_clinico',
        'solicitar_derivacion_clinica','resolver_derivacion_clinica',
        'listar_derivaciones_clinicas','consultar_auditoria_clinica'
    ];
    v_internas TEXT[] := ARRAY[
        'impedir_eliminacion_clinica','inmutabilidad_auditoria_clinica',
        'validar_derivacion_clinica','validar_consistencia_historia_clinica',
        'proteger_autoria_antecedente_alergia','validar_consistencia_detalle_consulta',
        'proteger_autoria_detalle_consulta','validar_consulta_medica',
        'proteger_consulta_firmada','proteger_evolucion_firmada',
        'registrar_historial_derivacion_clinica','registrar_acceso_auditoria_clinica'
    ];
    v_tbl TEXT;
    v_fn TEXT;
    v_owner_ref OID;
    v_owner_cur OID;
    v_oid OID;
    v_config TEXT[];
    v_secdef BOOLEAN;
    v_count INTEGER;
    v_role TEXT;
    v_role_oid OID;
    v_acl ACLITEM[];
    v_priv TEXT;
BEGIN
    SELECT c.relowner INTO v_owner_ref
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'historias_clinicas';
    IF v_owner_ref IS NULL THEN
        RAISE EXCEPTION 'No se encontró la tabla base public.historias_clinicas';
    END IF;

    FOREACH v_tbl IN ARRAY v_tablas LOOP
        SELECT c.relrowsecurity, c.relowner, COALESCE(c.relacl, acldefault('r', c.relowner))
          INTO v_secdef, v_owner_cur, v_acl
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = v_tbl AND c.relkind IN ('r','p');
        IF NOT FOUND OR NOT COALESCE(v_secdef, FALSE) THEN
            RAISE EXCEPTION 'Tabla public.% inexistente o sin RLS habilitado', v_tbl;
        END IF;
        IF v_owner_cur <> v_owner_ref THEN
            RAISE EXCEPTION 'Owner inconsistente en tabla public.%', v_tbl;
        END IF;
        IF EXISTS (
            SELECT 1 FROM aclexplode(v_acl) a
             WHERE a.grantee = 0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
        ) THEN
            RAISE EXCEPTION 'PUBLIC conserva privilegios sobre public.%', v_tbl;
        END IF;
        FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
            SELECT oid INTO v_role_oid FROM pg_catalog.pg_roles WHERE rolname = v_role;
            IF v_role_oid IS NOT NULL THEN
                FOREACH v_priv IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
                    IF has_table_privilege(v_role_oid, format('public.%I', v_tbl), v_priv) THEN
                        RAISE EXCEPTION 'El rol % conserva % sobre public.%', v_role, v_priv, v_tbl;
                    END IF;
                END LOOP;
            END IF;
        END LOOP;
    END LOOP;

    -- El esquema public no debe permitir CREATE a PUBLIC ni a roles de API.
    SELECT n.nspacl INTO v_acl FROM pg_catalog.pg_namespace n WHERE n.nspname = 'public';
    IF EXISTS (SELECT 1 FROM aclexplode(COALESCE(v_acl, acldefault('n', (SELECT nspowner FROM pg_catalog.pg_namespace WHERE nspname='public')))) a
                WHERE a.grantee = 0 AND a.privilege_type = 'CREATE') THEN
        RAISE EXCEPTION 'PUBLIC conserva CREATE sobre el esquema public';
    END IF;
    FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
        SELECT oid INTO v_role_oid FROM pg_catalog.pg_roles WHERE rolname = v_role;
        IF v_role_oid IS NOT NULL AND has_schema_privilege(v_role_oid, 'public', 'CREATE') THEN
            RAISE EXCEPTION 'El rol % conserva CREATE sobre el esquema public', v_role;
        END IF;
    END LOOP;

    FOREACH v_fn IN ARRAY v_rpcs LOOP
        SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
          JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname=v_fn;
        IF v_count <> 1 THEN RAISE EXCEPTION 'RPC % tiene % sobrecargas; se esperaba exactamente una', v_fn, v_count; END IF;
        SELECT p.oid,p.prosecdef,p.proowner,p.proconfig,COALESCE(p.proacl,acldefault('f',p.proowner))
          INTO v_oid,v_secdef,v_owner_cur,v_config,v_acl
          FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname=v_fn;
        IF NOT v_secdef OR v_owner_cur <> v_owner_ref THEN RAISE EXCEPTION 'SECURITY DEFINER u owner inválido en RPC %',v_fn; END IF;
        IF NOT EXISTS (SELECT 1 FROM unnest(COALESCE(v_config,ARRAY[]::TEXT[])) cfg
                        WHERE replace(replace(lower(cfg), '"',''),' ','')='search_path=pg_catalog,public,pg_temp') THEN
            RAISE EXCEPTION 'search_path inesperado en RPC %: %',v_fn,v_config;
        END IF;
        IF EXISTS (SELECT 1 FROM aclexplode(v_acl) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') THEN
            RAISE EXCEPTION 'PUBLIC conserva EXECUTE sobre RPC %',v_fn;
        END IF;
        FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
            SELECT oid INTO v_role_oid FROM pg_catalog.pg_roles WHERE rolname=v_role;
            IF v_role_oid IS NOT NULL AND has_function_privilege(v_role_oid,v_oid,'EXECUTE') THEN
                RAISE EXCEPTION 'El rol % puede ejecutar RPC %',v_role,v_fn;
            END IF;
        END LOOP;
        SELECT oid INTO v_role_oid FROM pg_catalog.pg_roles WHERE rolname='service_role';
        IF v_role_oid IS NULL OR NOT has_function_privilege(v_role_oid,v_oid,'EXECUTE') THEN
            RAISE EXCEPTION 'service_role no puede ejecutar RPC %',v_fn;
        END IF;
    END LOOP;

    FOREACH v_fn IN ARRAY v_internas LOOP
        SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
          JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname=v_fn;
        IF v_count <> 1 THEN RAISE EXCEPTION 'Función interna % tiene % sobrecargas; se esperaba exactamente una',v_fn,v_count; END IF;
        SELECT p.oid,p.proowner,p.proconfig,COALESCE(p.proacl,acldefault('f',p.proowner))
          INTO v_oid,v_owner_cur,v_config,v_acl
          FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname=v_fn;
        IF v_owner_cur <> v_owner_ref THEN RAISE EXCEPTION 'Owner inconsistente en función interna %',v_fn; END IF;
        IF NOT EXISTS (SELECT 1 FROM unnest(COALESCE(v_config,ARRAY[]::TEXT[])) cfg
                        WHERE replace(replace(lower(cfg), '"',''),' ','')='search_path=pg_catalog,public,pg_temp') THEN
            RAISE EXCEPTION 'search_path inesperado en función interna %: %',v_fn,v_config;
        END IF;
        IF EXISTS (SELECT 1 FROM aclexplode(v_acl) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') THEN
            RAISE EXCEPTION 'PUBLIC conserva EXECUTE sobre función interna %',v_fn;
        END IF;
        FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
            SELECT oid INTO v_role_oid FROM pg_catalog.pg_roles WHERE rolname=v_role;
            IF v_role_oid IS NOT NULL AND has_function_privilege(v_role_oid,v_oid,'EXECUTE') THEN
                RAISE EXCEPTION 'El rol % puede ejecutar función interna %',v_role,v_fn;
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
