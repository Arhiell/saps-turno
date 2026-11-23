# SAPS Turno — Feriados y cierres institucionales

Continuación: [integración con ArgentinaDatos](argentinadatos-calendario.md). La versión actual agrega sincronización semanal/manual en este mismo calendario. Los feriados importados quedan vigentes de inmediato y sus afectados se resuelven después; los cierres manuales conservan el flujo descrito aquí. Para esa versión también debe aplicarse `20261108_argentinadatos.sql` después de la migración de cierres.

La sección **Guía para el equipo** describe el flujo operativo. Las secciones posteriores conservan el análisis técnico de implementación; la presencia de una migración en el repositorio no confirma que esté aplicada. Para el estado de agenda y sus garantías, consultar también [turnos y disponibilidad](TURNOS_Y_DISPONIBILIDAD.md) y [concurrencia](CONCURRENCIA_AGENDA.md).

## Guía para el equipo

En **Configuración → Feriados y cierres**, registramos las fechas en que la institución o una salita no atiende. El horario habitual del profesional sigue siendo el mismo. Si falta solamente un profesional, seguimos usando **Ausencias y reprogramación**.

1. Entrar en **Nuevo feriado o cierre**.
2. Elegir tipo, título y alcance. **Global** alcanza a todas las salitas; **Una salita** alcanza a todos los profesionales de esa salita. Solo SUPER_ADMIN administra cierres globales.
3. Indicar fechas desde/hasta, ambas incluidas. Para un solo día, usar la misma fecha. Marcar **Todo el día** o completar la franja en que no se atiende.
4. Si se elige una franja y varias fechas, esa franja se aplica cada día del rango. No se repite el próximo año.
5. Completar origen y observaciones administrativas. El paciente solo verá etiquetas generales: **FERIADO**, **NO LABORABLE** o **SALITA CERRADA**.
6. Pulsar **Revisar impacto y continuar**. Todavía no se guarda el cierre.
7. Si hay turnos afectados, elegir nueva fecha y horario por paciente, revisar y confirmar. La ayuda para sugerir horarios es opcional. No mueve turnos sin confirmación.
8. Cuando no queden afectados, pulsar **Revisar y guardar cierre institucional** y confirmar. Este último paso activa la regla de cierre.

Los turnos se confirman individualmente. Si alguno falla porque otro usuario ocupó el lugar, los demás confirmados se conservan y el fallido queda pendiente. Hay que resolver los pendientes antes de guardar el cierre. Hasta guardar, el borrador no bloquea nuevas reservas; el sistema revisa nuevamente el impacto al guardar.

Para cancelar un cierre, usar **Desactivar** y confirmar. Se recupera la disponibilidad que permitan los horarios, bloqueos y cupos; los turnos previamente reprogramados no vuelven solos a su fecha original. Para reactivarlo, mostrar los inactivos, editar y marcar **Cierre activo**; vuelve a revisarse el impacto.

## A. Análisis previo

- `horarios_atencion` contiene los días semanales, horas, duración, cupos y vigencia de la atención habitual.
- `bloqueos_agenda` representa excepciones de una fecha, para una salita y opcionalmente profesional/especialidad. No había un calendario institucional global ni rangos de fechas para cierres.
- `obtenerDisponibilidad` genera slots a partir de los horarios y descarta pasado, bloqueos, ocupación y cupo diario. La reserva usa además `validateTurnoAgenda`, que controla entidades, asociaciones, solapamientos, sanciones y turnos abiertos de la misma especialidad.
- `getAgendaImpact`, `generateAgendaProposal`, `getAgendaAvailability` y `confirmAgendaProposal` ya proporcionan el flujo administrativo de afectados, sugerencias opcionales, elección manual y confirmación por turno.
- `updateTurno` usa versión del turno para evitar sobrescribir un cambio concurrente. Las reprogramaciones pasan por sus validaciones, notificaciones y eventos existentes.
- `notifyTurnoReprogramado` ya informa fecha anterior y nueva mediante la notificación del sistema y correo por los canales disponibles. El motivo interno no se envía. La entrega de correo continúa siendo asíncrona.
- `registrar_historial_turno` conserva los cambios del turno; `auditar_cambios` registra actor, entidad, valores anteriores/nuevos y salita.
- Las migraciones de agenda del 03/11 establecen un advisory lock compartido antes de escribir turnos, horarios y bloqueos. Se reutiliza ese mismo lock.
- El paciente utiliza `PatientBookingForm`, un selector de días, no una grilla mensual. Antes recibía únicamente fechas disponibles; los días sin disponibilidad desaparecían del selector.
- La vista del profesional calcula sus propias franjas y recibe cambios mediante Socket.IO. Se preservó y se incorporó allí el cierre por salita y fecha.
- No se encontró una integración de feriados oficiales que reutilizar. La gestión incorporada es interna, respaldada por la base de SAPS.

