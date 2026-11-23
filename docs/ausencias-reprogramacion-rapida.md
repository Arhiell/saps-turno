# Ausencias y reprogramación rápida — SAPS Turno

Fecha de revisión: 07/11/2026.

Este informe distingue la implementación que ya estaba en el árbol de trabajo de los cambios de esta revisión. No se revirtieron commits ni cambios previos. La reconstrucción se hizo leyendo código, migraciones e historial Git; no se consultó la base remota ni se ejecutaron pruebas funcionales.

Este archivo conserva el registro técnico de esa revisión. Para instrucciones dirigidas al equipo, consultar [Manual funcional por rol](MANUAL_USUARIO.md); las reglas vigentes de reserva y concurrencia están resumidas en [turnos y disponibilidad](TURNOS_Y_DISPONIBILIDAD.md) y [concurrencia de agenda](CONCURRENCIA_AGENDA.md). Los datos históricos de la revisión no certifican el estado de una base desplegada.

## 1. Qué había implementado anteriormente

La base original (`backend/src/BBDD/SAPS_Turno_BBDD3_FINAL.sql`) ya contiene horarios_atencion, bloqueos_agenda, turnos, historial_turnos, auditoria y notificaciones. Turnos ya tiene versión, indicadores derivados del estado y exclusiones de superposición para profesional y paciente.

Las migraciones del 03/11 agregan la consulta de afectados, protecciones al modificar agenda y escritura con contexto administrativo. Backend ya detectaba conflictos y ofrecía propuestas. Frontend ya tenía AgendaImpactPanel y AgendaAffectedList, integrados en BloqueosPage y HorariosPage.

Git muestra estos cambios previos todavía sin commit. El commit reciente 0c2fb6c también corrigió el cálculo de disponibilidad según cupo por horario. No corresponde atribuir todo el diff actual a esta revisión.

## 2. Cómo funcionaba

1. Administración completaba un bloqueo o modificaba un horario.
2. Intentaba guardarlo.
3. Si existían turnos incompatibles, backend respondía AGENDA_CONFLICT.
4. La página abría el panel con los afectados.
5. Se generaba una propuesta automática para 7–90 días.
6. Se podían excluir pacientes o abrir la reprogramación individual en otra pestaña.
7. Se confirmaban los destinos seleccionados.
8. Se consultaban nuevamente los afectados.
9. Sin afectados pendientes, se guardaba por separado el bloqueo o cambio de horario.

Las propuestas no son registros persistidos ni nuevas tablas. Se calculan y se mantienen como datos de la revisión.

## 3. Qué estaba mal o resultaba confuso

- UX: era necesario intentar guardar para descubrir la herramienta.
- UX: no se veían días de atención ni el nombre del día de la ausencia.
- UX: la opción principal era automática; elegir manualmente requería salir del listado.
- Confirmación incompleta: el modal mostraba cantidad, sin el antes/después por paciente.
- Estados: los errores se mostraban sin identificar claramente al paciente.
- Permisos inconsistentes: Recepción podía gestionar agenda y reprogramar por API, pero no entrar al panel; el tipo UserRole tampoco incluía ese rol.
- Dependencias de lectura: los catálogos de profesionales y asignaciones rechazaban a Recepción.
- Mantenibilidad: la página de bloqueos concentraba carga, validación, formulario y listado en unas 800 líneas.
- Código reutilizable: no hacía falta duplicar el algoritmo de disponibilidad, la actualización de turnos, las notificaciones ni el historial.
- Límite existente: la confirmación asistida admite hasta 100 turnos por envío y destinos posteriores a la finalización original. Se conservó y se explica.
- Límite existente: un turno ya comenzado puede seguir apareciendo como afectado, pero no admite esta reprogramación. Requiere resolver su situación administrativa.
- Límite existente: el bloqueo no se persiste hasta resolver los afectados. No existe un borrador durable que reserve la ausencia durante la gestión.
- Las notificaciones usan envío protegido frente a fallos: un error de correo no revierte una reprogramación guardada; la respuesta no certifica entrega del correo.

