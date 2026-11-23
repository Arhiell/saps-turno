# Horarios, ausencias y reprogramación asistida

> Registro de la implementación inicial del 03/11. Para el flujo actual de selección manual en la misma pantalla, los permisos de Recepción y la guía del equipo, consultar [Ausencias y reprogramación rápida](ausencias-reprogramacion-rapida.md). Según el usuario, las dos migraciones iniciales ya fueron aplicadas; no se ejecutaron nuevamente en la revisión del 07/11.

## Diagnóstico del sistema anterior

Análisis del código y del esquema SQL versionado, no de los datos de una base remota.

1. `horario-atencion.routes.ts` autentica, verifica roles y aplica `scheduleScope` antes del controller. El controller llama al servicio y este al repository de Supabase.
2. `actualizarHorario` validaba horas y vigencia y guardaba el cambio. `eliminarHorario` hacía baja lógica (`activo=false`). Ninguno consultaba los turnos dependientes.
3. En `SAPS_Turno_BBDD3_FINAL.sql`, `validar_turno` protege escrituras **de turnos**, pero no cambios posteriores de `horarios_atencion`. Por tanto, cambiar 08:00–12:00 a 14:00–18:00 podía dejar reservas vigentes en la franja anterior.
4. `id_horario` es nullable y su FK usa `ON DELETE SET NULL`. La API normal lo determina en `validateTurnoAgenda`. No se comprobó cuántos registros históricos/manuales tienen NULL en la base desplegada.
5. Las ausencias puntuales ya están representadas por `bloqueos_agenda`: fecha, salita, profesional/especialidad opcionales y día completo o intervalo. El trigger `validar_bloqueo_agenda` rechazaba bloqueos con turnos ocupantes, sin una propuesta para resolverlos.
6. La reprogramación individual utiliza `PATCH /turnos/:id`, `updateTurnoSchema`, `updateTurno`, `validateTurnoAgenda` y `patchTurno`. Actualiza el mismo registro, conserva estado y recalcula horario y finalización. `REPROGRAMADO` es final y no ocupa agenda: no corresponde asignarlo al turno que sigue vigente. `id_turno_origen` no se utiliza en este flujo.
7. Disponibilidad genera slots con horarios activos/vigentes, resta bloqueos y superposiciones y consulta `countTurnosDelHorario`. La reserva valida además paciente, asociaciones, sanción, superposición del paciente y turno abierto de la misma especialidad.
8. El cupo es por `id_horario`, fecha argentina y `ocupa_agenda`. Slots libres y cupo remanente no son equivalentes: la propuesta debe descontar cada asignación simulada.
9. Concurrencia existente: versión optimista del turno, exclusiones de superposición para paciente/profesional, unicidad de turno abierto y `FOR UPDATE` sobre el horario al reservar. Faltaba coordinar cambios de bloqueos/horarios con reservas concurrentes.
10. `notifyTurnoReprogramado` reutiliza `sendSystemNotification`, destinatarios paciente/tutores, correo y `safeNotify`. Los fallos de aviso no revierten turnos guardados.
11. `registrar_historial_turno` registra automáticamente estados y fechas anteriores/nuevas. `auditar_cambios` conserva filas anteriores/nuevas. Ambos aceptan contexto transaccional, pero la reprogramación anterior no establecía el actor: el historial podía recurrir al creador del turno.
12. SUPER_ADMIN tiene alcance global. ADMIN_SALITA y RECEPCION se limitan por `usuario_salita` vigente. Los endpoints existentes de Horarios/Bloqueos permiten también RECEPCION; se preservan. La nueva asistencia exige SUPER_ADMIN o ADMIN_SALITA.
13. El historial entregado a pacientes/profesionales ya omite `detalle` y datos administrativos del actor. Se reutiliza para proteger el motivo interno.
14. El frontend ya tiene formularios, mensajes Bootstrap, `ConfirmationModal` y página individual de reprogramación. Horarios y Bloqueos eran pantallas grandes: la asistencia se implementa aparte.
15. La validación de disponibilidad y la validación de una reserva tienen controles de intervalos relacionados, pero responsabilidades diferentes. No se reemplazaron por otro motor ni se refactorizaron módulos ajenos. Se comparte el predicado SQL de afectados entre consulta y guardado y se eliminaron las escrituras de repository que quedaron sin uso.