## B. Decisión arquitectónica

Se agregó `cierres_calendario` como regla institucional independiente de la ausencia individual. Un único registro GLOBAL alcanza a todas las salitas, incluidas las que se creen después. Un registro SALITA alcanza a todos los profesionales de la salita indicada. No se generan bloqueos por profesional ni se cambian horarios habituales.

La unión `AgendaChange` incorpora el origen `cierre`. La reprogramación conserva los mismos servicios y componentes. La persistencia del nuevo catálogo tiene su propio repository/service/RPC, pero no un segundo motor para mover turnos.

No se agregó una API externa, librería visual, recurrencia anual ni carga automática de fechas oficiales. Los administradores cargan las fechas concretas según la disposición que corresponda. El tipo clasifica el evento; el alcance determina a quién afecta.

## C. Base de datos

Tabla: `public.cierres_calendario`.

| Campos | Propósito |
| --- | --- |
| `id_cierre` | Identificador UUID |
| `titulo`, `observaciones` | Información administrativa; no se devuelve en la disponibilidad del paciente |
| `tipo` | Clasificación controlada con CHECK y Zod |
| `alcance`, `id_salita` | GLOBAL sin salita o SALITA con FK obligatoria |
| `fecha_inicio`, `fecha_fin` | Fechas civiles DATE; rango inclusivo |
| `dia_completo`, `hora_inicio`, `hora_fin` | Día completo sin horas o franja válida con inicio menor al fin |
| `origen` | Referencia a disposición o carga administrativa |
| `activo` | Baja lógica |
| `creado_por`, `fecha_creacion`, `fecha_actualizacion` | Autor y marcas de tiempo |

Índices parciales para cierres activos globales por fechas y activos por salita/fechas; índice general para ordenar y paginar el calendario. El repository pagina de a 500 para evitar perder reglas por el límite de PostgREST.

`cierre_intersecta` define los solapamientos SQL con intervalos [inicio, fin): terminar justo cuando empieza el cierre o empezar justo al reabrir no implica solapamiento. También cubre turnos manuales que crucen medianoche. Para rangos parciales evalúa la misma franja cada día.

`cierre_turnos_afectados` devuelve filas de turnos y comparte el predicado con la validación de reservas. Los triggers impiden guardar cierres con turnos afectados y reservar sobre cierres activos. `guardar_cierre_calendario` guarda campos permitidos, revalida permisos y configura el contexto del actor para la auditoría.

Se habilita RLS y se revocan permisos de tabla y funciones para PUBLIC, anon y authenticated. Los accesos de la aplicación se realizan a través del backend con service_role. No se modifica ninguna migración anterior.

## D. Tipos de cierre

`FERIADO_NACIONAL`, `FERIADO_PROVINCIAL`, `FERIADO_MUNICIPAL`, `DIA_NO_LABORABLE`, `ASUETO`, `DUELO`, `FUMIGACION`, `MANTENIMIENTO`, `EMERGENCIA`, `CIERRE_ADMINISTRATIVO`, `OTRO`.

La interfaz muestra nombres en español. Disposiciones por fallecimiento, servicios, clima, edificios u otros motivos se clasifican con el tipo apropiado y se documentan en título/origen/observaciones. No implican recurrencia.

## E. Alcances

- GLOBAL: todas las salitas del sistema; no acepta id_salita.
- SALITA: una salita obligatoria; no cierra otras salitas aunque atienda allí el mismo profesional.

