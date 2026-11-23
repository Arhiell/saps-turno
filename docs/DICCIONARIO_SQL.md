# 🗃️ Diccionario SQL por archivo de origen

[Índice](README.md) · [Modelo de datos](BASE_DE_DATOS.md) · [Orden de migraciones](MIGRACIONES.md)

Referencia extraída del DDL local: reproduce declaraciones de creación y alteración de tablas, e inventaría funciones, vistas, índices y triggers. Las columnas muestran sus tipos, valores predeterminados, nulabilidad y restricciones tal como se declaran en cada origen. Para obtener el esquema efectivo hay que aplicar las evoluciones en orden; esta referencia no es una introspección de una base desplegada ni un script para ejecutar.

Las funciones pueden tener varias definiciones históricas. Consultar la última migración aplicada y su cuerpo en el enlace de origen. Las declaraciones extraídas pueden pertenecer a bloques condicionales: conservar el contexto del archivo completo al operar. El orden de las secciones del catálogo no reemplaza el orden de migraciones.

## SAPS_Turno_BBDD3_FINAL.sql

[Fuente completa](../backend/src/BBDD/SAPS_Turno_BBDD3_FINAL.sql)

```sql
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
```

```sql
CREATE TABLE public.permisos (
    id_permiso          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo              VARCHAR(80) NOT NULL UNIQUE,
    nombre              VARCHAR(120) NOT NULL,
    descripcion         TEXT,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_permisos_codigo CHECK (codigo ~ '^[A-Z][A-Z0-9_]*$')
);
```

```sql
CREATE TABLE public.rol_permisos (
    id_rol              UUID NOT NULL REFERENCES public.roles(id_rol) ON DELETE CASCADE,
    id_permiso          UUID NOT NULL REFERENCES public.permisos(id_permiso) ON DELETE CASCADE,
    fecha_asignacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id_rol, id_permiso)
);
```

```sql
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
```

```sql
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
```

```sql
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
```

```sql
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
```

```sql
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
```

```sql
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
```

```sql
CREATE TABLE public.zonas (
    id_zona             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre              VARCHAR(100) NOT NULL,
    descripcion         TEXT,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

```sql
CREATE TABLE public.barrios (
    id_barrio           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_zona             UUID NOT NULL REFERENCES public.zonas(id_zona) ON DELETE RESTRICT,
    nombre              VARCHAR(120) NOT NULL,
    codigo_postal       VARCHAR(12),
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

```sql
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
```

```sql
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
```

```sql
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
```

```sql
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
```

```sql
CREATE TABLE public.tutores (
    id_tutor            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_persona          UUID NOT NULL UNIQUE
                        REFERENCES public.personas(id_persona) ON DELETE RESTRICT,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

```sql
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
```

```sql
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
```

```sql
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
```

```sql
CREATE TABLE public.profesional_especialidad (
    id_profesional      UUID NOT NULL REFERENCES public.profesionales(id_profesional) ON DELETE CASCADE,
    id_especialidad     UUID NOT NULL REFERENCES public.especialidades(id_especialidad) ON DELETE RESTRICT,
    fecha_desde         DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_hasta         DATE,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_profesional, id_especialidad),
    CONSTRAINT ck_prof_especialidad_fechas CHECK (fecha_hasta IS NULL OR fecha_hasta >= fecha_desde)
);
```

```sql
CREATE TABLE public.profesional_salita (
    id_profesional      UUID NOT NULL REFERENCES public.profesionales(id_profesional) ON DELETE CASCADE,
    id_salita           UUID NOT NULL REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    fecha_desde         DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_hasta         DATE,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_profesional, id_salita),
    CONSTRAINT ck_prof_salita_fechas CHECK (fecha_hasta IS NULL OR fecha_hasta >= fecha_desde)
);
```

```sql
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
```

```sql
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
```

```sql
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
```

```sql
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
```

```sql
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
```

```sql
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
```

```sql
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
```

```sql
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
```

```sql
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
```

### Evoluciones de tablas

```sql
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
ALTER TABLE public.turnos
    ADD CONSTRAINT ex_turnos_profesional_solapados
    EXCLUDE USING gist (id_profesional WITH =, periodo WITH &&)
    WHERE (ocupa_agenda);