## Solución y reglas

**Turno afectado:** ocupa agenda, todavía no terminó y resulta incompatible con el cambio. Incluye atención en curso para impedir que se invalide su configuración. La propuesta automática solo mueve turnos que aún no comenzaron y cuyo estado no es final.

Para horarios, se comprueban actividad, profesional, especialidad, salita, día, vigencia, límites, duración, alineación a la grilla y cupo. La reducción del cupo marca el excedente por fecha en orden cronológico, conservando primero los turnos anteriores. Ampliaciones y cambios que conservan todas las reservas válidas no se bloquean. Los turnos con `id_horario=NULL` no se atribuyen artificialmente a un horario; sí participan en bloqueos y superposiciones según las reglas existentes.

Para una ausencia se utiliza Bloqueos, conservando el horario semanal. Los filtros opcionales permiten afectar a un profesional o a todo el ámbito de una salita. No se eliminan ni cancelan turnos automáticamente.

El guardado incompatible devuelve HTTP 409 con `AGENDA_CONFLICT`. La pantalla abre un panel de resolución con los pacientes, turno actual, profesional, especialidad, salita y estado. No muestra DNI ni datos clínicos.

La propuesta es solo lectura. Ordena pacientes por fecha original e identificador y busca la fecha/hora válida más cercana, desde la finalización original. Conserva profesional, especialidad y salita. Puede usar mañana y tarde y diferentes días. No reparte artificialmente si eso retrasa una atención que ya tiene lugar cercano.

Utiliza `obtenerDisponibilidad`, `validateTurnoAgenda` y `countTurnosDelHorario`, con caché de disponibilidad durante la solicitud y contadores/intervalos simulados. No cuenta dos veces un mismo lugar ni excede el cupo al proponer varios pacientes. Los destinos se revalidan al confirmar.

La búsqueda admite 7, 14, 30, 60 o 90 días desde cada turno; el backend acepta de 1 a 90. Cada lote propone hasta 100 afectados; el resto permanece visible y pendiente. No amplía la ventana de reserva del paciente: utiliza las reglas de reprogramación administrativa existentes.

Para cambios permanentes, la asistencia utiliza **otros horarios actuales** del profesional. No ofrece el horario cuya configuración se está cambiando, pues todavía no se aplicó. Si es el único horario y no hay destinos alternativos, el administrador deberá configurar una franja alternativa válida o resolver individualmente. No se crea capacidad ni se cambia de profesional automáticamente.

Se puede excluir una propuesta o abrir la página individual existente en otra pestaña. Después de ajustar individualmente se debe actualizar el panel. El motivo interno es obligatorio tanto en la confirmación asistida como en la reprogramación individual. El formulario individual envía la versión revisada y el motivo como metadatos de la solicitud, sin columnas nuevas; un formulario desactualizado debe volver a cargar el turno.

La confirmación es **parcial controlada, una transacción por turno**. Cada elemento vuelve a comprobar afectación, estado, inicio futuro, versión, alcance, destino y todas las reglas de `updateTurno`. Devuelve éxitos/fallos individuales. Un turno guardado permanece guardado aunque otro falle. Si se pierde la respuesta de red, actualizar afectados antes de reintentar; no se presume que todo el lote falló.

Si hay diez pacientes y siete lugares, se proponen siete y quedan tres pendientes. El cambio de agenda sigue sin guardarse. Cuando no quedan afectados, el botón **Guardar cambio de agenda** usa los servicios habituales; el backend y el trigger vuelven a comprobarlo. Una nueva reserva concurrente puede impedir ese guardado: se actualiza la lista y se resuelve el nuevo conflicto.

No se implementan sobrecupos extraordinarios: no existe una regla autorizada de límites o admisión para ellos.

## Base de datos y despliegue

Se prepararon dos migraciones; **no se ejecutaron sobre una base remota**. Aplicar en este orden antes de desplegar la API:

1. `backend/src/BBDD/20261103_agenda_impacto.sql`
2. `backend/src/BBDD/20261103_agenda_escritura.sql`