No se afirmó funcionamiento en ejecución: las conclusiones se basan en lectura del código.

## 4. Qué recomendó el profesor

Priorizar la alternativa B: fecha y horario elegidos por el administrativo desde el mismo listado. La ayuda automática queda disponible, cerrada dentro de una opción secundaria, y no sustituye la revisión humana.

## 5. Solución aplicada

Configuración → Ausencias y reprogramación, para administradores. Recepción tiene un acceso directo con ese nombre en el menú.

1. Elegir salita, profesional y especialidad. “Todos” conserva su alcance amplio y muestra advertencia.
2. Consultar la semana con fechas completas y franjas habituales. Navegar semanas o ingresar una fecha exacta.
3. Indicar ausencia de todo el día o solamente una franja, y motivo interno.
4. Pulsar “Revisar turnos afectados”. Esta acción no guarda la ausencia.
5. Elegir nueva fecha y horario disponible en la tarjeta de cada paciente.
6. Pulsar “Revisar … reprogramaciones”: muestra original → nuevo y pendientes.
7. Confirmar. El servidor vuelve a validar y devuelve resultado por paciente.
8. Cuando no quedan afectados, revisar y guardar la ausencia.

El formulario y la edición de otras ausencias quedan deshabilitados mientras se trabaja en el panel, para conservar el contexto de la revisión.

## 6. Qué reutilizamos

- getAgendaImpact / findAgendaAffected / agenda_turnos_afectados.
- obtenerDisponibilidad y validateTurnoAgenda.
- destinationAllowed, previamente usado por las propuestas automáticas.
- confirmAgendaProposal → updateTurno → patchTurno.
- guardar_turno_agenda / guardar_agenda.
- getTurnoScope / assertTurnoScope y professionalScope.
- getHorarios, getBloqueos, getSalitasConfigurables, catálogos y relaciones existentes.
- guardarBloqueo / guardarHorario.
- notifyTurnoReprogramado / sendSystemNotification / plantillas de correo.
- ConfirmationModal, ValidatedInput, tarjetas, badges, botones SAPS y tabla responsive.
- HorariosPage y la reprogramación individual se conservan; no se reescribieron en esta revisión.

## 7. Base de datos

No se agregaron ni ejecutaron nuevas migraciones.

**20261103_agenda_impacto.sql**
- agenda_turnos_afectados: predicado común para revisión y protección.
- serializar_agenda y tr_agenda_serializar en turnos, horarios y bloqueos: advisory lock de escritura.
- proteger_horario_turnos y tr_horarios_proteger_turnos: impiden modificaciones/desactivaciones/borrados incompatibles.
- Reemplaza validar_bloqueo_agenda, utilizada por el trigger tr_bloqueos_validar de la base original.
- Consulta RPC exclusiva del service_role.

**20261103_agenda_escritura.sql**
- guardar_agenda: campos permitidos, versión de turno, lock, comprobación de rol y alcance de origen/destino, contexto de actor/motivo.
- guardar_turno_agenda: wrapper tipado que usa turno-update.repository.
- registrar_historial_turno: reutiliza el trigger original y registra motivo interno/actor.
- Permisos de RPC limitados al service_role y recarga de esquema.

No agregan tablas ni columnas de propuestas o ausencias. Horarios incompatibles ya están protegidos en service y trigger; se conservan esas protecciones. Según lo indicado por el usuario, estas migraciones ya fueron aplicadas; su instalación remota no se verificó.

## 8. Backend

Flujo existente:
Route → authenticate / requireRole → controller y esquema Zod → service → repository → RPC/PostgreSQL.