ALTER TABLE public.turnos
    ADD CONSTRAINT ex_turnos_paciente_solapados
    EXCLUDE USING gist (id_paciente WITH =, periodo WITH &&)
    WHERE (ocupa_agenda);
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
```

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| FUNCTION | `public.actualizar_fecha_modificacion` |
| INDEX | `ix_personas_nombre` |
| INDEX | `ix_personas_activo` |
| UNIQUE INDEX | `uq_personas_email_lower` |
| UNIQUE INDEX | `uq_usuarios_nombre_lower` |
| UNIQUE INDEX | `uq_usuarios_email_lower` |
| INDEX | `ix_usuarios_rol` |
| INDEX | `ix_sesiones_usuario` |
| INDEX | `ix_sesiones_vigentes` |
| INDEX | `ix_tokens_recuperacion_usuario` |
| INDEX | `ix_tokens_verificacion_email_usuario` |
| INDEX | `ix_usuario_identidades_usuario` |
| UNIQUE INDEX | `uq_zonas_nombre_lower` |
| UNIQUE INDEX | `uq_barrios_zona_nombre` |
| INDEX | `ix_barrios_zona` |
| UNIQUE INDEX | `uq_salitas_nombre_lower` |
| INDEX | `ix_salitas_barrio` |
| INDEX | `ix_salita_barrios_barrio` |
| UNIQUE INDEX | `uq_salita_barrio_sede` |
| INDEX | `ix_usuario_salita_salita` |
| UNIQUE INDEX | `uq_usuario_salita_principal` |
| INDEX | `ix_pacientes_barrio` |
| INDEX | `ix_pacientes_salita` |
| FUNCTION | `public.validar_cobertura_paciente` |
| TRIGGER | `tr_pacientes_validar_cobertura` |
| FUNCTION | `public.validar_persona_paciente` |
| TRIGGER | `tr_pacientes_validar_persona` |
| FUNCTION | `public.proteger_datos_persona_paciente` |
| TRIGGER | `tr_personas_proteger_paciente` |
| FUNCTION | `public.validar_persona_tutor` |
| TRIGGER | `tr_tutores_validar_persona` |
| FUNCTION | `public.proteger_datos_persona_tutor` |
| TRIGGER | `tr_personas_proteger_tutor` |
| INDEX | `ix_paciente_tutores_tutor` |
| UNIQUE INDEX | `uq_paciente_tutor_principal` |
| UNIQUE INDEX | `uq_especialidades_nombre_lower` |
| FUNCTION | `public.validar_persona_profesional` |
| TRIGGER | `tr_profesionales_validar_persona` |
| INDEX | `ix_prof_especialidad_especialidad` |
| INDEX | `ix_prof_salita_salita` |
| INDEX | `ix_horarios_busqueda` |
| INDEX | `ix_horarios_profesional` |
| INDEX | `ix_bloqueos_agenda_busqueda` |
| INDEX | `ix_turnos_paciente_fecha` |
| INDEX | `ix_turnos_agenda` |
| INDEX | `ix_turnos_especialidad` |
| INDEX | `ix_turnos_estado` |
| UNIQUE INDEX | `uq_turno_abierto_paciente_especialidad` |
| FUNCTION | `public.sincronizar_estado_turno` |
| TRIGGER | `tr_turnos_sincronizar_estado` |
| FUNCTION | `public.validar_turno` |
| TRIGGER | `tr_turnos_validar` |
| FUNCTION | `public.validar_bloqueo_agenda` |
| TRIGGER | `tr_bloqueos_validar` |
| INDEX | `ix_historial_turno_fecha` |
| FUNCTION | `public.registrar_historial_turno` |
| TRIGGER | `tr_turnos_historial` |
| INDEX | `ix_sanciones_vigentes` |
| FUNCTION | `public.validar_sancion` |
| TRIGGER | `tr_sanciones_validar` |
| FUNCTION | `public.validar_sancion_turno` |
| TRIGGER | `tr_turnos_validar_sancion` |
| INDEX | `ix_notificaciones_usuario` |
| INDEX | `ix_notificaciones_pendientes` |
| UNIQUE INDEX | `uq_configuracion_global` |
| UNIQUE INDEX | `uq_configuracion_salita` |
| INDEX | `ix_auditoria_entidad` |
| INDEX | `ix_auditoria_usuario` |
| INDEX | `ix_auditoria_salita` |
| FUNCTION | `public.auditar_cambios` |
| TRIGGER | `tr_auditar_personas` |
| TRIGGER | `tr_auditar_usuarios` |
| TRIGGER | `tr_auditar_salitas` |
| TRIGGER | `tr_auditar_pacientes` |
| TRIGGER | `tr_auditar_tutores` |
| TRIGGER | `tr_auditar_paciente_tutores` |
| TRIGGER | `tr_auditar_profesionales` |
| TRIGGER | `tr_auditar_horarios` |
| TRIGGER | `tr_auditar_bloqueos` |
| TRIGGER | `tr_auditar_turnos` |
| TRIGGER | `tr_auditar_sanciones` |
| TRIGGER | `tr_roles_fecha` |
| TRIGGER | `tr_personas_fecha` |
| TRIGGER | `tr_usuarios_fecha` |
| TRIGGER | `tr_zonas_fecha` |
| TRIGGER | `tr_barrios_fecha` |
| TRIGGER | `tr_salitas_fecha` |
| TRIGGER | `tr_pacientes_fecha` |
| TRIGGER | `tr_tutores_fecha` |
| TRIGGER | `tr_especialidades_fecha` |
| TRIGGER | `tr_profesionales_fecha` |
| TRIGGER | `tr_horarios_fecha` |
| TRIGGER | `tr_configuracion_fecha` |
| VIEW | `public.vw_agenda_turnos` |
| VIEW | `public.vw_resumen_turnos_diarios` |


## 20260926_email_verification_attempts.sql

[Fuente completa](../backend/src/BBDD/20260926_email_verification_attempts.sql)

### Evoluciones de tablas

```sql
ALTER TABLE public.tokens_verificacion_email
  ADD COLUMN IF NOT EXISTS intentos SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE public.tokens_verificacion_email
      ADD CONSTRAINT ck_token_email_intentos CHECK (intentos BETWEEN 0 AND 5);