No agregan tablas ni columnas, ni migran/eliminan turnos. El archivo base destructivo `SAPS_Turno_BBDD3_FINAL.sql` no se modificó ni debe volver a ejecutarse para actualizar una instalación.

La primera migración incorpora el predicado compartido, protege cambios/bajas de horarios y actualiza la protección de bloqueos. Un advisory lock transaccional se toma antes de bloquear filas en escrituras de las tres tablas de agenda. Es global y solo dura la escritura de base: privilegia una coordinación simple y segura para esta escala; no bloquea las lecturas, la generación de propuestas ni el envío de correo. Puede limitar el rendimiento de escrituras concurrentes a gran escala.

La segunda agrega RPC restringidas a `service_role` para escribir mediante los triggers existentes y establecer actor, salita y motivo en la misma transacción. Conserva el control de versión y revalida rol y alcance sobre las salitas de origen/destino bajo el lock de escritura. Las RPC no son endpoints públicos para el navegador; los controllers/servicios continúan autenticando y autorizando. Las escrituras normales de reservas mantienen sus controles existentes.

El historial conserva estado, fecha anterior/nueva, actor real y motivo de reprogramación asistida. La auditoría existente registra valores anteriores/nuevos, incluida la relación con horario y las horas completas. No se creó un historial ni una auditoría paralelos. La atribución de otras operaciones ajenas a esta tarea no se rediseñó.

Los avisos de reprogramación incluyen especialidad, salita, fecha/hora anterior y nueva y un mensaje público genérico de cambio de agenda. El motivo interno no se envía. Se conservan los canales SISTEMA/EMAIL, usuarios/tutores disponibles y el patrón de errores seguros existente. No se agregó una garantía nueva de entrega ni una cola distinta.

## Archivos modificados

| Archivo | Responsabilidad |
| --- | --- |
| `backend/src/controllers/horario-atencion.controller.ts` | Pasar actor autenticado a escrituras. |
| `backend/src/controllers/bloqueo-agenda.controller.ts` | Pasar actor autenticado a escrituras. |
| `backend/src/services/horario-atencion.service.ts` | Comprobar impacto antes de modificar/desactivar y guardar con contexto. |
| `backend/src/services/bloqueo-agenda.service.ts` | Comprobar impacto antes de crear/editar y guardar con contexto. |
| `backend/src/repositories/horario-atencion.repository.ts` | Conservar lecturas y retirar escrituras reemplazadas, sin duplicación. |
| `backend/src/repositories/bloqueo-agenda.repository.ts` | Conservar lecturas y retirar escrituras reemplazadas. |
| `backend/src/repositories/turno-update.repository.ts` | Reutilizar actualización/versionado mediante RPC cuando hay contexto. |
| `backend/src/services/turno-update.service.ts` | Admitir versión de propuesta y motivo; conservar toda la validación y notificación individual. |
| `backend/src/validators/turno-update.validator.ts` | Admitir versión y motivo como metadatos de la solicitud individual. |
| `backend/src/services/disponibilidad.service.ts` | Exponer el cupo remanente ya calculado por horario para reutilizarlo en la simulación sin otra consulta de conteo. |
| `backend/src/services/notificacion-turno.service.ts` | Completar aviso con datos anteriores y nuevos. |
| `backend/src/services/turno-email-template.service.ts` | Mensaje público genérico sin motivo privado. |
| `backend/src/utils/turno-error.ts` | Traducir conflicto del trigger a HTTP 409. |
| `backend/src/routes/turno.routes.ts` | Impacto, propuesta y confirmación con roles administrativos explícitos. |
| `frontend/src/pages/configuracion/HorariosPage.tsx` | Integración mínima del panel al recibir un conflicto. |
| `frontend/src/pages/configuracion/BloqueosPage.tsx` | Misma integración para ausencias. |
| `frontend/src/pages/turnos/ReprogramarTurnoPage.tsx` | Pedir motivo interno y enviar la versión revisada también en ajustes individuales. |
| `frontend/src/types/turno.types.ts` | Extender el contrato individual con motivo y versión opcionales. |

## Archivos nuevos