Para elegir un destino se agregó POST /turnos/reprogramacion/disponibilidad:
- valida cambio, turno y fecha;
- getAgendaImpact autoriza configuración de origen/destino y cada turno;
- obtiene el turno afectado y conserva profesional, especialidad y salita;
- reutiliza obtenerDisponibilidad;
- descarta destinos que no resuelven el cambio aún no guardado mediante destinationAllowed;
- reutiliza validateTurnoAgenda para validar opciones también respecto del paciente;
- devuelve opciones y versión.

No escribe, no reserva cupos y no introduce otro algoritmo de slots. La confirmación sigue usando el service anterior. Se habilitaron los endpoints asistidos para Recepción, con el mismo alcance por salita.

## 9. Frontend

BloqueosPage ahora coordina componentes pequeños. La vista semanal muestra la configuración vigente para fechas concretas: no supone que un horario se aplica fuera de su vigencia.

AgendaQuickRow consulta opciones al elegir fecha y descarta respuestas de consultas anteriores. Cambiar fecha limpia el destino. Si cambió la versión del turno, exige actualizar afectados.

El listado conserva datos del paciente, profesional, especialidad, salita, fecha original y estado. El panel muestra selección, pendientes y resultado nominal de la última confirmación. La ayuda automática completa solamente pacientes sin elección.

Las tarjetas usan columnas responsive: una en móvil y dos en escritorio; el calendario semanal se apila en pantallas estrechas. Se reutiliza el modal existente con contenido desplazable por la ventana. Esta revisión de estructura no sustituye la comprobación visual manual en dispositivos.

## 10. Ausencia del profesional

Una ausencia puntual es un bloqueo de agenda para una fecha concreta, con día completo o franja. No cambia la regla semanal.

Ejemplo: falta el jueves 12/11/2026. Se elige esa fecha. El miércoles y los siguientes jueves permanecen configurados normalmente.

Desactivar un bloqueo lo deja inactivo; no devuelve a la fecha original los pacientes ya reprogramados. Para cambiar el horario habitual se enlaza al módulo existente.

## 11. Turnos afectados

La RPC selecciona turnos que ocupan agenda y todavía no finalizaron, dentro del alcance del bloqueo y con solapamiento de fecha/franja. Para horarios considera profesional, especialidad, salita, día, vigencia, franja, duración y cupo compatibles.

El repository pagina de a 500, sin truncar a una sola página. El controller omite motivo de consulta, observaciones y otros datos administrativos sensibles de la respuesta.

## 12. Reprogramación

Cada paciente permite elegir nueva fecha y una opción devuelta por backend. No hay ingreso libre de hora de destino. Se mantiene mismo profesional/especialidad/salita y la regla existente de destino posterior al fin original.

Sin disponibilidad, queda pendiente. Se puede confirmar una parte y continuar con el resto. Hasta 100 destinos por confirmación.

## 13. Disponibilidad y cupos

No se calculan slots ni cupos en frontend. La consulta reutiliza bloqueos, horarios y reservas actuales. La confirmación vuelve a validar; SQL protege cupos y superposiciones bajo las estructuras existentes.

Las elecciones todavía no guardadas no reservan cupo. Dos elecciones o dos operadores pueden competir por un lugar: la confirmación mantiene los éxitos e informa el rechazo individual, sin forzar sobrecupos. La ayuda automática tampoco garantiza que todos los destinos sigan libres al confirmar.

## 14. Confirmación

Primera confirmación: reprograma únicamente pacientes con destino; muestra antes/después y pendientes. Cada turno es una operación independiente, no una transacción atómica de todo el conjunto.

Segunda confirmación: guarda la ausencia/cambio de horario, únicamente cuando la revisión no devuelve afectados. El service y el trigger comprueban de nuevo al guardar. Si entró otro turno, se informa el conflicto y debe actualizarse el listado.

Cerrar la pantalla no revierte reprogramaciones ya confirmadas. Las elecciones no confirmadas no se guardan como borrador.

## 15. Notificaciones