```


## 20260929_password_recovery_codes.sql

[Fuente completa](../backend/src/BBDD/20260929_password_recovery_codes.sql)

### Evoluciones de tablas

```sql
ALTER TABLE public.tokens_recuperacion
  ADD COLUMN IF NOT EXISTS intentos SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE public.tokens_recuperacion
      ADD CONSTRAINT ck_token_recuperacion_intentos CHECK (intentos BETWEEN 0 AND 5);
```

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| FUNCTION | `public.emitir_codigo_recuperacion` |
| FUNCTION | `public.consumir_codigo_recuperacion` |


## 20260929_patient_email_change.sql

[Fuente completa](../backend/src/BBDD/20260929_patient_email_change.sql)

### Evoluciones de tablas

```sql
ALTER TABLE public.tokens_verificacion_email
  ADD COLUMN IF NOT EXISTS intentos SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nuevo_email VARCHAR(254),
  ADD COLUMN IF NOT EXISTS email_anterior VARCHAR(254);
```

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| FUNCTION | `public.emitir_codigo_email` |
| FUNCTION | `public.consumir_codigo_email` |


## 20261006_notificaciones_audiencia.sql

[Fuente completa](../backend/src/BBDD/20261006_notificaciones_audiencia.sql)

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| FUNCTION | `public.notificacion_destinatarios` |
| FUNCTION | `public.notificacion_preview` |


## 20261006_notificaciones_edicion.sql

[Fuente completa](../backend/src/BBDD/20261006_notificaciones_edicion.sql)

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| FUNCTION | `public.notificacion_resumen_fallas` |
| FUNCTION | `public.notificacion_editar_envio` |
| FUNCTION | `public.notificacion_cancelar_envio` |
| FUNCTION | `public.notificacion_reclamar` |


## 20261006_notificaciones_envios.sql

[Fuente completa](../backend/src/BBDD/20261006_notificaciones_envios.sql)

```sql
CREATE TABLE public.notificacion_envios (
  id_envio uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave uuid NOT NULL UNIQUE,
  id_remitente uuid NOT NULL REFERENCES public.usuarios(id_usuario),
  id_salita uuid REFERENCES public.salitas(id_salita),
  remitente text NOT NULL,
  rol_remitente text NOT NULL,
  audiencia jsonb NOT NULL,
  destinatarios text NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  titulo varchar(160) NOT NULL,
  mensaje text NOT NULL CHECK (char_length(mensaje) BETWEEN 3 AND 2000),
  email boolean NOT NULL,
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_programada timestamptz,
  cancelada boolean NOT NULL DEFAULT false
);
```

### Evoluciones de tablas

```sql
ALTER TABLE public.notificacion_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones
  ADD COLUMN id_envio uuid REFERENCES public.notificacion_envios(id_envio),
  ADD COLUMN remitente text,
  ADD COLUMN procesamiento uuid,
  ADD COLUMN procesamiento_desde timestamptz;
```

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| UNIQUE INDEX | `uq_notificacion_entrega` |
| INDEX | `ix_envios_historial` |
| TRIGGER | `tr_auditar_notificacion_envios` |
| VIEW | `public.notificacion_envios_resumen` |
| FUNCTION | `public.notificacion_crear_envio` |
| FUNCTION | `public.notificacion_cancelar_envio` |
| FUNCTION | `public.notificacion_resumen_fallas` |


## 20261006_notificaciones_excluir_remitente.sql

[Fuente completa](../backend/src/BBDD/20261006_notificaciones_excluir_remitente.sql)

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| FUNCTION | `public.notificacion_preview_v2` |
| FUNCTION | `public.notificacion_crear_envio` |
| FUNCTION | `public.notificacion_editar_envio` |


## 20261006_notificaciones_worker.sql

[Fuente completa](../backend/src/BBDD/20261006_notificaciones_worker.sql)

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| FUNCTION | `public.notificacion_reclamar` |


## 20261006_unique_person_email.sql

[Fuente completa](../backend/src/BBDD/20261006_unique_person_email.sql)

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| UNIQUE INDEX | `uq_personas_email_lower` |


## 20261007_contenido_publico.sql

[Fuente completa](../backend/src/BBDD/20261007_contenido_publico.sql)

```sql
CREATE TABLE public.categorias_publicas (
  id_categoria UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(80) NOT NULL UNIQUE,
  es_aviso BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);
