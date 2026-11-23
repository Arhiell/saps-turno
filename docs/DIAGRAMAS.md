# 📊 Diagramas del Sistema · CORA / SAPS Turno

[← Volver al Índice General](README.md) · [Arquitectura](ARQUITECTURA.md) · [Base de Datos](BASE_DE_DATOS.md) · [Historia Clínica](HISTORIA_CLINICA.md)

Este documento centraliza los diagramas formales de ingeniería de software para **CORA · SAPS Turno**: diagramas de casos de uso por actor, diagramas de secuencia de los flujos críticos del negocio, diagramas de arquitectura y diagramas entidad-relación de la base de datos PostgreSQL.

---

## 🧭 Índice de Diagramas

1. [🏛️ Diagrama de Arquitectura Global](#1-arquitectura-global)
2. [👥 Diagramas de Casos de Uso](#2-diagramas-de-casos-de-uso)
   - [2.1 Pacientes y Tutores](#21-casos-de-uso-paciente-y-tutor)
   - [2.2 Profesionales de la Salud](#22-casos-de-uso-profesional-de-salud)
   - [2.3 Administración de Salita y Recepción](#23-casos-de-uso-administración-de-salita-y-recepción)
   - [2.4 Super Administrador](#24-casos-de-uso-super-administrador)
3. [⏱️ Diagramas de Secuencia](#3-diagramas-de-secuencia)
   - [3.1 Reserva y Validación Atómica de Turno](#31-reserva-y-validación-atómica-de-turno)
   - [3.2 Reprogramación Asistida ante Cierres o Ausencias](#32-reprogramación-asistida-ante-cierres-o-ausencias)
   - [3.3 Atención Médica, Borrador y Firma de Consulta Clínica](#33-atención-médica-borrador-y-firma-de-consulta-clínica)
   - [3.4 Derivación Clínica y Autorización entre Salitas](#34-derivación-clínica-y-autorización-entre-salitas)
   - [3.5 Autenticación JWT y Verificación de Identidad](#35-autenticación-jwt-y-verificación-de-identidad)
4. [🗄️ Diagramas de Base de Datos (Entidad-Relación)](#4-diagramas-de-base-de-datos-entidad-relación)
   - [4.1 Núcleo de Identidad, Cuentas y Representación](#41-identidad-cuentas-y-representación)
   - [4.2 Estructura Territorial, Recursos y Horarios](#42-estructura-territorial-recursos-y-horarios)
   - [4.3 Agenda, Turnos, Cierres y Sanciones](#43-agenda-turnos-cierres-y-sanciones)
   - [4.4 Historia Clínica Electrónica, Borradores y Auditoría Clínica](#44-historia-clínica-electrónica-y-auditoría)

---

<a id="1-arquitectura-global"></a>
## 1. 🏛️ Arquitectura Global

```mermaid
flowchart TB
    subgraph CLIENTE["🌐 Capa Cliente (Frontend SPA)"]
        SPA["React 19 + TypeScript + Vite"]
        CTX["Contexts (Auth, Notif, Turnos)"]
        ROUTER["React Router DOM"]
        SPA --- CTX
        SPA --- ROUTER
    end

    subgraph API_GW["🔐 Capa Backend (Node.js & Express 5)"]
        RT["Rutas Express (/api/*)"]
        MW["Middlewares (Auth JWT, Role, ClinicalScope, RateLimit)"]
        VAL["Validadores (Zod / Schemas)"]
        CTRL["Controladores HTTP"]
        SRV["Servicios de Negocio"]
        REP["Repositorios de Datos"]
        SOCK["Servidor WebSocket (Socket.IO)"]
        WORKER["Worker en Segundo Plano (Notificaciones & Feriados)"]
        
        RT --> MW --> VAL --> CTRL --> SRV --> REP
        SRV -.-> SOCK
        WORKER --> SRV
    end

    subgraph PERSISTENCIA["🗃️ Capa de Persistencia & Servicios Externos"]
        PG[("PostgreSQL en Supabase")]
        TRIG["Triggers, Constraints & RLS"]
        RPC["Funciones Transaccionales RPC"]
        SMTP["Servidor SMTP (Envío de Mails)"]
        ARG_DATOS["API Externa ArgentinaDatos (Feriados)"]
        GEMINI["Google Gemini API (Asistente CORA optativo)"]
        
        REP --> PG
        PG --- TRIG
        PG --- RPC
        SRV -.-> SMTP
        WORKER -.-> ARG_DATOS
        SRV -.-> GEMINI
    end

    CLIENTE -->|"HTTPS / JSON + Bearer Token"| API_GW
    CLIENTE <-->|"WSS / Socket.IO (Eventos en tiempo real)"| SOCK
```

---

<a id="2-diagramas-de-casos-de-uso"></a>
## 2. 👥 Diagramas de Casos de Uso

### 2.1 Casos de Uso: Paciente y Tutor

```mermaid
flowchart LR
    P((👤 Paciente))
    T((👥 Tutor / Responsable))

    subgraph AUTENTICACION["🔐 Acceso e Identidad"]
        CU01["Registrarse / Iniciar Sesión"]
        CU02["Verificar Correo Electrónico"]
        CU03["Recuperar Contraseña"]
        CU04["Vincular Cuenta de Google"]
    end

    subgraph TURNOS_PAC["📅 Gestión de Turnos"]
        CU05["Buscar Disponibilidad por Especialidad / Salita"]
        CU06["Reservar Turno Propio"]
        CU07["Reservar Turno para Familiar a Cargo"]
        CU08["Cancelar Turno Asignado"]
        CU09["Consultar Historial de Turnos y Sanciones"]
    end

    subgraph CLINICA_PAC["🩺 Mi Salud"]
        CU10["Consultar Mi Historia Clínica Longitudinal"]
        CU11["Consultar Indicaciones y Tratamientos Activos"]
        CU12["Descargar Resumen Clínico Personal"]
    end

    subgraph TUTELA_PAC["👨‍👧 Personas a Cargo"]
        CU13["Solicitar Vinculación de Tutorado"]
        CU14["Adjuntar Documentación de Parentesco"]
        CU15["Gestionar Turnos de Personas a Cargo"]
    end

    P --> CU01
    P --> CU02
    P --> CU03
    P --> CU04
    P --> CU05
    P --> CU06
    P --> CU08
    P --> CU09
    P --> CU10
    P --> CU11
    P --> CU12

    T --> CU01
    T --> CU07
    T --> CU13
    T --> CU14
    T --> CU15
```

---

### 2.2 Casos de Uso: Profesional de Salud

```mermaid
flowchart LR
    MED((🩺 Profesional de Salud))

    subgraph AGENDA_MED["📅 Agenda Profesional"]
        CU20["Consultar Agenda Diaria y Semanal"]
        CU21["Visualizar Turnos del Día por Salita"]
        CU22["Registrar Asistencia / Inasistencia del Paciente"]
    end

    subgraph CLINICA_MED["📋 Historia Clínica Electrónica"]
        CU23["Buscar Paciente dentro de Alcance Clínico"]
        CU24["Consultar Historia Clínica y Antecedentes"]
        CU25["Crear Borrador Temporal de Consulta (Autoguardado)"]
        CU26["Registrar y Firmar Consulta Médica"]
        CU27["Registrar Diagnósticos (CIE-10 / Tipo)"]
        CU28["Registrar y Rectificar Evoluciones Clínicas"]
        CU29["Prescribir Tratamientos y Medicación"]
        CU30["Solicitar e Informar Estudios Complementarios"]
        CU31["Emitir Derivación Clínica a Otra Salita"]
    end

    MED --> CU20
    MED --> CU21
    MED --> CU22
    MED --> CU23
    MED --> CU24
    MED --> CU25
    MED --> CU26
    MED --> CU27
    MED --> CU28
    MED --> CU29
    MED --> CU30
    MED --> CU31
```

---

### 2.3 Casos de Uso: Administración de Salita y Recepción

```mermaid
flowchart LR
    ADM((🏥 Admin Salita / Recepción))

    subgraph GESTION_TURNOS["🎟️ Gestión de Turnos y Agenda"]
        CU40["Otorgar Turno Presencial / Mostrador"]
        CU41["Confirmar Llegada / Recepción de Paciente"]
        CU42["Reprogramación Rápida por Ausencia Imprevista"]
        CU43["Ejecutar Reprogramación Asistida Masiva"]
        CU44["Consultar Grilla de Ocupación por Profesional"]
    end

    subgraph GESTION_RECURSOS["🏢 Recursos de Salita"]
        CU45["Configurar Horarios de Atención Semanales"]
        CU46["Registrar Bloqueos de Agenda y Asuetos Locales"]
        CU47["Aprobar Solicitudes de Vinculación de Tutores"]
        CU48["Consultar Historia Clínica (Solo Lectura Salita)"]
    end

    subgraph NOTIFICACIONES["📢 Comunicaciones"]
        CU49["Emitir Avisos a Pacientes Afectados"]
        CU50["Consultar Estado de Envíos de Notificaciones"]
    end

    ADM --> CU40
    ADM --> CU41
    ADM --> CU42
    ADM --> CU43
    ADM --> CU44
    ADM --> CU45
    ADM --> CU46
    ADM --> CU47
    ADM --> CU48
    ADM --> CU49
    ADM --> CU50
```

---

### 2.4 Casos de Uso: Super Administrador

```mermaid
flowchart LR
    SADM((👑 Super Administrador))

    subgraph CONFIG_GLOBAL["⚙️ Configuración y Catálogos"]
        CU60["Administrar Salitas, Zonas y Barrios"]
        CU61["Administrar Especialidades Médicas"]
        CU62["Gestionar Altas de Profesionales y Matrículas"]
        CU63["Asignar Profesionales a Salitas con Vigencia"]
        CU64["Gestionar Cuentas de Usuarios, Roles y Permisos"]
        CU65["Sincronizar Feriados Nacionales (ArgentinaDatos)"]
    end

    subgraph AUDITORIA_SISTEMA["🛡️ Seguridad y Auditoría"]
        CU66["Consultar Auditoría Operativa General"]
        CU67["Consultar Auditoría Clínica Inmutable"]
        CU68["Auditar Accesos a la Auditoría Clínica"]
        CU69["Gestionar Parámetros Globales del Sistema"]
    end

    subgraph REPORTES_GESTION["📈 Reportes y Analítica"]
        CU70["Visualizar Dashboard Estadístico General"]
        CU71["Generar Reportes de Turnos (PDF / Excel / Word)"]
        CU72["Auditar Sanciones e Inasistencias Globales"]
    end

    SADM --> CU60
    SADM --> CU61
    SADM --> CU62
    SADM --> CU63
    SADM --> CU64
    SADM --> CU65
    SADM --> CU66
    SADM --> CU67
    SADM --> CU68
    SADM --> CU69
    SADM --> CU70
    SADM --> CU71
    SADM --> CU72
```

---

<a id="3-diagramas-de-secuencia"></a>
## 3. ⏱️ Diagramas de Secuencia

### 3.1 Reserva y Validación Atómica de Turno

```mermaid
sequenceDiagram
    autonumber
    actor Paciente as 👤 Paciente / Tutor
    participant UI as 🌐 Frontend React
    participant API as 🔐 API Express (/api/turnos)
    participant Auth as 🛡️ Middleware Auth
    participant Val as 📋 Validator
    participant Srv as ⚙️ TurnoService
    participant Repo as 💾 TurnoRepository
    participant DB as 🗃️ PostgreSQL (Supabase)
    participant WS as 📡 Socket.IO / Notif

    Paciente->>UI: Selecciona Salita, Especialidad, Profesional y Horario
    UI->>API: POST /api/turnos { id_profesional, id_salita, fecha_hora, id_paciente }
    API->>Auth: Validar JWT y sesión activa
    Auth-->>API: Sesión válida (Usuario y Rol)
    API->>Val: Validar esquema de entrada
    Val-->>API: Datos válidos
    API->>Srv: reservarTurno(datosReserva, actor)

    Note over Srv: 1. Verifica sanciones activas por inasistencia<br/>2. Verifica relación tutor/paciente si aplica<br/>3. Valida vigencia profesional-salita
    Srv->>Repo: registrarTurno(datos)
    Repo->>DB: INSERT INTO turnos (...) VALUES (...)
    
    Note over DB: Trigger validar_turno():<br/>- Chequea bloqueo de agenda<br/>- Chequea cierre institucional<br/>- Exclusion GiST impide solapamiento
    alt Turno Disponible
        DB-->>Repo: Turno Creado (id_turno, estado='RESERVADO', version=1)
        Repo-->>Srv: Entidad Turno
        Srv->>WS: Emitir evento 'turno_reservado' (Actualiza grilla)
        Srv-->>API: 201 Created { id_turno, fecha_hora, estado }
        API-->>UI: Confirmación de reserva
        UI-->>Paciente: Muestra Comprobante de Turno
    else Conflicto de Concurrencia o Bloqueo
        DB-->>Repo: Error 23P01 (Exclusión) o Excepción de Trigger
        Repo-->>Srv: Conflicto detectado
        Srv-->>API: 409 Conflict / 422 Unprocessable Entity
        API-->>UI: Error con mensaje explicativo
        UI-->>Paciente: "El horario seleccionado ya fue reservado o se encuentra bloqueado"
    end
```

---

### 3.2 Reprogramación Asistida ante Cierres o Ausencias

```mermaid
sequenceDiagram
    autonumber
    actor Admin as 🏥 Administrador de Salita
    participant UI as 🌐 Frontend React
    participant API as 🔐 API Reprogramación
    participant ImpactoSrv as ⚙️ AgendaImpactoService
    participant PropuestaSrv as ⚙️ AgendaPropuestaService
    participant ConfirmSrv as ⚙️ AgendaConfirmacionService
    participant DB as 🗃️ PostgreSQL (RPC / Lock)
    participant Email as ✉️ Worker Notificaciones

    Admin->>UI: Registra Cierre Institucional / Ausencia de Profesional
    UI->>API: POST /api/agenda-impacto/analizar { id_salita, fecha_desde, fecha_hasta }
    API->>ImpactoSrv: calcularImpacto(criterios)
    ImpactoSrv->>DB: Consultar turnos afectados en rango
    DB-->>ImpactoSrv: Lista de [Turnos Afectados]
    ImpactoSrv-->>UI: Muestra cantidad de pacientes afectados
    
    Admin->>UI: Solicita generar propuestas de reprogramación
    UI->>API: POST /api/agenda-impacto/propuestas
    API->>PropuestaSrv: buscarFranjasDisponibles(turnosAfectados)
    PropuestaSrv->>DB: Buscar slots libres respetando horarios y vigencias
    DB-->>PropuestaSrv: Opciones de destino
    PropuestaSrv-->>UI: Matriz de propuestas (Turno Actual → Turno Propuesto)

    Admin->>UI: Revisa y confirma reubicaciones
    UI->>API: POST /api/agenda-impacto/confirmar { reubicaciones: [...] }
    API->>ConfirmSrv: ejecutarReubicacion(reubicaciones)
    
    Note over ConfirmSrv,DB: Bloqueo pesimista de agenda y transacción atómica
    ConfirmSrv->>DB: Iniciar Transacción (SELECT ... FOR UPDATE)
    loop Por cada turno
        ConfirmSrv->>DB: Actualizar fecha_hora turno, estado='REPROGRAMADO', version = version + 1
        ConfirmSrv->>DB: Registrar en historial_turnos (motivo: cierre/ausencia)
        ConfirmSrv->>DB: Encolar notificación en notificacion_envios
    end
    DB-->>ConfirmSrv: Transacción confirmada (COMMIT)
    ConfirmSrv-->>API: Resultado de reprogramación exitosa
    API-->>UI: Reporte de turnos reprogramados
    UI-->>Admin: "Reprogramación completada exitosamente"
    
    Note over Email: Proceso asíncrono en segundo plano
    Email->>DB: Obtener notificaciones pendientes
    Email->>Email: Envío de correo a cada paciente informando nueva fecha
```

---

### 3.3 Atención Médica, Borrador y Firma de Consulta Clínica

```mermaid
sequenceDiagram
    autonumber
    actor Med as 🩺 Profesional de la Salud
    participant UI as 🌐 Frontend (Historia Clínica)
    participant API as 🔐 API Express (/api/historia-clinica)
    participant Scope as 🛡️ clinicalScope Middleware
    participant Srv as ⚙️ HistoriaClinicaService
    participant Repo as 💾 HistoriaClinicaRepository
    participant DB as 🗃️ PostgreSQL (Triggers & Audit)

    Med->>UI: Ingresa a Consulta Médica del Paciente
    UI->>API: GET /api/historia-clinica/pacientes/:idPaciente
    API->>Scope: Verificar acceso clínico (salita, profesional, derivación activa)
    Scope->>DB: SELECT public.verificar_acceso_clinico(...)
    DB-->>Scope: Acceso Permitido (alcance='PROFESIONAL')
    Scope-->>API: Continúa ejecución
    API->>Srv: obtenerHistoriaClinica(idPaciente)
    Srv->>DB: Registrar auditoría de lectura (tipo_operacion='CONSULTA')
    Srv-->>UI: Expediente clínico (Antecedentes, Consultas previas, Alergias)

    Note over UI,API: Autoguardado optimista de borrador temporal
    Med->>UI: Redacta motivo, examen físico y diagnóstico presuntivo
    UI->>API: PUT /api/historia-clinica/borradores-temporales { idPaciente, idTurno, datosFormulario, version }
    API->>Srv: guardarBorradorTemporal(payload)
    Srv->>Repo: upsertBorradorOptimista(payload)
    Repo->>DB: INSERT ... ON CONFLICT DO UPDATE (versión ++)
    DB-->>UI: 200 OK { version_actual, timestamp }

    Note over Med,UI: Finalización de la atención clínica
    Med->>UI: Clic en "Firmar y Concluir Consulta"
    UI->>API: POST /api/historia-clinica/consultas { consulta, diagnosticos, tratamientos, estudios }
    API->>Scope: Verificar permiso 'CREAR_CONSULTA_CLINICA'
    API->>Srv: registrarYFirmarConsulta(payload)
    Srv->>DB: Iniciar Transacción
    Srv->>DB: INSERT INTO consultas_medicas (estado='FIRMADA', firmada_en=NOW(), ...)
    Srv->>DB: INSERT INTO diagnosticos_clinicos (...)
    Srv->>DB: INSERT INTO evoluciones_clinicas (version=1, firmada_en=NOW(), ...)
    Srv->>DB: INSERT INTO tratamientos_clinicos (...)
    Srv->>DB: DELETE FROM borradores_formulario_clinico WHERE id_turno = ...
    Srv->>DB: UPDATE turnos SET id_estado = 'ATENDIDO' WHERE id_turno = ...
    
    Note over DB: Trigger inmutabilidad_auditoria_clinica():<br/>Inserta registro en auditoria_clinica (inmutable)
    Srv->>DB: INSERT INTO auditoria_clinica (tipo='CREACION', recurso='CONSULTA_MEDICA', ...)
    DB-->>Srv: Transacción confirmada (COMMIT)
    Srv-->>API: Consulta Firmada exitosamente
    API-->>UI: 201 Created { idConsulta, estado: 'FIRMADA' }
    UI-->>Med: Muestra Consulta Firmada con sello digital y opciones de impresión
```

---

### 3.4 Derivación Clínica y Autorización entre Salitas

```mermaid
sequenceDiagram
    autonumber
    actor MedOrigen as 🩺 Médico Origen (Salita A)
    participant UI as 🌐 Frontend CORA
    participant API as 🔐 API (/api/historia-clinica/derivaciones)
    participant Srv as ⚙️ DerivacionesService
    participant DB as 🗃️ PostgreSQL
    actor AdminDestino as 🏥 Autoridad / Salita Destino
    actor MedDestino as 🩺 Médico Especialista (Salita B)

    MedOrigen->>UI: Solicita derivación inter-salita para Paciente
    UI->>API: POST /api/historia-clinica/derivaciones { idPaciente, idSalitaDestino, idEspecialidad, motivo, fechaHasta }
    API->>Srv: solicitarDerivacion(payload, actor)
    Srv->>DB: INSERT INTO derivaciones_autorizaciones_clinicas (estado='PENDIENTE', ...)
    Note over DB: Trigger validar_derivacion_clinica():<br/>Valida salita de origen activa y vigencia de especialidad
    DB-->>Srv: Derivación Registrada (id_derivacion)
    Srv->>DB: INSERT INTO derivaciones_autorizaciones_historial (accion='INSERT', estado_nuevo='PENDIENTE')
    Srv-->>UI: 201 Created

    Note over AdminDestino: Recepción y revisión de la solicitud
    AdminDestino->>UI: Bandeja de Derivaciones Entrantes
    UI->>API: GET /api/historia-clinica/derivaciones?estado=PENDIENTE
    API-->>UI: Lista de solicitudes
    AdminDestino->>UI: Autorizar derivación
    UI->>API: PATCH /api/historia-clinica/derivaciones/:id/resolver { resolucion: 'AUTORIZAR' }
    API->>Srv: resolverDerivacion(id, 'AUTORIZADA')
    Srv->>DB: UPDATE derivaciones SET estado='AUTORIZADA', id_usuario_autoriza=..., fecha_resolucion=NOW()
    Srv->>DB: INSERT INTO derivaciones_autorizaciones_historial (accion='UPDATE', estado_nuevo='AUTORIZADA')
    DB-->>UI: 200 OK (Derivación Activa)

    Note over MedDestino: Acceso cruzado legítimo a la Historia Clínica
    MedDestino->>UI: Abre ficha del paciente derivado en Salita B
    UI->>API: GET /api/historia-clinica/pacientes/:idPaciente
    API->>DB: SELECT public.verificar_acceso_clinico(...)
    Note over DB: Verifica existencia de derivación AUTORIZADA vigente<br/>para la salita destino y la especialidad
    DB-->>API: Acceso Concedido por Derivación
    API-->>UI: Historia Clínica habilitada para la atención especializada
```

---

### 3.5 Autenticación JWT y Verificación de Identidad

```mermaid
sequenceDiagram
    autonumber
    actor Usuario as 👤 Usuario
    participant UI as 🌐 Frontend React
    participant API as 🔐 API Express (/api/auth)
    participant PasswordSrv as ⚙️ PasswordService
    participant JwtSrv as ⚙️ JwtService
    participant DB as 🗃️ PostgreSQL (Supabase)

    Usuario->>UI: Ingresa Email y Contraseña
    UI->>API: POST /api/auth/login { email, contrasenia }
    API->>DB: Buscar usuario por email con persona, rol y permisos
    
    alt Usuario no existe o credenciales inválidas
        DB-->>API: Null / Password hash no coincide (bcrypt)
        API-->>UI: 401 Unauthorized ("Credenciales inválidas")
    else Credenciales válidas
        Note over API: Valida usuario.activo == true<br/>Valida email_verificado == true si la política lo exige
        API->>JwtSrv: generarTokens({ id_usuario, rol, permisos, persona })
        JwtSrv-->>API: { accessToken (15m), refreshToken (7d) }
        API->>DB: INSERT INTO sesiones_refresh (id_usuario, refresh_token_hash, expira_en)
        API-->>UI: 200 OK { token, refreshToken, user: { id, email, rol, persona, permisos } }
        UI->>UI: Almacena sesión en memoria / AuthContext
        UI-->>Usuario: Redirige al Dashboard correspondiente según su Rol
    end
```

---

<a id="4-diagramas-de-base-de-datos-entidad-relación"></a>
## 4. 🗄️ Diagramas de Base de Datos (Entidad-Relación)

### 4.1 Núcleo de Identidad, Cuentas y Representación

```mermaid
erDiagram
    PERSONAS ||--o| USUARIOS : "tiene cuenta"
    PERSONAS ||--o| PACIENTES : "perfil clínico"
    PERSONAS ||--o| PROFESIONALES : "perfil profesional"
    PERSONAS ||--o| TUTORES : "perfil tutor"

    ROLES ||--o{ USUARIOS : "asigna perfil"
    ROLES ||--o{ ROL_PERMISOS : "contiene"
    PERMISOS ||--o{ ROL_PERMISOS : "agrupa"

    USUARIOS ||--o{ SESIONES_REFRESH : "inicia"
    USUARIOS ||--o{ TOKENS_RECUPERACION : "solicita"
    USUARIOS ||--o{ TOKENS_VERIFICACION_EMAIL : "valida"
    USUARIOS ||--o{ USUARIO_SALITA : "asignado a"

    PACIENTES ||--o{ PACIENTE_TUTORES : "es representado por"
    TUTORES ||--o{ PACIENTE_TUTORES : "representa a"
    PACIENTES ||--o{ SOLICITUDES_VINCULACION : "vinculado en"
    TUTORES ||--o{ SOLICITUDES_VINCULACION : "inicia solicitud"

    PERSONAS {
        uuid id_persona PK
        string dni UK
        string nombre
        string apellido
        date fecha_nacimiento
        string genero
        string telefono
        string email
        boolean activo
    }

    USUARIOS {
        uuid id_usuario PK
        uuid id_persona FK
        uuid id_rol FK
        string email UK
        string password_hash
        boolean email_verificado
        boolean activo
    }

    PACIENTES {
        uuid id_paciente PK
        uuid id_persona FK
        uuid id_salita_asignada FK
        string historia_clinica_nro
        string grupo_sanguineo
        boolean activo
    }

    TUTORES {
        uuid id_tutor PK
        uuid id_persona FK
        boolean activo
    }
```

---

### 4.2 Estructura Territorial, Recursos y Horarios

```mermaid
erDiagram
    ZONAS ||--o{ BARRIOS : "agrupa"
    BARRIOS ||--o{ SALITA_BARRIOS : "cubre"
    SALITAS ||--o{ SALITA_BARRIOS : "atiende en"
    SALITAS ||--o{ USUARIO_SALITA : "tiene personal"

    SALITAS ||--o{ PROFESIONAL_SALITA : "dispone de"
    PROFESIONALES ||--o{ PROFESIONAL_SALITA : "presta servicio en"
    PROFESIONALES ||--o{ PROFESIONAL_ESPECIALIDAD : "está habilitado en"
    ESPECIALIDADES ||--o{ PROFESIONAL_ESPECIALIDAD : "especializa a"

    PROFESIONAL_SALITA ||--o{ HORARIOS_ATENCION : "programa"
    HORARIOS_ATENCION ||--o{ BLOQUEOS_AGENDA : "puede suspenderse por"

    SALITAS {
        uuid id_salita PK
        string nombre
        string direccion
        string telefono
        boolean activo
    }

    PROFESIONALES {
        uuid id_profesional PK
        uuid id_persona FK
        string matricula UK
        boolean activo
    }

    PROFESIONAL_SALITA {
        uuid id_profesional FK
        uuid id_salita FK
        date fecha_desde
        date fecha_hasta
        boolean activo
    }

    HORARIOS_ATENCION {
        uuid id_horario PK
        uuid id_profesional FK
        uuid id_salita FK
        uuid id_especialidad FK
        int dia_semana
        time hora_inicio
        time hora_fin
        int duracion_turno_minutos
        int cupo_maximo
        boolean activo
    }
```

---

### 4.3 Agenda, Turnos, Cierres y Sanciones

```mermaid
erDiagram
    HORARIOS_ATENCION ||--o{ TURNOS : "origina franja"
    PACIENTES ||--o{ TURNOS : "solicita"
    SALITAS ||--o{ TURNOS : "se atiende en"
    PROFESIONALES ||--o{ TURNOS : "es atendido por"
    ESTADOS_TURNO ||--o{ TURNOS : "clasifica estado"
    TURNOS ||--o{ HISTORIAL_TURNOS : "registra cambios"

    PACIENTES ||--o{ SANCIONES : "recibe por inasistencia"
    SALITAS ||--o{ CIERRES_CALENDARIO : "aplica cierre a"

    TURNOS {
        uuid id_turno PK
        uuid id_paciente FK
        uuid id_profesional FK
        uuid id_salita FK
        uuid id_especialidad FK
        string id_estado FK
        timestamp fecha_hora_inicio
        timestamp fecha_hora_fin
        int version
        string motivo_consulta
        boolean reprogramado
    }

    HISTORIAL_TURNOS {
        uuid id_historial PK
        uuid id_turno FK
        string estado_anterior
        string estado_nuevo
        uuid id_usuario_modifica FK
        string motivo
        timestamp fecha_modificacion
    }

    CIERRES_CALENDARIO {
        uuid id_cierre PK
        uuid id_salita FK
        date fecha_inicio
        date fecha_fin
        string tipo_cierre
        string motivo
        boolean afecta_todos
    }

    SANCIONES {
        uuid id_sancion PK
        uuid id_paciente FK
        date fecha_inicio
        date fecha_fin
        string motivo
        boolean activo
    }
```

---

### 4.4 Historia Clínica Electrónica, Borradores y Auditoría

```mermaid
erDiagram
    PACIENTES ||--|| HISTORIAS_CLINICAS : "expediente único (1:1)"
    HISTORIAS_CLINICAS ||--o{ ANTECEDENTES_CLINICOS : "registra antecedentes"
    HISTORIAS_CLINICAS ||--o{ ALERGIAS_PACIENTE : "registra alergias"
    HISTORIAS_CLINICAS ||--o{ CONSULTAS_MEDICAS : "contiene atenciones"

    TURNOS ||--o| CONSULTAS_MEDICAS : "vincula acto clínico"
    PROFESIONALES ||--o{ CONSULTAS_MEDICAS : "atiende y firma"
    SALITAS ||--o{ CONSULTAS_MEDICAS : "radica consulta"

    CONSULTAS_MEDICAS ||--o{ DIAGNOSTICOS_CLINICOS : "establece"
    CONSULTAS_MEDICAS ||--o{ EVOLUCIONES_CLINICAS : "evoluciona"
    CONSULTAS_MEDICAS ||--o{ TRATAMIENTOS_CLINICOS : "prescribe"
    CONSULTAS_MEDICAS ||--o{ ESTUDIOS_CLINICOS : "solicita"

    PACIENTES ||--o{ DERIVACIONES_CLINICAS : "es derivado"
    SALITAS ||--o{ DERIVACIONES_CLINICAS : "salita origen / destino"
    DERIVACIONES_CLINICAS ||--o{ DERIVACIONES_HISTORIAL : "audita estados"

    USUARIOS ||--o{ BORRADORES_CLINICOS : "guarda temporalmente"
    PACIENTES ||--o{ BORRADORES_CLINICOS : "sobre paciente"

    PACIENTES ||--o{ AUDITORIA_CLINICA : "audita accesos a"
    USUARIOS ||--o{ AUDITORIA_CLINICA : "quien consulta/crea"
    USUARIOS ||--o{ AUDITORIA_ACCESOS_AUDITORIA : "quien inspecciona auditoría"

    HISTORIAS_CLINICAS {
        uuid id_historia_clinica PK
        uuid id_paciente FK,UK
        string estado
        text observaciones_generales
        timestamp fecha_apertura
    }

    CONSULTAS_MEDICAS {
        uuid id_consulta PK
        uuid id_historia_clinica FK
        uuid id_paciente FK
        uuid id_profesional FK
        uuid id_salita FK
        uuid id_turno FK,UK
        timestamp fecha_atencion
        text motivo_consulta
        text examen_fisico
        string estado "BORRADOR | FIRMADA | ANULADA"
        timestamp firmada_en
        int version
    }

    EVOLUCIONES_CLINICAS {
        uuid id_evolucion PK
        uuid id_consulta FK
        uuid id_historia_clinica FK
        text evolucion
        int version
        boolean es_correccion
        uuid id_evolucion_origen FK
        string estado "FIRMADA | RECTIFICADA | ANULADA"
        timestamp firmada_en
    }

    DERIVACIONES_CLINICAS {
        uuid id_derivacion PK
        string tipo "DERIVACION | AUTORIZACION_ACCESO"
        string alcance "PROFESIONAL | ESPECIALIDAD | LONGITUDINAL"
        uuid id_paciente FK
        uuid id_salita_origen FK
        uuid id_salita_destino FK
        date fecha_desde
        date fecha_hasta
        string estado "PENDIENTE | AUTORIZADA | RECHAZADA | REVOCADA | VENCIDA"
    }

    AUDITORIA_CLINICA {
        bigint id_auditoria_clinica PK
        uuid id_usuario FK
        uuid id_paciente FK
        uuid id_salita FK
        string tipo_operacion "CONSULTA | CREACION | MODIFICACION | EXPORTACION"
        string recurso
        string alcance_acceso
        text motivo_acceso
        inet ip_origen
        timestamp fecha_hora
    }
```

---

> [!NOTE]
> Todos los diagramas representados en este documento corresponden a la arquitectura estática e implementaciones activas en el repositorio. Para inspeccionar las tablas en formato DDL, consulte el [Diccionario SQL](DICCIONARIO_SQL.md) y el módulo específico de [Historia Clínica](HISTORIA_CLINICA.md).
