# ⚙️ Backend y reglas de implementación

| [← Índice](README.md) · [API](API.md) · [Diagramas](DIAGRAMAS.md) · [Historia Clínica](HISTORIA_CLINICA.md) · [Datos](BASE_DE_DATOS.md)

## Estructura

API Express 5 y TypeScript con módulos ESM. Los imports locales del backend utilizan extensión `.js`, que corresponde al resultado compilado. `tsx` ejecuta desarrollo; `tsc` genera la distribución y `node dist/server.js` inicia el backend compilado. Los scripts reales están en [package.json](../backend/package.json).

| Directorio | Contenido |
| --- | --- |
| `config` | Entorno validado, cliente Supabase y conocimiento estático del asistente |
| `routes` | Registro de endpoints y autorización inicial |
| `middlewares` | JWT, roles, alcances, límites del chatbot y errores |
| `controllers` | Contratos HTTP y adaptación de parámetros |
| `validators` | Esquemas Zod, fechas, filtros y reglas de campos |
| `services` | Casos de uso y coordinación |
| `repositories` | Consultas y funciones remotas |
| `types` | Tipos de entidades y extensión de Express |
| `utils` | Tiempo, errores, privacidad, ventanas y formatos auxiliares |
| `BBDD` | Esquema inicial y migraciones |
| `scripts` | Utilidades administrativas con posibles efectos externos |

## Familias de servicios

| Familia | Puntos de entrada representativos |
| --- | --- |
| Cuentas | `auth.service`, `session.service`, `user-management.service`, `access-management.service` |
| Perfiles | `auth-profile.service`, `admin-profile.service`, `profile-role.service` |
| Pacientes | `patient-read.service`, `patient-update.service`, `patient-coverage.service`, `patient-managed.service` |
| Vinculaciones | `tutor-request.service`, `patient-tutor.service` |
| Recursos | `profesional.service`, `profesional-salita.service`, `horario-atencion.service` |
| Agenda | `turno-agenda.service`, `disponibilidad.service`, `agenda-impacto.service` |
| Reprogramación | `turno-update.service`, `agenda-propuesta.service`, `agenda-confirmacion.service` |
| Calendario | `cierre-calendario.service`, `calendario-sync.service` |
| Historia Clínica | `historia-clinica.service`, `historia-clinica-support.service`, `patient-clinical.service`, `clinical-scope.service` |
| Comunicación | `notificacion-admin.service`, `notificacion-worker.service`, `socket.service` |
| Gestión | `reporte.service`, `dashboard.service`, `auditoria.service` |

## Autorización

`authenticate` verifica el token y vuelve a cargar usuario y rol. `requireRole` limita acciones. Los servicios y middlewares de alcance restringen salitas o titularidad. `authenticateForProfile` permite completar determinados perfiles sin abrir el resto de la API.

La identidad profesional se resuelve desde la cuenta. La gestión de otra persona exige autorización vigente. Los UUID recibidos del cliente son entradas, no prueba de pertenencia.

## Persistencia

El cliente [supabase.ts](../backend/src/config/supabase.ts) usa configuración del servidor. Las consultas devuelven `data` y `error`; los repositorios propagan o traducen los errores. Las operaciones que necesitan varias escrituras coordinadas utilizan RPC específicas, por ejemplo aprobación de vinculaciones, envíos administrativos y reprogramación.

En agenda existen INSERT/UPDATE directos además de RPC. Los triggers de las tablas son esenciales para que ambos caminos conserven las mismas restricciones.

## Errores y respuestas

`AppError` lleva estado HTTP y opcionalmente código y datos. El middleware global convierte Zod en errores de campos, FK/CHECK en rechazo de datos y exclusiones en conflicto. `rethrowTurnoError` reconoce mensajes y códigos de la agenda. El chatbot tiene manejo específico.

No suponer un único contrato de éxito: algunos controllers entregan `{ success, data }`, otros objetos directos y los reportes pueden devolver archivos. El controller y el cliente frontend correspondiente definen cada contrato.

## Fechas y cálculos

Reutilizar `agendaDateTime` y `agendaDayBounds` para día argentino. `bookingWindow` implementa la apertura semanal. Las fechas SQL DATE se comparan como fechas civiles; los instantes requieren zona. `cierre-calendario.ts` concentra el criterio de aplicación de cierres del lado TypeScript.

## Procesos y efectos posteriores

El servidor inicia un worker de notificaciones. Las entregas se reclaman en PostgreSQL; el calendario usa un lease persistente. Los eventos Socket.IO notifican cambios después de guardar. La aplicación no ofrece una transacción distribuida que incluya SMTP.

## Puntos de mantenimiento

Al modificar un caso de uso revisar sus rutas, validadores, alcance, repositorios y SQL. Mantener previsualización y escritura coherentes. Una nueva regla de concurrencia no se resuelve solo agregando un SELECT al servicio. Una nueva pantalla no debe depender de una propiedad que la proyección del repositorio no devuelve.