```

```sql
CREATE TABLE public.noticias_publicas (
  id_noticia UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo VARCHAR(160) NOT NULL CHECK (length(trim(titulo)) > 0),
  resumen VARCHAR(300) NOT NULL CHECK (length(trim(resumen)) > 0),
  contenido TEXT NOT NULL CHECK (length(contenido) BETWEEN 1 AND 20000),
  imagen_url VARCHAR(2048),
  id_autor UUID NOT NULL REFERENCES public.usuarios(id_usuario),
  id_salita UUID REFERENCES public.salitas(id_salita),
  id_categoria UUID NOT NULL REFERENCES public.categorias_publicas(id_categoria),
  estado VARCHAR(12) NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR','PUBLICADA','ARCHIVADA')),
  destacada BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_publicacion TIMESTAMPTZ,
  fecha_finalizacion TIMESTAMPTZ,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (estado <> 'PUBLICADA' OR fecha_publicacion IS NOT NULL),
  CHECK (fecha_finalizacion IS NULL OR fecha_finalizacion > fecha_publicacion)
);
```

### Evoluciones de tablas

```sql
ALTER TABLE public.categorias_publicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noticias_publicas ENABLE ROW LEVEL SECURITY;
```

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| INDEX | `ix_noticias_publicas_vigencia` |
| INDEX | `ix_noticias_publicas_autor` |
| TRIGGER | `tr_auditar_noticias_publicas` |
| FUNCTION | `public.guardar_noticia_publica` |


## 20261011_admin_profile.sql

[Fuente completa](../backend/src/BBDD/20261011_admin_profile.sql)

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| FUNCTION | `public.completar_perfil_administrativo` |


## 20261020_sancion_global_inasistencia.sql

[Fuente completa](../backend/src/BBDD/20261020_sancion_global_inasistencia.sql)

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| INDEX | `ix_sanciones_paciente_vigentes` |
| FUNCTION | `public.validar_sancion_turno` |
| FUNCTION | `public.sancionar_inasistencia_turno` |
| TRIGGER | `tr_turnos_sancionar_inasistencia` |


## 20261031_solicitudes_vinculacion.sql

[Fuente completa](../backend/src/BBDD/20261031_solicitudes_vinculacion.sql)

```sql
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
```

```sql
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
```

### Evoluciones de tablas

```sql
ALTER TABLE public.paciente_tutores
    ADD COLUMN IF NOT EXISTS id_usuario_creo UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS id_usuario_modifico UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS fecha_modificacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS identidad_verificada BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS documentacion_verificada BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS autorizacion_verificada BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.solicitudes_vinculacion
    ADD COLUMN IF NOT EXISTS identidad_verificada BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS documentacion_verificada BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS autorizacion_verificada BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.solicitudes_vinculacion
            ADD CONSTRAINT ck_solicitud_vinculacion_verificaciones
            CHECK (estado <> 'APROBADA' OR (
                identidad_verificada AND documentacion_verificada AND autorizacion_verificada
            ));