Un cierre GLOBAL y otro SALITA pueden coincidir. La disponibilidad resulta cerrada si cualquiera alcanza al slot. El calendario del paciente muestra una sola etiqueta por día y franjas sin duplicados exactos.

## F. Permisos

| Rol | Administración de cierres |
| --- | --- |
| SUPER_ADMIN | Consultar, crear, editar, desactivar y reactivar globales y de cualquier salita |
| ADMIN_SALITA | Consultar globales; administrar solo cierres SALITA dentro de sus asignaciones vigentes |
| RECEPCION | Sin acceso a la gestión ni al impacto de cierres institucionales; mantiene sus permisos previos para ausencias y turnos |
| PROFESIONAL | Sin gestión; su disponibilidad refleja cierres aplicables |
| PACIENTE | Sin gestión ni datos administrativos; consulta estados públicos mediante el flujo de reserva |

API y RPC verifican origen y destino al editar: ADMIN_SALITA no puede convertir un global en local ni mover un cierre a una salita ajena. Los endpoints compartidos de impacto/propuesta/disponibilidad/confirmación también aplican esta restricción cuando el origen es `cierre`.

## G. Disponibilidad

`obtenerDisponibilidad` consulta cierres aplicables una vez por fecha y salita y reutiliza los resultados en memoria para todos los slots. Conserva las comprobaciones de horarios, cupos, ocupación y bloqueos.

Un cierre parcial elimina solo los slots que se superponen, incluso parcialmente. Los demás siguen sujetos a las reglas habituales. Desactivar deja de aplicar el cierre sin alterar ninguna agenda semanal. Se preserva la zona `America/Argentina/Buenos_Aires`; las fechas civiles se almacenan sin desplazamientos UTC.

## H. Seguridad de reservas

`validateTurnoAgenda` comprueba cierres antes de reservar o reprogramar. Una petición directa al endpoint no evita esa validación.

Además, PostgreSQL valida al escribir con `tr_turnos_validar_cierre`, después de sincronizar el estado del turno. Las escrituras de cierres usan el mismo advisory lock de las reservas. Así, si un cierre se guarda entre la consulta de disponibilidad y la reserva, la escritura rechaza el turno. Si el turno se guarda primero, el cierre encuentra el conflicto y exige resolverlo.

La respuesta controlada para una reserva sobre un cierre es HTTP 409, código `INSTITUTIONAL_CLOSURE`. Guardar un cierre con afectados produce `AGENDA_CONFLICT`. No hay fallback que permita reservar si falla la consulta de cierres.

## I. Turnos existentes

Crear, editar, ampliar o reactivar un cierre calcula el impacto sobre turnos que ocupan agenda y todavía no terminaron, siguiendo el criterio existente. La interfaz muestra la cantidad y los pacientes afectados. No se cancelan ni mueven automáticamente.

Mientras existan afectados, el cierre no se guarda. La API comprueba el impacto y el trigger vuelve a comprobarlo bajo el lock de escritura. Los turnos comenzados o con estado final no son reprogramables desde el panel; Administración debe resolver su situación mediante el flujo correspondiente.

## J. Reprogramación, historial, auditoría y avisos

Se reutilizan `AgendaImpactPanel`, `AgendaAffectedList`, `AgendaQuickRow`, `AgendaReview`, `ConfirmationModal`, los cuatro servicios de agenda y `updateTurno`. Se conserva profesional, especialidad y salita. Los destinos deben ser posteriores al fin del turno original y quedar fuera del cierre propuesto, aunque aún no esté guardado.

Continúan los límites existentes: hasta 100 turnos por confirmación y sugerencias opcionales de 1 a 90 días. Cada turno es una transacción; no se revierte un lote completo si uno falla. Elegir un horario no reserva el lugar.

Las notificaciones e historial se generan al confirmar cada reprogramación, antes de guardar la regla de cierre. Este es el comportamiento del flujo reutilizado: no hay una transacción conjunta de correo, todos los turnos y cierre. Si se abandona el borrador, las reprogramaciones confirmadas permanecen.