Se reutiliza TURNO_REPROGRAMADO. El mensaje general informa modificación de agenda, fecha/hora anterior y nueva y, cuando se dispone, especialidad/salita. El motivo interno no se envía.

Se utilizan las cuentas y tutores vinculados y el correo disponible según el mecanismo actual. No se creó otra vía de notificación ni se certificó entrega durante esta revisión.

## 16. Historial y auditoría

Se conserva el mismo turno. La RPC aporta app.current_user_id, app.current_salita_id y app.change_reason. El historial registra la reprogramación, fechas anteriores/nuevas y actor; los triggers existentes de auditoría registran los cambios en turnos y bloqueos.

No se crea otro historial ni auditoría paralela.

## 17. Roles

| Rol | Resultado |
|---|---|
| SUPER_ADMIN | Flujo completo, alcance global existente. |
| ADMIN_SALITA | Flujo completo limitado a salitas asignadas vigentes. |
| RECEPCION | Nuevo acceso a esta pantalla y endpoints asistidos, dentro de sus salitas. Lectura de profesionales y asignaciones necesarios; no edición de profesionales ni acceso general a Configuración. |
| PROFESIONAL / PACIENTE | Sin acceso al flujo administrativo; no se amplían permisos. |

La ampliación de Recepción fue explícita y acotada: ya tenía permiso backend para bloqueos, disponibilidad y modificación de turnos. professionalScope y getTurnoScope preservan alcance. Los guards se aplican por ruta para no bloquear las rutas de lectura de otros routers montados en /profesionales. Se agregó RECEPCION al tipo UserRole, sin modificar autenticación.

## 18. Archivos modificados en esta revisión

| Archivo | Cambio y motivo |
|---|---|
| backend/src/routes/turno.routes.ts | Consulta de opciones y autorización asistida para Recepción. |
| backend/src/controllers/agenda-impacto.controller.ts | Entrada delgada de la consulta de opciones; delega al service. |
| backend/src/validators/agenda-impacto.validator.ts | Esquema de cambio, turno y fecha para opciones. |
| backend/src/services/agenda-impacto.service.ts | Alinea rol Recepción conservando alcance existente. |
| backend/src/routes/profesional.routes.ts | Lectura del listado para Recepción; las demás acciones permanecen restringidas. |
| backend/src/routes/profesional-especialidad.routes.ts | Lectura de asignaciones; mutaciones mantienen roles administrativos. |
| backend/src/routes/profesional-salita.routes.ts | Lectura de asignaciones con alcance; mutaciones restringidas. |
| frontend/src/services/agenda-impacto.service.ts | Cliente tipado para consulta de opciones. |
| frontend/src/components/turnos/AgendaImpactPanel.tsx | Flujo manual principal, revisión y resultados por paciente; ayuda automática opcional. |
| frontend/src/components/turnos/AgendaAffectedList.tsx | Composición de tarjetas editables en la misma pantalla. |
| frontend/src/pages/configuracion/BloqueosPage.tsx | Coordina el flujo y diferencia ausencia puntual de horario habitual. |
| frontend/src/components/layout/sidebar-menu.ts | Nombres claros y entrada específica para Recepción. |
| frontend/src/routes/AppRoutes.tsx | Ruta de ausencias con los tres roles, separada del resto de Configuración. |
| frontend/src/types/auth.types.ts | Incluye el rol existente RECEPCION en la unión de tipos. |
| docs/agenda-reprogramacion-asistida.md | Referencia a este informe actualizado, conservando el registro previo. |

Algunos archivos de esta tabla ya eran nuevos/sin commit al comenzar; se clasifican aquí como modificados respecto del estado recibido. Las otras modificaciones previas del árbol de trabajo no se atribuyen a esta revisión.

## 19. Archivos creados