ALTER TABLE public.solicitudes_vinculacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paciente_tutores_historial ENABLE ROW LEVEL SECURITY;
```

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| INDEX | `ix_paciente_tutores_historial_relacion` |
| FUNCTION | `public.registrar_historial_paciente_tutores` |
| TRIGGER | `tr_paciente_tutores_historial` |
| INDEX | `ix_solicitudes_vinculacion_salita_estado` |
| INDEX | `ix_solicitudes_vinculacion_usuario` |
| UNIQUE INDEX | `uq_solicitud_vinculacion_pendiente` |
| FUNCTION | `public.evitar_ciclos_paciente_tutores` |
| TRIGGER | `tr_paciente_tutores_evitar_ciclos` |
| FUNCTION | `public.aprobar_solicitud_vinculacion` |
| TRIGGER | `tr_auditar_solicitudes_vinculacion` |


## 20261103_agenda_escritura.sql

[Fuente completa](../backend/src/BBDD/20261103_agenda_escritura.sql)

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| FUNCTION | `public.guardar_agenda` |
| FUNCTION | `public.registrar_historial_turno` |
| FUNCTION | `public.guardar_turno_agenda` |


## 20261103_agenda_impacto.sql

[Fuente completa](../backend/src/BBDD/20261103_agenda_impacto.sql)

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| FUNCTION | `public.agenda_turnos_afectados` |
| FUNCTION | `public.serializar_agenda` |
| TRIGGER | `tr_agenda_serializar` |
| TRIGGER | `tr_agenda_serializar` |
| TRIGGER | `tr_agenda_serializar` |
| FUNCTION | `public.proteger_horario_turnos` |
| TRIGGER | `tr_horarios_proteger_turnos` |
| FUNCTION | `public.validar_bloqueo_agenda` |


## 20261107_cierres_calendario.sql

[Fuente completa](../backend/src/BBDD/20261107_cierres_calendario.sql)

```sql
CREATE TABLE public.cierres_calendario (
  id_cierre uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo varchar(150) NOT NULL CHECK (length(trim(titulo)) >= 3),
  observaciones text CHECK (length(observaciones) <= 2000),
  tipo text NOT NULL CHECK (tipo IN ('FERIADO_NACIONAL','FERIADO_PROVINCIAL','FERIADO_MUNICIPAL',
    'DIA_NO_LABORABLE','ASUETO','DUELO','FUMIGACION','MANTENIMIENTO','EMERGENCIA','CIERRE_ADMINISTRATIVO','OTRO')),
  alcance text NOT NULL CHECK (alcance IN ('GLOBAL','SALITA')),
  id_salita uuid REFERENCES public.salitas(id_salita),
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL CHECK (fecha_fin >= fecha_inicio),
  dia_completo boolean NOT NULL,
  hora_inicio time,
  hora_fin time,
  origen varchar(200) NOT NULL DEFAULT 'Carga administrativa' CHECK (length(trim(origen)) >= 3),
  activo boolean NOT NULL DEFAULT true,
  creado_por uuid NOT NULL REFERENCES public.usuarios(id_usuario),
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_actualizacion timestamptz NOT NULL DEFAULT now(),
  CHECK ((alcance = 'GLOBAL' AND id_salita IS NULL) OR (alcance = 'SALITA' AND id_salita IS NOT NULL)),
  CHECK ((dia_completo AND hora_inicio IS NULL AND hora_fin IS NULL) OR
    (NOT dia_completo AND hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_inicio < hora_fin))
);
```

### Evoluciones de tablas

```sql
ALTER TABLE public.cierres_calendario ENABLE ROW LEVEL SECURITY;
```

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| INDEX | `idx_cierres_global_fechas` |
| INDEX | `idx_cierres_salita_fechas` |
| INDEX | `idx_cierres_fechas` |
| FUNCTION | `public.cierre_intersecta` |
| FUNCTION | `public.cierre_turnos_afectados` |
| TRIGGER | `tr_agenda_serializar` |
| FUNCTION | `public.validar_cierre_calendario` |
| TRIGGER | `tr_cierres_validar` |
| TRIGGER | `tr_auditar_cierres` |
| FUNCTION | `public.validar_turno_cierre` |
| TRIGGER | `tr_turnos_validar_cierre` |
| FUNCTION | `public.guardar_cierre_calendario` |


## 20261108_argentinadatos.sql

[Fuente completa](../backend/src/BBDD/20261108_argentinadatos.sql)

```sql
CREATE TABLE public.calendario_sincronizacion (
  fuente text PRIMARY KEY CHECK (fuente = 'ARGENTINADATOS'),
  token uuid, lease_hasta timestamptz,
  ultimo_intento timestamptz, ultimo_exito timestamptz,
  modo text CHECK (modo IN ('AUTOMATICA','MANUAL')),
  id_usuario uuid REFERENCES public.usuarios(id_usuario),
  resumen jsonb NOT NULL DEFAULT '{}'::jsonb
);
```

### Evoluciones de tablas

```sql
ALTER TABLE public.cierres_calendario
  ADD COLUMN fuente_externa text CHECK (fuente_externa = 'ARGENTINADATOS'),
  ADD COLUMN clave_externa text,
  ADD COLUMN datos_externos jsonb;
ALTER TABLE public.cierres_calendario ALTER COLUMN creado_por DROP NOT NULL;
ALTER TABLE public.cierres_calendario ADD CONSTRAINT ck_cierre_fuente CHECK (
  (fuente_externa IS NULL AND clave_externa IS NULL AND datos_externos IS NULL AND creado_por IS NOT NULL)
  OR (fuente_externa IS NOT NULL AND fuente_externa = 'ARGENTINADATOS' AND clave_externa IS NOT NULL AND datos_externos IS NOT NULL
    AND tipo = 'FERIADO_NACIONAL' AND alcance = 'GLOBAL' AND id_salita IS NULL
    AND fecha_inicio = fecha_fin AND dia_completo AND activo)
);
ALTER TABLE public.calendario_sincronizacion ENABLE ROW LEVEL SECURITY;
```

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| UNIQUE INDEX | `ux_cierre_fuente_clave` |
| TRIGGER | `tr_auditar_calendario_sync` |
| FUNCTION | `public.reclamar_calendario_sync` |
| FUNCTION | `public.validar_cierre_calendario` |
| FUNCTION | `public.aplicar_feriados_argentinadatos` |
| FUNCTION | `public.finalizar_calendario_sync` |
| FUNCTION | `public.cierres_importados_pendientes` |


## 20261109_profesional_salita_vigencia.sql

[Fuente completa](../backend/src/BBDD/20261109_profesional_salita_vigencia.sql)

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| FUNCTION | `public.validar_turno` |



## 20261110_historia_clinica.sql

[Fuente completa](../backend/src/BBDD/20261110_historia_clinica.sql)

```sql
CREATE TABLE public.historias_clinicas (
    id_historia_clinica     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_paciente             UUID NOT NULL UNIQUE REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    estado                  VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
    observaciones_generales TEXT,
    creado_por              UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    fecha_apertura          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_hc_estado CHECK (estado IN ('ACTIVA', 'INACTIVA', 'ARCHIVADA'))
);

