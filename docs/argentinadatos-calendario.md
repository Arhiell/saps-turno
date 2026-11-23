# SAPS Turno — ArgentinaDatos en el calendario institucional

## Uso para administración

Entrar en **Configuración → Feriados y cierres**. SUPER_ADMIN dispone de **Actualizar feriados nacionales**. La confirmación explica que los nuevos feriados bloquean reservas inmediatamente, pero no mueven turnos existentes.

Las instrucciones de esta sección describen el uso actual. Las secciones numeradas documentan decisiones y límites técnicos de la implementación; no prueban el estado de una base remota ni la disponibilidad actual del proveedor.

El resultado indica, por año, nuevos, actualizados, sin cambios, coincidencias con carga manual y turnos pendientes al sincronizar. **Actualizar estado y calendario** vuelve a leer SAPS, sin llamar a ArgentinaDatos. La última actualización válida corresponde al año actual; el resultado separado del año siguiente permite ver si todavía no está disponible.

Las tarjetas importadas muestran **ArgentinaDatos (solo lectura)**, el tipo original y la cantidad actual de turnos pendientes en el alcance del usuario. **Ver turnos afectados / reprogramar** abre el panel ya existente. Elegir, revisar y confirmar nuevos horarios continúa siendo una decisión administrativa.

El feriado importado ya está guardado: al terminar de reprogramar no hay que guardarlo otra vez. Los cierres manuales siguen con su flujo anterior: resolver afectados y guardar después. No se envían avisos de reprogramación hasta confirmar cambios en turnos.

## 1. Infraestructura existente

Se revisaron los cambios sin confirmar del calendario, su migración, repository, services, controllers, rutas, permisos, disponibilidad, reserva, impacto, propuestas, confirmación, historial, auditoría, frontend y dependencias.

Ya existían `cierres_calendario`, alcances GLOBAL/SALITA, fechas inclusivas, franjas parciales y cierre activo; `cierre_intersecta` y `cierre_turnos_afectados`; validación de reserva en API y PostgreSQL; advisory lock compartido de agenda; y panel de reprogramación asistida.

El backend ya tenía un procesador periódico de notificaciones con `setTimeout`, control de ejecución y cierre ordenado. No tenía un cron genérico. También usaba `fetch` nativo, timeout, rechazo de redirecciones y lectura limitada para el RSS municipal. No se agregó ninguna dependencia.

## 2. Reutilización

Se extendieron el catálogo y los endpoints de cierres, su repository/service, los permisos y `AgendaImpactPanel`. Se reutilizan `AgendaAffectedList`, `AgendaQuickRow`, `AgendaReview`, `getAgendaImpact`, propuestas, disponibilidad, confirmación, `updateTurno`, notificaciones e historial existentes.

La disponibilidad sigue leyendo exclusivamente la base SAPS. No se agregó una consulta HTTP externa a reservas, calendarios de pacientes, propuestas ni confirmaciones.

## 3. Responsabilidades nuevas

Un repository de lectura externa valida ArgentinaDatos; un servicio coordina la sincronización; una fila persistente guarda ejecución/resultado y un lease. La importación transaccional vive en el repository y RPC del calendario. No hay otro calendario, motor de disponibilidad, sistema de auditoría ni reprogramación paralela.

## 4. Consumo de ArgentinaDatos

Fuente fija controlada por el servidor: `https://api.argentinadatos.com/v1/feriados/{año}`. Se usa GET con `fetch`, timeout de 8 segundos, sin redirecciones y límite de 250 KB. Se valida la respuesta completa con Zod: array no vacío, máximo 366 registros, fechas válidas pertenecientes al año solicitado, nombre y tipo admitidos. Un payload inválido no se aplica parcialmente.