| Archivo | Responsabilidad |
|---|---|
| backend/src/services/agenda-disponibilidad.service.ts | Adaptar disponibilidad existente al cambio pendiente, sin escribir. |
| frontend/src/utils/agenda-display.ts | Fechas legibles en zona argentina. |
| frontend/src/components/turnos/AgendaQuickRow.tsx | Selección manual y carga/errores por paciente. |
| frontend/src/components/turnos/AgendaReview.tsx | Resumen antes/después y pendientes. |
| frontend/src/components/turnos/AbsenceSchedule.tsx | Días y franjas habituales de una semana concreta. |
| frontend/src/components/turnos/useAbsenceForm.ts | Carga, validaciones y estado extraídos de BloqueosPage. |
| frontend/src/components/turnos/AbsenceForm.tsx | Formulario de ausencia con pasos claros. |
| frontend/src/components/turnos/AbsenceList.tsx | Listado y edición de ausencias existentes. |
| docs/ausencias-reprogramacion-rapida.md | Reconstrucción, cambios y guía de uso para el equipo. |

## 20. Código eliminado o reemplazado

Se reemplazó la apertura del panel solamente después de un error de guardado por una revisión explícita previa en Bloqueos. Se sustituyó la tarjeta que obligaba a abrir otra pestaña por selección manual embebida. El enlace al detalle queda como complemento donde el rol tiene acceso.

Se extrajeron carga/validación/formulario/listado de BloqueosPage. No se eliminaron migraciones, tablas, propuestas automáticas, services de actualización ni validaciones de negocio. No se modificaron las páginas de profesionales ni HorariosPage en esta revisión.

## 21. Resultado de compilación

| Comando | Resultado |
|---|---|
| Backend: npm.cmd run typecheck | OK |
| Backend: npm.cmd run build | OK |
| Frontend: npm.cmd run build | OK |

La compilación frontend encontró inicialmente la ausencia de RECEPCION en UserRole; se corrigió. Vite requirió ejecución autorizada fuera del sandbox tras un error spawn EPERM; la compilación final terminó correctamente. La compilación no certifica el comportamiento funcional ni el despliegue de las migraciones.

## 22. Qué probar manualmente

Estas comprobaciones quedan a cargo del usuario:

1. Abrir con SUPER_ADMIN, ADMIN_SALITA y RECEPCION.
2. Comparar miércoles/jueves y vigencias en la semana; ingresar fecha directamente.
3. Revisar ausencia completa/parcial, con y sin pacientes; comprobar alcance de “Todos”.
4. Elegir nueva fecha/hora para uno y varios pacientes desde el listado.
5. Ver sin disponibilidad, dejar pendientes y revisar el resumen antes/después.
6. Confirmar y verificar resultados individuales, historial, auditoría y notificación.
7. Ocupar un destino desde otra sesión antes de confirmar: debe quedar pendiente sin superposición.
8. Guardar la ausencia después de resolver afectados; confirmar que otras fechas siguen disponibles.
9. Intentar operar una salita ajena con ADMIN_SALITA/RECEPCION.
10. Editar/desactivar bloqueo y modificar/desactivar horario con turnos futuros.
11. Revisar diseño a 320, 375, 425, 768, 1024 y 1440 px, incluida confirmación con lista larga.

## Texto para compartir con compañeros

“Mejoramos la gestión de ausencias para que Administración y Recepción puedan reorganizar los pacientes desde una misma pantalla. Primero se elige profesional, salita y fecha; la pantalla muestra los días y horarios habituales para evitar confusiones. Después aparecen los turnos afectados y se puede elegir una nueva fecha y un horario disponible para cada paciente. Antes de guardar se revisa el cambio de cada uno. El sistema vuelve a validar los lugares, conserva los pacientes que quedan pendientes y registra los cambios mediante el historial y las notificaciones existentes. Finalmente se confirma la ausencia del día, sin modificar el horario semanal del profesional. Las sugerencias automáticas quedan como ayuda opcional; la decisión sigue siendo del personal administrativo.”