CREATE TABLE public.derivaciones_autorizaciones_clinicas (
    id_derivacion               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo                        VARCHAR(30) NOT NULL DEFAULT 'DERIVACION',
    alcance                     VARCHAR(30) NOT NULL DEFAULT 'ESPECIALIDAD',
    id_paciente                 UUID NOT NULL REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    id_salita_origen            UUID NOT NULL REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    id_salita_destino           UUID NOT NULL REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    id_profesional_destino      UUID REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    id_especialidad_destino     UUID REFERENCES public.especialidades(id_especialidad) ON DELETE RESTRICT,
    motivo                      TEXT NOT NULL,
    fecha_desde                 DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_hasta                 DATE NOT NULL,
    estado                      VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    id_usuario_solicita         UUID NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE RESTRICT,
    id_profesional_solicita     UUID REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    id_usuario_autoriza         UUID REFERENCES public.usuarios(id_usuario) ON DELETE RESTRICT,
    fecha_resolucion            TIMESTAMPTZ,
    motivo_resolucion           TEXT,
    id_usuario_revoca           UUID REFERENCES public.usuarios(id_usuario) ON DELETE RESTRICT,
    fecha_revocacion            TIMESTAMPTZ,
    motivo_revocacion           TEXT,
    fecha_creacion              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_derivacion_tipo CHECK (tipo IN ('DERIVACION', 'AUTORIZACION_ACCESO')),
    CONSTRAINT ck_derivacion_alcance CHECK (alcance IN ('PROFESIONAL', 'ESPECIALIDAD', 'LONGITUDINAL')),
    CONSTRAINT ck_derivacion_salitas_distintas CHECK (id_salita_origen <> id_salita_destino),
    CONSTRAINT ck_derivacion_fechas CHECK (fecha_hasta >= fecha_desde),
    CONSTRAINT ck_derivacion_estado CHECK (estado IN ('PENDIENTE', 'AUTORIZADA', 'RECHAZADA', 'REVOCADA', 'VENCIDA'))
);

CREATE TABLE public.derivaciones_autorizaciones_historial (
    id_historial        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_derivacion       UUID NOT NULL REFERENCES public.derivaciones_autorizaciones_clinicas(id_derivacion) ON DELETE RESTRICT,
    id_usuario_actor    UUID REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
    accion              VARCHAR(10) NOT NULL,
    estado_anterior     VARCHAR(20),
    estado_nuevo        VARCHAR(20) NOT NULL,
    datos_anteriores    JSONB,
    datos_nuevos        JSONB NOT NULL,
    fecha               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_derivaciones_hist_accion CHECK (accion IN ('INSERT', 'UPDATE'))
);

CREATE TABLE public.antecedentes_clinicos (
    id_antecedente          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_historia_clinica     UUID NOT NULL REFERENCES public.historias_clinicas(id_historia_clinica) ON DELETE RESTRICT,
    id_paciente             UUID NOT NULL REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    tipo                    VARCHAR(30) NOT NULL,
    categoria               VARCHAR(100),
    descripcion             TEXT NOT NULL,
    fecha_antecedente       DATE NOT NULL DEFAULT CURRENT_DATE,
    estado                  VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    id_profesional_autor    UUID NOT NULL REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    id_salita_registro      UUID REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_antecedente_tipo CHECK (tipo IN ('PERSONAL', 'FAMILIAR', 'QUIRURGICO', 'PATOLOGICO', 'GINECOLOGICO', 'OTRO')),
    CONSTRAINT ck_antecedente_estado CHECK (estado IN ('ACTIVO', 'RESUELTO', 'INACTIVO', 'ANULADO'))
);

CREATE TABLE public.alergias_paciente (
    id_alergia              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_historia_clinica     UUID NOT NULL REFERENCES public.historias_clinicas(id_historia_clinica) ON DELETE RESTRICT,
    id_paciente             UUID NOT NULL REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    alergeno                VARCHAR(150) NOT NULL,
    tipo_reaccion           VARCHAR(150) NOT NULL,
    gravedad                VARCHAR(20) NOT NULL,
    observaciones           TEXT,
    estado                  VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
    fecha_deteccion         DATE,
    id_profesional_autor    UUID NOT NULL REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    id_salita_registro      UUID REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_alergia_gravedad CHECK (gravedad IN ('LEVE', 'MODERADA', 'GRAVE', 'DESCONOCIDA')),
    CONSTRAINT ck_alergia_estado CHECK (estado IN ('ACTIVA', 'RESUELTA', 'DESCARTADA', 'ANULADA'))
);