| Archivo | Responsabilidad |
| --- | --- |
| `backend/src/BBDD/20261103_agenda_impacto.sql` | Predicado, coordinación de escrituras y protecciones. |
| `backend/src/BBDD/20261103_agenda_escritura.sql` | RPC, contexto de actor/motivo y extensión del trigger de historial. |
| `backend/src/repositories/agenda-impacto.repository.ts` | Consulta paginada de afectados y escritura RPC. |
| `backend/src/validators/agenda-impacto.validator.ts` | Validación de cambio, horizonte, motivo y lote. |
| `backend/src/validators/horario-rules.ts` | Validación temporal existente extraída para reutilizarla en la propuesta. |
| `backend/src/services/agenda-impacto.service.ts` | Alcance y detección de afectados. |
| `backend/src/services/agenda-propuesta.service.ts` | Simulación sobre disponibilidad real. |
| `backend/src/services/agenda-confirmacion.service.ts` | Orquestar `updateTurno` y resumir resultados parciales. |
| `backend/src/controllers/agenda-impacto.controller.ts` | Contratos HTTP de asistencia. |
| `frontend/src/services/agenda-impacto.service.ts` | Contratos y llamadas de asistencia. |
| `frontend/src/components/turnos/AgendaImpactPanel.tsx` | Revisar, proponer, confirmar y guardar. |
| `frontend/src/components/turnos/AgendaAffectedList.tsx` | Cards adaptables con pacientes y destinos. |
| `docs/agenda-reprogramacion-asistida.md` | Diagnóstico, implementación, despliegue y escenarios manuales. |

Se reutilizan además los tipos Turno, HorarioInput/BloqueoInput, `ConfirmationModal`, Bootstrap, `authError`, `api`, `guardarHorario`, `guardarBloqueo` y la ruta individual de reprogramación. No se modificó `frontend/src/pages/profesionales/` ni `NuevoTurnoPage.tsx`. No se agregaron dependencias.

## Comprobaciones y escenarios manuales

No se crearon ni ejecutaron tests, scripts de prueba ni datos ficticios. Tampoco se hicieron pruebas funcionales por navegador o consultas de validación sobre una base remota. La compilación no valida la ejecución de SQL ni el comportamiento visual.

Resultados finales: backend `npm.cmd run typecheck` **correcto**, backend `npm.cmd run build` **correcto** y frontend `npm.cmd run build` **correcto**. Se utiliza `.cmd` porque PowerShell bloquea `npm.ps1`. Vite requirió ejecución autorizada fuera del sandbox después de un error `spawn EPERM`.

Escenarios para realizar manualmente después de aplicar las migraciones:

1. Editar sin afectados, ampliar una franja compatible y cambiar vigencia conservando turnos: deben guardar.
2. Cambiar día, duración, límites, profesional, especialidad/salita o desactivar con turnos futuros: debe rechazar antes de guardar y permitir revisar afectados.
3. Reducir cupo por debajo de reservas de una fecha: solo marcar excedentes; no mezclar horarios ni días. Combinar cambio de franja y reducción de cupo: los turnos que ya deben salir por incompatibilidad no deben provocar excedentes adicionales entre quienes pueden permanecer.
4. Ausencia de un día completo y de una franja parcial: el horario semanal debe conservarse; revisar límites contiguos exactos.
5. Diez pacientes con diez destinos y con solo siete: previsualización sin escrituras y pendientes explícitos, sin sobrecupos.
6. Ocupar un destino después de generar propuesta y confirmar desde dos administradores: conflicto/versionado sin doble reprogramación.
7. Reprogramar algunos, excluir otros y ajustar individualmente: confirmar resultados y actualizar el panel; impedir guardar mientras quedan afectados.
8. Guardar después de resolver; introducir simultáneamente una nueva reserva en origen: debe volver a bloquear el cambio.
9. Verificar historial, actor, motivo interno, auditoría, SISTEMA/EMAIL y que el paciente no vea información interna.
10. Manipular IDs de otra salita en las tres acciones nuevas y en guardar: ADMIN_SALITA debe recibir rechazo; SUPER_ADMIN conserva alcance global.
11. Verificar estados finales, registros pasados y turnos ya iniciados; los históricos no deben bloquear cambios futuros.
12. Revisar cards, controles y modal a 320, 375, 425, 768, 1024 y 1440 px; no se verificaron visualmente en esta tarea.