La nueva tabla usa `auditar_cambios('id_cierre')`: acciones INSERT/UPDATE, actor, alcance, salita y valores anteriores/nuevos. Desactivar es un UPDATE a activo=false. No se creó otra tabla de auditoría ni se insertó historial manualmente.

Tras guardar o desactivar un cierre se emite el evento existente `HORARIO_ATENCION_ACTUALIZADO` a las salas privadas de los profesionales vinculados al alcance anterior/nuevo. Permite refrescar la vista sin crear otro WebSocket; el mensaje no incluye observaciones internas.

## K. Paciente

`GET /disponibilidad/fechas` conserva `fechas` y `ventana`, y agrega `dias` con fecha, disponibilidad, estado, etiqueta pública y franjas cerradas. No devuelve título, observaciones, origen ni actor.

El selector muestra días no disponibles como opciones deshabilitadas. Debajo aparecen sus estados: disponible, sin horario, sin cupos o cierre. Feriados/cierres se resaltan con alerta roja y texto; no se depende solamente del color. Las fechas con cierre parcial se pueden seleccionar si quedan slots válidos.

El selector conserva la actualización existente cada 60 segundos y al recuperar el foco. No se agregó Socket.IO al paciente. La validación definitiva de la reserva impide usar una disponibilidad antigua entre actualizaciones.

## L. Administración

Ruta: `/configuracion/cierres`, accesible desde la tarjeta **Feriados y cierres** de Configuración. Lista vigentes/próximos y permite incluir pasados/inactivos. Muestra tipo, título, fechas, franja, alcance, salita, origen, observaciones y estado.

El formulario muestra el día de semana y fecha completa en el resumen, explica el rango inclusivo y la aplicación diaria de franjas. La desactivación y el guardado requieren los modales existentes. La pantalla usa las clases Bootstrap/SAPS y columnas adaptables a móvil/tablet/escritorio, sin otra librería visual ni rediseño de Sidebar/Navbar.

API administrativa: GET y POST `/cierres-calendario`, PUT y DELETE lógico `/cierres-calendario/:id`. La consulta de disponibilidad usa los endpoints existentes; no se expone un catálogo administrativo a pacientes.

## M. Archivos

Nuevos:

- `backend/src/BBDD/20261107_cierres_calendario.sql`
- `backend/src/controllers/cierre-calendario.controller.ts`
- `backend/src/repositories/cierre-calendario.repository.ts`
- `backend/src/routes/cierre-calendario.routes.ts`
- `backend/src/services/cierre-access.service.ts`
- `backend/src/services/cierre-calendario.service.ts`
- `backend/src/utils/cierre-calendario.ts`
- `backend/src/validators/cierre-calendario.validator.ts`
- `frontend/src/components/turnos/CierreForm.tsx`
- `frontend/src/pages/configuracion/CierresPage.tsx`
- `frontend/src/services/cierre-calendario.service.ts`
- `frontend/src/types/cierre-calendario.types.ts`
- `docs/feriados-cierres-institucionales.md`

Modificados:

- `backend/src/repositories/agenda-impacto.repository.ts`
- `backend/src/routes/index.ts`
- `backend/src/services/agenda-impacto.service.ts`
- `backend/src/services/agenda-propuesta.service.ts`
- `backend/src/services/disponibilidad.service.ts`
- `backend/src/services/patient-agenda.service.ts`
- `backend/src/services/profesional-horarios.service.ts`
- `backend/src/services/turno-agenda.service.ts`
- `backend/src/utils/turno-error.ts`
- `backend/src/validators/agenda-impacto.validator.ts`
- `frontend/src/components/layout/sidebar-menu.ts`
- `frontend/src/components/turnos/AgendaImpactPanel.tsx`
- `frontend/src/components/turnos/AgendaQuickRow.tsx`
- `frontend/src/components/ui/PatientBookingForm.tsx`
- `frontend/src/routes/AppRoutes.tsx`
- `frontend/src/services/agenda-impacto.service.ts`
- `frontend/src/services/turnos.service.ts`

