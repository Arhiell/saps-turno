# 👥 Manual funcional por rol

[← Volver al Índice](README.md) · [Diagramas](DIAGRAMAS.md) · [Historia Clínica](HISTORIA_CLINICA.md) · [Autogestión detallada](PACIENTE_AUTOGESTION.md)

Este manual detalla los recorridos operativos, funciones disponibles y consideraciones prácticas para cada perfil de usuario en **CORA · SAPS Turno**.

---

## 🔐 Acceso común a la plataforma

1. Abrir la aplicación e ingresar mediante credenciales (correo y contraseña) o cuenta de Google institucional/personal.
2. Completar las verificaciones iniciales (verificación de email mediante enlace o código OTP) y datos del perfil civil.
3. Utilizar las opciones del menú lateral o superior acordes al rol asignado.
4. Consultar periódicamente la campana de notificaciones y cerrar la sesión al finalizar en puestos o dispositivos de uso compartido.

> [!NOTE]
> Las opciones de navegación visibles en el cliente se ajustan al rol autenticado; sin embargo, toda petición es re-validada en el servidor mediante tokens JWT y verificaciones de alcance.

---

## 👤 Rol: Paciente y Tutores

### 1. Gestión de Turnos de Atención
- **Reserva Propia**: Búsqueda asistida por especialidad, profesional médico, salita barrial y horario disponible. Confirmación con emisión de comprobante digital.
- **Reserva para Personas a Cargo**: Gestión de turnos para hijos, adultos mayores o personas bajo tutela previa aprobación de solicitud de vinculación.
- **Mis Turnos**: Panel de control con estado de reservas, recordatorios, opción de cancelación anticipada e historial de atenciones.

### 2. Portal de Mi Historia Clínica (`/mi-historia`)
- **Expediente Personal**: Visualización cronológica de todas las consultas médicas atendidas en la red municipal de salitas.
- **Tratamientos e Indicaciones**: Consulta de prescripciones farmacológicas, posología, indicaciones médicas y fechas de tratamiento.
- **Alergias y Antecedentes**: Información declarada sobre alergias conocidas y factores de riesgo para conocimiento del paciente y su familia.

---

## 🩺 Rol: Profesional de la Salud

### 1. Agenda Médica Diaria
- Consulta en tiempo real de los turnos asignados del día por salita.
- Marcado de llegada del paciente, atención en curso o registro de inasistencia justificada/injustificada.
- Exportación o impresión de la hoja de ruta diaria en formato de reporte.

### 2. Historia Clínica Electrónica y Consulta Médica
- **Búsqueda Asistencial**: Acceso a la ficha clínica de pacientes de la salita asignada o asignados mediante derivación activa.
- **Editor con Autoguardado**: Al redactar el motivo de consulta, síntomas y examen físico, el sistema realiza autoguardados periódicos en segundo plano bajo la modalidad de borrador temporal.
- **Diagnósticos y Clasificación**: Registro de diagnósticos (tipo presuntivo, confirmado, diferencial, CIE-10).
- **Firma Digital del Acto Médico**: Cierre y firma inmutable de la consulta médica. La firma bloquea la edición directa del acto y actualiza automáticamente el estado del turno a `ATENDIDO`.
- **Evoluciones y Rectificaciones**: Registro de notas de seguimiento posteriores. Si se requiere subsanar un error involuntario, se utiliza la función de rectificación trazable (`es_correccion = true`), manteniendo intacto el registro histórico previo.
- **Estudios y Prácticas**: Emisión de órdenes de estudios complementarios y carga de informes de resultados.
- **Derivaciones Inter-Salitas**: Emisión de pedidos de atención para especialistas radicados en otros centros de salud con definición de alcance temporal y motivo médico.

---

## 🏥 Rol: Administrador de Salita

### 1. Operación Territorial y Recursos
- Configuración de los horarios de atención semanales para cada profesional y especialidad.
- Carga de bloqueos programados de agenda por motivos edilicios, mantenimientos o capacitaciones locales.
- Tramitación y aprobación formal de solicitudes de vinculación de tutores y personas a cargo.

### 2. Reprogramación Asistida ante Cierres o Ausencias
- **Detección de Afectados**: Análisis en lote de los turnos que entran en conflicto con una ausencia imprevista o cierre institucional.
- **Generación de Propuestas**: Búsqueda asistida por sistema de turnos alternativos óptimos.
- **Reubicación Atómica**: Confirmación masiva con registro en historial y notificación automática por correo a los pacientes.

### 3. Consulta Asistencial de Historias Clínicas
- Acceso de solo lectura a las historias clínicas de pacientes radicados en su propia salita para tareas administrativas y de apoyo asistencial, sin permisos de registro ni firma médica.

---

## 👑 Rol: Super Administrador

- **Gestión Global**: Altas y modificaciones de salitas, zonas, barrios, especialidades médicas y usuarios.
- **Asignaciones Profesionales**: Vinculación de médicos a salitas con fijación de vigencias temporales.
- **Calendario Institucional**: Sincronización automática o manual de feriados nacionales desde la API de ArgentinaDatos y fijación de asuetos municipales.
- **Dashboard y Estadísticas**: Métricas en tiempo real de turnos otorgados, atendidos, cancelaciones e inasistencias en toda la red.
- **Auditoría Clínica Inmutable**: Inspección del registro estricto de accesos a historias clínicas (`auditoria_clinica`) con trazabilidad completa de usuario, fecha real, acto y salita.

---

## 🏢 Rol: Recepción

- Atención en mostrador para consulta y asignación presencial de turnos de demanda programada o espontánea.
- Confirmación de llegada física del paciente a la sala de espera.
- Visualización de historias clínicas acotadas estrictamente a los pacientes de su salita para tareas operativas de admisión.

---

## 🛠️ Guía rápida ante incidencias habituales

| Situación | Diagnóstico | Acción recomendada |
| --- | --- | --- |
| **No aparecen turnos disponibles** | Ausencia de horarios cargados, salita sin cobertura en el barrio o agenda completa | Verificar en el calendario que el profesional posea vigencia activa y no existan feriados o bloqueos en la fecha |
| **Conflicto de concurrencia al reservar** | Otro usuario confirmó simultáneamente la misma franja horaria | El sistema preserva la integridad con exclusiones GiST; seleccionar otra franja libre |
| **Error al intentar firmar consulta médica** | Faltan campos obligatorios o la fecha médica es inconsistente | Completar motivo de consulta y verificar diagnósticos requeridos antes de pulsar "Firmar" |
| **Paciente no figura en el buscador clínico** | El paciente pertenece a otra salita y no posee derivación activa | Solicitar o emitir una derivación clínica inter-salita debidamente autorizada |
| **Solicitud de vinculación no habilitada** | El trámite figura en estado pendiente | El administrador de salita debe revisar y aprobar la solicitud en el panel de vinculaciones |