CREATE TABLE public.consultas_medicas (
    id_consulta             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_historia_clinica     UUID NOT NULL REFERENCES public.historias_clinicas(id_historia_clinica) ON DELETE RESTRICT,
    id_paciente             UUID NOT NULL REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    id_profesional          UUID NOT NULL REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    id_especialidad         UUID NOT NULL REFERENCES public.especialidades(id_especialidad) ON DELETE RESTRICT,
    id_salita               UUID NOT NULL REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    id_turno                UUID UNIQUE REFERENCES public.turnos(id_turno) ON DELETE RESTRICT,
    id_autorizacion_clinica UUID REFERENCES public.derivaciones_autorizaciones_clinicas(id_derivacion) ON DELETE RESTRICT,
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
    id_profesional_autor    UUID NOT NULL REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    version                 INTEGER NOT NULL DEFAULT 1,
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_consulta_estado CHECK (estado IN ('BORRADOR', 'FIRMADA', 'ANULADA'))
);

CREATE TABLE public.diagnosticos_clinicos (
    id_diagnostico          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_consulta             UUID NOT NULL REFERENCES public.consultas_medicas(id_consulta) ON DELETE RESTRICT,
    id_historia_clinica     UUID NOT NULL REFERENCES public.historias_clinicas(id_historia_clinica) ON DELETE RESTRICT,
    id_paciente             UUID NOT NULL REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    codigo                  VARCHAR(30),
    descripcion             VARCHAR(300) NOT NULL,
    tipo                    VARCHAR(20) NOT NULL DEFAULT 'PRESUNTIVO',
    fecha_diagnostico       DATE NOT NULL DEFAULT CURRENT_DATE,
    observaciones           TEXT,
    estado                  VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    id_profesional_autor    UUID NOT NULL REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_diagnostico_tipo CHECK (tipo IN ('PRESUNTIVO', 'CONFIRMADO', 'DIFERENCIAL', 'PRINCIPAL', 'SECUNDARIO', 'DESCARTADO')),
    CONSTRAINT ck_diagnostico_estado CHECK (estado IN ('ACTIVO', 'RESUELTO', 'DESCARTADO', 'ANULADO'))
);

CREATE TABLE public.evoluciones_clinicas (
    id_evolucion                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_consulta                 UUID NOT NULL REFERENCES public.consultas_medicas(id_consulta) ON DELETE RESTRICT,
    id_historia_clinica         UUID NOT NULL REFERENCES public.historias_clinicas(id_historia_clinica) ON DELETE RESTRICT,
    id_paciente                 UUID NOT NULL REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    evolucion                   TEXT NOT NULL,
    observaciones               TEXT,
    id_profesional_responsable  UUID NOT NULL REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    fecha_evolucion             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version                     INTEGER NOT NULL DEFAULT 1,
    es_correccion               BOOLEAN NOT NULL DEFAULT FALSE,
    id_evolucion_origen         UUID REFERENCES public.evoluciones_clinicas(id_evolucion) ON DELETE RESTRICT,
    motivo_correccion           TEXT,
    estado                      VARCHAR(20) NOT NULL DEFAULT 'FIRMADA',
    firmada_en                  TIMESTAMPTZ,
    fecha_creacion              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_evolucion_estado CHECK (estado IN ('BORRADOR', 'FIRMADA', 'RECTIFICADA', 'ANULADA'))
);

CREATE TABLE public.tratamientos_clinicos (
    id_tratamiento              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_consulta                 UUID NOT NULL REFERENCES public.consultas_medicas(id_consulta) ON DELETE RESTRICT,
    id_historia_clinica         UUID NOT NULL REFERENCES public.historias_clinicas(id_historia_clinica) ON DELETE RESTRICT,
    id_paciente                 UUID NOT NULL REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    medicacion                  VARCHAR(200) NOT NULL,
    dosis                       VARCHAR(120) NOT NULL,
    frecuencia                  VARCHAR(120) NOT NULL,
    duracion                    VARCHAR(120),
    indicaciones                TEXT,
    fecha_inicio                DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin                   DATE,
    estado                      VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    id_profesional_responsable  UUID NOT NULL REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    fecha_creacion              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_tratamiento_estado CHECK (estado IN ('ACTIVO', 'FINALIZADO', 'SUSPENDIDO', 'ANULADO'))
);

CREATE TABLE public.estudios_clinicos (
    id_estudio                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_consulta                 UUID NOT NULL REFERENCES public.consultas_medicas(id_consulta) ON DELETE RESTRICT,
    id_historia_clinica         UUID NOT NULL REFERENCES public.historias_clinicas(id_historia_clinica) ON DELETE RESTRICT,
    id_paciente                 UUID NOT NULL REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    tipo_estudio                VARCHAR(120) NOT NULL,
    descripcion                 TEXT NOT NULL,
    fecha_solicitud             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resultado                   TEXT,
    fecha_resultado             TIMESTAMPTZ,
    estado                      VARCHAR(20) NOT NULL DEFAULT 'SOLICITADO',
    id_profesional_solicitante  UUID NOT NULL REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    id_profesional_informa      UUID REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    fecha_creacion              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_estudio_estado CHECK (estado IN ('SOLICITADO', 'EN_PROCESO', 'COMPLETADO', 'CANCELADO'))
);