Se preservaron dashboard, infraestructura de sockets, migraciones anteriores, notificaciones y trabajo previo del equipo. No se agregaron dependencias ni se modificaron tests. Los cambios de esta tarea quedan sin commit ni push.

## N. Migración manual

Aplicar **`backend/src/BBDD/20261107_cierres_calendario.sql`** una sola vez, después de las migraciones `20261103_agenda_impacto.sql` y `20261103_agenda_escritura.sql`, antes de usar la nueva API. Crea tabla, índices, funciones, triggers y permisos; finaliza con recarga de esquema de PostgREST.

No se ejecutó la migración contra ninguna base ni se cargaron feriados. Las consultas nuevas requieren esa migración; desplegar la API antes de aplicarla dejará sin funcionar las consultas que requieren el calendario. La validación funcional y SQL queda pendiente de la revisión manual del equipo.

## O. Compilación

| Comprobación | Resultado |
| --- | --- |
| Backend `npm.cmd run typecheck` | OK |
| Backend `npm.cmd run build` | OK |
| Frontend `npm.cmd run build` | OK |

Vite requirió ejecutar el build con permiso fuera del entorno restringido después de un error `spawn EPERM`. La compilación final terminó correctamente; informó únicamente tiempos de plugins. No se ejecutaron tests ni pruebas funcionales. La compilación de TypeScript no valida la ejecución de la migración SQL.

## P. Pruebas manuales recomendadas — no ejecutadas

1. Crear feriado nacional GLOBAL sin turnos: aparece rojo al paciente e impide reservar en todas las salitas.
2. Repetir con feriado provincial, municipal y asueto GLOBAL; confirmar que el alcance seleccionado determina las salitas afectadas.
3. Crear fumigación de una sola salita: todos sus profesionales quedan cerrados; otra salita continúa disponible.
4. Registrar duelo global y duelo local; revisar permisos y que las observaciones internas no aparezcan en las respuestas/pantallas del paciente.
5. Cierre parcial 14:00–18:00: atender 08:00–12:00 continúa habilitado; un horario 12:00–16:00 solo ofrece slots válidos anteriores al cierre. Verificar fronteras exactas y slots que atraviesan el inicio del cierre.
6. Cierre de varias fechas: comprobar ambos extremos inclusivos y la misma franja por día. Comprobar que no aparece al año siguiente.
7. Cierre sobre turnos existentes: revisar cantidad/listado, elección manual, revisión previa, confirmación y guardado final. Consultar avisos, historial y auditoría.
8. Ampliar fecha o franja de un cierre: detectar nuevos afectados; intentar guardar directamente por API debe producir conflicto.
9. Desactivar y reactivar: recuperar disponibilidad normal al desactivar; revisar impacto al reactivar; no devolver automáticamente turnos movidos.
10. Superponer un GLOBAL y un SALITA: permanecer cerrado sin duplicar mensajes iguales. Desactivar solo uno no debe liberar slots alcanzados por el otro.
11. ADMIN_SALITA: intentar crear GLOBAL, editar/desactivar un GLOBAL y operar sobre una salita ajena, tanto por interfaz como por API. Debe rechazarse; probar también el origen `cierre` en los endpoints compartidos de agenda.
12. RECEPCION, PROFESIONAL y PACIENTE: comprobar que no puedan administrar cierres. Revisar que se mantengan sus funciones previas.
13. Dejar disponibilidad abierta, guardar un cierre y reservar desde la pantalla antigua: debe rechazar y permitir actualizar. Repetir con dos solicitudes concurrentes de reserva/cierre.
14. Confirmar reprogramaciones mientras otra persona toma un destino: conservar confirmadas, mostrar fallidas pendientes, impedir guardar con afectados.
15. Revisar casos anteriores de ausencia, horario habitual y reprogramación individual, cupos, paciente con otra reserva y sanciones.
16. Profesional con horarios en dos salitas: comprobar cierre local solo en sus franjas de esa salita y actualización en vivo tras crear/editar/desactivar.
17. Revisar móvil/tablet/escritorio, resumen con día de semana y fechas, modales, selector deshabilitado y distinción entre sin horario, sin cupos y cierre.