La [documentación del proveedor](https://argentinadatos.com/docs/operations/get-feriados.html) describe fecha, tipo y nombre y actualmente muestra un rango de años limitado. La [respuesta consultada en lectura](https://api.argentinadatos.com/v1/feriados/2026) incluye `inamovible`, `trasladable` y `puente`. No se ejecutó una importación funcional ni se cargó esa respuesta en SAPS durante el desarrollo.

Mapeo institucional solicitado: los tres tipos se almacenan como `FERIADO_NACIONAL`, GLOBAL y día completo; el tipo externo original queda en `datos_externos`. Esto representa la regla de cierre del sistema, sin reemplazar la clasificación original del proveedor. Si aparece un tipo desconocido se conserva la información anterior y se registra que ese año no pudo actualizarse.

## 5. Año dinámico

El servicio obtiene el año de `agendaDateTime(new Date())`, utilizando el reloj del servidor. No recibe año ni URL desde React. El endpoint manual admite únicamente un objeto vacío.

No hay `YEAR = 2026` ni un máximo permanente igual al último año publicado. Se consulta el año actual y el siguiente; no se calculan feriados ni se copian fechas entre años.

## 6. Zona horaria

Se utiliza `America/Argentina/Buenos_Aires` tanto en Node mediante la utilidad existente como en SQL para decidir cuándo corresponde ejecutar. Las fechas de los feriados siguen siendo DATE. Los instantes de intento/éxito se guardan como timestamptz y se presentan con la utilidad argentina del frontend.

## 7. Ejecución semanal

El procesador periódico de notificaciones existente recibe una tarea adicional de calendario. La tarea se ejecuta en segundo plano, sin esperar el HTTP externo para procesar correos, y se espera durante el cierre ordenado del servidor. No se crea otro timer.

La tarea consulta si corresponde sincronizar aproximadamente una vez por minuto. PostgreSQL concede un lease de cinco minutos mediante bloqueo de la fila de estado. Las instancias comparten esa fila: solo una ejecuta la importación. Cada escritura y finalización verifican el token y su vigencia para rechazar procesos vencidos.

## 8. Hora del sábado

**Sábado a las 03:00, hora argentina.** Se calcula el último sábado de las 03:00 y se compara con el último intento persistido. La ejecución ocurre en el siguiente ciclo del procesador, no necesariamente en el segundo exacto. No depende de la zona del sistema operativo.

## 9. Servidor apagado y recuperación

Al iniciar, el procesador hace su primera revisión. Si no existe intento para el último sábado debido, ejecuta la sincronización, aunque el servidor vuelva un lunes. No reproduce todos los sábados perdidos: actualiza una vez con los años actuales.

Si un proceso se interrumpió con el lease abierto, otra revisión puede recuperarlo cuando vence. Si la ejecución terminó y registró un fallo, no insiste cada minuto: vuelve a intentarlo el sábado siguiente o mediante el botón manual. Mientras el backend esté apagado no puede sincronizar; al volver recupera la ejecución debida.

## 10. Próximo año

Cada ejecución intenta el año actual y `año actual + 1` por separado. Cada respuesta válida se aplica en una transacción propia. Que falle un año no elimina ni revierte lo incorporado válidamente para el otro.

## 11. Año todavía no publicado

Un HTTP de error, respuesta vacía/inválida o imposibilidad de consulta se informa como **NO_DISPONIBLE** para ese año: la fuente puede no haberlo publicado o no haber podido consultarse. No se afirma que un timeout signifique necesariamente que el año no existe.

Se conserva la base anterior, no se inventan fechas y se vuelve a intentar en la próxima ejecución. La interfaz permite ver el resultado de ambos años. `ultimo_exito` avanza cuando el año actual se guardó correctamente; no implica que también esté publicado el siguiente.

## 12. Idempotencia y coincidencias

ArgentinaDatos no aporta un ID estable de evento. Se usa como clave natural **fuente + fecha civil**, protegida por índice único. Los registros de una misma fecha se agrupan en una regla de cierre y sus nombres/tipos se conservan en JSON. El orden se normaliza para no generar actualizaciones ficticias.

Si título y datos externos siguen iguales no se ejecuta UPDATE: no se duplica el registro ni se genera auditoría de esa fila. Si cambian nombre o tipo de la misma fecha se actualiza solo el importado.

Si una fecha desaparece de la respuesta se conserva y se informa su cantidad como `no_recibidos_conservados`. Una fecha trasladada que aparece con otra fecha se incorpora como nueva; no se infiere qué registro anterior reemplazó. Esa limitación es deliberada: la fuente no tiene un identificador estable y se pidió no borrar ante respuestas incompletas.

Cuando coincide un feriado nacional manual, GLOBAL, activo, de día completo y de la misma fecha exacta, se conserva sin cambios. La interfaz agrupa la carga manual dentro de la tarjeta importada y mantiene acceso a su edición autorizada. No se fusionan asuetos, recesos, rangos, eventos provinciales ni cierres locales por coincidencia parcial.

La disponibilidad aplica una regla booleana de cierre y el paciente ve una sola etiqueta diaria. Los afectados se consultan en vivo: después de mover un turno deja de estar afectado también por el registro coincidente, sin crear otra tarea para moverlo por segunda vez.

## 13. Origen y trazabilidad

Se reutiliza `origen`, con `API_ARGENTINADATOS` para los importados. Se añaden `fuente_externa`, `clave_externa` y `datos_externos` como identidad técnica protegida. Las cargas anteriores mantienen sus textos originales y fuente externa nula. La interfaz distingue **Manual** de **ArgentinaDatos** por la identidad protegida, no por un texto editable.

Los importados son de solo lectura, incluso para SUPER_ADMIN: no se permite editar/desactivar sus filas por el CRUD manual y el trigger repite la protección. Así ninguna edición manual desaparece silenciosamente al sincronizar. No se implementó una excepción que desactive un feriado importado; una corrección del proveedor puede actualizar nombre/tipo, pero las fechas retiradas se conservan para revisión institucional, sin eliminación automática.

## 14. Preservación de eventos locales

La RPC de importación busca y modifica exclusivamente `fuente_externa = ARGENTINADATOS`. No convierte ni sobreescribe registros manuales. Cierres provinciales/municipales, asuetos, duelo, mantenimiento y recesos siguen gestionándose en el formulario actual, con rango, alcance y horarios originales. La carga manual sigue disponible como respaldo cuando la API todavía no informa una fecha.

## 15. Fallos y registro de resultados

No se elimina ningún cierre en la sincronización. Los fallos HTTP/red/JSON/tipo/año conservan los datos anteriores; un error SQL revierte la transacción de ese año. El resultado por año queda persistido, con último intento, modo y último éxito. La consola registra el detalle técnico; la interfaz muestra mensajes breves.

La auditoría existente registra cambios reales de cierres y el inicio/final de cada ejecución en `calendario_sincronizacion`. El modo distingue AUTOMATICA de MANUAL. El actor es el SUPER_ADMIN que pidió la ejecución manual; para el proceso automático es NULL, sin inventar un usuario ni atribuirle acciones a una persona. Se permite `creado_por` nulo solo para registros importados.

Si el proceso pierde conexión al finalizar, puede haber datos ya guardados y un estado EN_CURSO hasta que se recupere el lease. La recuperación es idempotente. La interfaz permite actualizar estado/calendario en vez de asumir que una respuesta HTTP fallida implica que no se guardó nada.

## 16. Feriado nuevo con turnos

La importación autorizada puede guardar el cierre aunque existan turnos. El mismo lock transaccional de agenda serializa la importación y las reservas. El feriado bloquea nuevas reservas inmediatamente al confirmar la transacción, y los turnos preexistentes permanecen pendientes para la administración.

Se conserva `validar_turno_cierre`: una reserva o confirmación con disponibilidad vieja se rechaza. Reprogramar hacia una fecha abierta o cancelar por el flujo autorizado sigue siendo posible. No se modifican turnos, estados, historial ni notificaciones como parte de la importación.

La excepción al requisito de resolver afectados antes de guardar se limita a la RPC con lease vigente que importa la fuente externa. Los cierres manuales mantienen la protección anterior y siguen requiriendo resolver los afectados antes de guardar.

## 17. Reprogramación reutilizada

Los importados usan el mismo origen `cierre` y los mismos endpoints de agenda. El backend carga la regla persistida y exige que coincida con la selección del frontend: no acepta alterar fecha/alcance del feriado mediante un borrador inventado.

Para ADMIN_SALITA se filtran los afectados por sus asignaciones vigentes; SUPER_ADMIN ve todos. Al confirmar se mantienen el control de versión del turno y la autorización de origen/destino existente. El panel recibe `persistido` para explicar que la regla ya está activa y no ofrecer guardarla otra vez.

Se conservan elección manual, sugerencias opcionales, lotes de hasta 100, restricciones de horarios/cupos, resultados parciales, avisos e historial al confirmar cada reprogramación. Los turnos que ya comenzaron requieren gestión administrativa como en el flujo anterior.

## 18. Paciente

No consume ArgentinaDatos ni ve su procedencia. Los importados son cierres globales de la misma tabla y aparecen con la etiqueta pública **FERIADO**, el estado rojo y la fecha no seleccionable ya implementados. La disponibilidad, reserva y reprogramación dependen de SAPS, no de Internet hacia la fuente.

## 19. SUPER_ADMIN

Puede consultar el estado y resultados, solicitar sincronización manual, ver todos los feriados importados y resolver todos sus turnos afectados. Mantiene la gestión de los eventos manuales globales/locales. No modifica directamente filas de ArgentinaDatos.

Endpoints añadidos al módulo actual: GET `/cierres-calendario/sincronizacion` para estado; POST en la misma ruta para actualización manual, exclusivamente SUPER_ADMIN. No reciben URL ni año del navegador.

## 20. ADMIN_SALITA

Puede consultar feriados nacionales y estado de actualización, ver cuántos turnos de sus salitas están pendientes y usar la reprogramación existente solo sobre esos turnos. No dispara sincronizaciones ni edita cierres globales/importados. Conserva su gestión de cierres manuales locales. RECEPCION, PROFESIONAL y PACIENTE no reciben permisos nuevos de administración.

El resumen de sincronización oculta a ADMIN_SALITA las cantidades globales de turnos; las tarjetas muestran únicamente cantidades calculadas dentro de su alcance vigente.

## 21. Migraciones

Nueva: **`backend/src/BBDD/20261108_argentinadatos.sql`**. Debe ejecutarse manualmente **después de `20261107_cierres_calendario.sql`**, que a su vez depende de las migraciones de agenda del 03/11.

La migración añade metadatos e índice único, estado persistente/lease, RPCs, permisos y auditoría. Reemplaza `validar_cierre_calendario` para distinguir la importación autorizada del CRUD manual. No modifica el archivo SQL anterior, no elimina datos ni carga feriados durante la migración.

**No se ejecutó ninguna migración ni sincronización contra la base durante este trabajo.** Aplicar las migraciones antes de iniciar/desplegar esta versión del backend: al arrancar puede importar automáticamente si hay una ejecución debida. No se requieren variables nuevas de entorno.

## 22. Archivos creados en esta continuación

- `backend/src/BBDD/20261108_argentinadatos.sql`
- `backend/src/repositories/argentinadatos.repository.ts`
- `backend/src/services/calendario-sync.service.ts`
- `frontend/src/components/turnos/CalendarioSyncPanel.tsx`
- `docs/argentinadatos-calendario.md`

## 23. Archivos extendidos en esta continuación

- `backend/src/server.ts`: vincula la tarea de calendario al procesador existente.
- `backend/src/services/notificacion-worker.service.ts`: callback periódico en segundo plano y cierre ordenado.
- `backend/src/repositories/cierre-calendario.repository.ts`: RPCs, estado y cantidades pendientes.
- `backend/src/services/cierre-calendario.service.ts`: listado con coincidencias/pendientes, protección de importados y avisos por socket reutilizados.
- `backend/src/services/agenda-impacto.service.ts`: impacto de regla persistida limitado al alcance administrativo.
- `backend/src/validators/cierre-calendario.validator.ts`: metadatos y extracción de campos de la regla.
- `backend/src/controllers/cierre-calendario.controller.ts`: estado y sincronización manual.
- `backend/src/routes/cierre-calendario.routes.ts`: endpoints y rol de sincronización.
- `frontend/src/types/cierre-calendario.types.ts`: metadatos, estado y resultados.
- `frontend/src/services/cierre-calendario.service.ts`: llamadas a SAPS, nunca a ArgentinaDatos.
- `frontend/src/pages/configuracion/CierresPage.tsx`: origen, pendientes, agrupación de coincidencias y acceso al panel.
- `frontend/src/components/turnos/AgendaImpactPanel.tsx`: modo de cierre ya persistido.
- `docs/feriados-cierres-institucionales.md`: referencia a esta continuación.

Se preservaron los cambios anteriores no confirmados. No se modificaron `.env`, dependencias, dashboard ni tests. No se realizaron operaciones de commit, push, pull, stash ni descarte.

## 24. Compilación

| Comprobación autorizada | Resultado |
| --- | --- |
| Backend: `npm.cmd run typecheck` | Correcto |
| Backend: `npm.cmd run build` | Correcto |
| Frontend: `npm.cmd run build` | Correcto |

La compilación del frontend inicialmente encontró una restricción del entorno (`spawn EPERM`); al repetirla con el permiso correspondiente finalizó correctamente. No se ejecutaron tests ni pruebas funcionales. Estos resultados no verifican la ejecución de la migración SQL ni una sincronización real: ambas quedan pendientes de la aplicación y revisión manual del equipo.

## 25. Pruebas manuales para el equipo — no realizadas

1. Aplicar las migraciones en orden y verificar arranque con una ejecución pendiente; comprobar que la cola de notificaciones sigue procesándose.
2. Sincronizar manualmente dos veces: la segunda debe informar sin cambios y no duplicar feriados ni auditoría de filas inalteradas.
3. Verificar que se consulta el año actual argentino y el siguiente; probar un siguiente año no publicado sin perder datos del actual.
4. Revisar timeout, red, error HTTP, JSON inválido, respuesta vacía, otro año y tipo desconocido: conservar lo existente y mostrar resultado comprensible.
5. Comprobar sábado 03:00 argentino y recuperación tras haber estado apagado. Revisar dos instancias simultáneas, dos pulsaciones manuales y recuperación después de interrumpir una ejecución.
6. Cambiar nombre/tipo de una fecha en una fuente controlada de desarrollo: actualizar solo su fila importada. Retirar una fecha de la respuesta: conservarla e informar su ausencia. No efectuar esta comprobación alterando datos reales del proveedor.
7. Crear un feriado manual antes de que lo incluya la fuente: preservar el manual, mostrar la coincidencia agrupada y una sola etiqueta al paciente; comprobar edición/desactivación manual sin desactivar el importado.
8. Registrar asuetos, recesos por rango, cierres locales y franjas parciales; sincronizar y verificar que no fueron modificados.
9. Incorporar un nuevo feriado con turnos existentes: bloquear nuevas reservas de inmediato, conservar los turnos y mostrar pendientes por alcance. Resolverlos desde el panel existente.
10. Abrir disponibilidad antes de sincronizar e intentar reservar después: rechazo al confirmar, incluso llamando directamente al endpoint.
11. ADMIN_SALITA: intentar sincronizar, editar un importado y reprogramar turnos de otra salita; deben rechazarse. Revisar únicamente afectados propios.
12. SUPER_ADMIN: reprogramar un afectado y comprobar avisos, historial y auditoría existentes, sin notificaciones duplicadas por la importación.
13. Intentar falsificar fecha/datos del importado en el endpoint de impacto/confirmación: debe exigir recargar la regla real.
14. Comprobar origen manual/automático, actor de auditoría, último intento y último éxito; verificar lectura pública sin metadatos administrativos.
15. Revisar UI móvil, modales, resultados por año y vuelta al listado; confirmar que un importado no ofrece el paso de guardar cierre y que un manual sí lo mantiene.