CREATE TABLE public.auditoria_clinica (
    id_auditoria_clinica    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario              UUID NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE RESTRICT,
    id_profesional          UUID REFERENCES public.profesionales(id_profesional) ON DELETE RESTRICT,
    id_paciente             UUID NOT NULL REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    id_historia_clinica     UUID REFERENCES public.historias_clinicas(id_historia_clinica) ON DELETE RESTRICT,
    id_salita               UUID NOT NULL REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    tipo_operacion          VARCHAR(20) NOT NULL,
    recurso                 VARCHAR(60) NOT NULL DEFAULT 'HISTORIA_CLINICA',
    id_recurso              UUID,
    alcance_acceso          VARCHAR(30),
    fecha_acto_clinico      DATE,
    motivo_acceso           TEXT NOT NULL,
    id_derivacion           UUID REFERENCES public.derivaciones_autorizaciones_clinicas(id_derivacion) ON DELETE RESTRICT,
    ip_origen               INET,
    fecha_hora              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_auditoria_clinica_operacion CHECK (tipo_operacion IN ('CONSULTA', 'CREACION', 'MODIFICACION', 'CORRECCION', 'EXPORTACION')),
    CONSTRAINT ck_auditoria_clinica_alcance CHECK (alcance_acceso IS NULL OR alcance_acceso IN ('SALITA_ASIGNADA', 'PROFESIONAL', 'ESPECIALIDAD', 'LONGITUDINAL', 'ADMINISTRATIVO'))
);

CREATE TABLE public.auditoria_accesos_auditoria (
    id_acceso_auditoria     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario              UUID NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE RESTRICT,
    rol_usuario             VARCHAR(50) NOT NULL,
    id_salita               UUID REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
    id_paciente_filtrado    UUID REFERENCES public.pacientes(id_paciente) ON DELETE RESTRICT,
    filtros                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_origen               INET,
    fecha_hora              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| TRIGGER | `tr_auditoria_clinica_inmutable` |
| TRIGGER | `tr_auditoria_acc_aud_inmutable` |
| FUNCTION | `public.impedir_eliminacion_clinica` |
| FUNCTION | `public.inmutabilidad_auditoria_clinica` |
| FUNCTION | `public.validar_derivacion_clinica` |
| FUNCTION | `public.verificar_acceso_clinico` |
| FUNCTION | `public.registrar_consulta_clinica` |
| FUNCTION | `public.firmar_consulta_medica` |
| FUNCTION | `public.anular_consulta_borrador` |
| FUNCTION | `public.registrar_evolucion_clinica` |
| FUNCTION | `public.rectificar_evolucion_clinica` |
| FUNCTION | `public.registrar_acceso_auditoria_clinica` |


## 20261110_super_admin_auditoria_clinica.sql

[Fuente completa](../backend/src/BBDD/20261110_super_admin_auditoria_clinica.sql)

Asigna el permiso `VER_AUDITORIA_CLINICA` al rol `SUPER_ADMIN` en `rol_permisos`.


## 20261115_admin_recepcion_ver_historia_clinica.sql

[Fuente completa](../backend/src/BBDD/20261115_admin_recepcion_ver_historia_clinica.sql)

Asigna exclusivamente el permiso `VER_HISTORIA_CLINICA` a los roles `ADMIN_SALITA` y `RECEPCION` en `rol_permisos` y actualiza la función `verificar_acceso_clinico()` para habilitar lectura asistencial estricta a la salita asignada.


## 20261115_fix_auditoria_clinica_columns.sql

[Fuente completa](../backend/src/BBDD/20261115_fix_auditoria_clinica_columns.sql)

Armoniza nombres de columnas en `auditoria_clinica` y actualiza el trigger `tr_auditoria_clinica_inmutable`.


## PROPUESTA_20261110_hc_borradores_y_turno_anticipado.sql

[Fuente completa](../backend/src/BBDD/PROPUESTA_20261110_hc_borradores_y_turno_anticipado.sql)

```sql
CREATE TABLE public.borradores_formulario_clinico (
    id_borrador         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario          UUID NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    id_profesional      UUID NOT NULL REFERENCES public.profesionales(id_profesional) ON DELETE CASCADE,
    id_paciente         UUID NOT NULL REFERENCES public.pacientes(id_paciente) ON DELETE CASCADE,
    id_salita           UUID NOT NULL REFERENCES public.salitas(id_salita) ON DELETE RESTRICT,
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
```

### Objetos asociados

| Tipo | Nombre |
| --- | --- |
| UNIQUE INDEX | `ux_borradores_form_sin_turno` |
| UNIQUE INDEX | `ux_borradores_form_con_turno` |
| TRIGGER | `tr_borradores_form_fecha` |
| FUNCTION | `public.guardar_borrador_formulario_clinico` |
| FUNCTION | `public.obtener_borrador_formulario_clinico` |
| FUNCTION | `public.descartar_borrador_formulario_clinico` |
