# Turnos y validación de agenda

## Resultado de esta etapa

Implementación local, sin operaciones Git de escritura ni cambios de SQL, dependencias o credenciales.
Se conserva el merge pendiente y los cambios de la etapa anterior.

- `npm.cmd run typecheck`: OK.
- `npm.cmd run build`: OK.
- `npm.cmd test`: 48 pruebas OK, incluyendo 21 nuevas de Turnos.
- API local: inicia; los tres endpoints de salud devuelven 200.
- Supabase real: 13 requests HTTP verificados, sin escrituras; detalle en `turno-live-results.json`.
- Los bloqueos existentes se consultaron en Supabase real: día completo detectado, parcial detectado,
  intervalo contiguo libre. No se modificaron los bloqueos.
- Reservas, cancelaciones y reprogramaciones con escritura real: pendientes de datos habilitados.
  El único profesional de desarrollo y sus relaciones profesional-salita y profesional-especialidad
  están inactivos. Se solicitó decidir entre reactivación temporal, otros datos o pruebas simuladas.
  No se realizó la reactivación.

## Endpoints

| Método | Ruta | Función |
|---|---|---|
| POST | `/api/turnos` | Reserva con estado inicial SOLICITADO |
| GET | `/api/turnos` | Listado paginado con joins |
| GET | `/api/turnos/:id` | Detalle |
| PATCH | `/api/turnos/:id` | Reprogramación o modificación de motivo/observaciones |
| PATCH | `/api/turnos/:id/status` | Cambio de estado y cancelación lógica |

Roles administrativos existentes: SUPER_ADMIN, ADMIN_SALITA, RECEPCION.
SUPER_ADMIN es global; los otros dos se restringen a sus asignaciones activas y vigentes
en `usuario_salita`, tanto al leer como al escribir. PACIENTE y PROFESIONAL reciben 403.
No se incorporó autoservicio ni otro sistema de autorización.

### Alta

```json
{
  "id_paciente": "UUID",
  "id_profesional": "UUID",
  "id_especialidad": "UUID",
  "id_salita": "UUID",
  "fecha_hora_inicio": "2026-10-19T11:00:00-03:00",
  "motivo_consulta": "Control",
  "observaciones": "Observación opcional"
}
```

`id_horario` es opcional: si se envía, debe corresponder a los otros campos; si se omite,
se busca un horario activo, vigente y compatible. El backend calcula `fecha_hora_fin`
desde `duracion_turno_minutos`, genera `codigo_turno` y usa `req.user` como creador.
No se aceptan `estado`, duración, fin, versión, indicadores de agenda o creador desde el cliente.
Los instantes deben llevar zona horaria y precisión de segundos; no se aceptan fechas locales ambiguas.

### Lectura y modificación

Filtros: `fecha` (día argentino), `id_profesional`, `id_paciente`, `id_salita`, `estado`,
`page` (1 por defecto) y `limit` (20 por defecto, máximo 100).

La respuesta devuelve `data.turnos` y `data.pagination`; detalle y escrituras devuelven `data.turno`.
Incluye estado, paciente/persona, profesional/persona, salita y especialidad, sin credenciales.
Se usaron joins de `turnos` porque `vw_agenda_turnos` no expone los identificadores necesarios
para todos los filtros, alcance y edición ni la versión. No se creó otra vista.

PATCH permite modificar fecha de inicio, profesional, especialidad, salita, horario, motivo y observaciones.
No permite cambiar el paciente histórico. Si cambia agenda, se recalcula el fin y se valida todo de nuevo.
PATCH vacío devuelve 400. El `version` existente en PostgreSQL evita sobrescribir otra modificación.

Estados iniciales reales: SOLICITADO, CONFIRMADO, EN_ESPERA, ATENDIDO, NO_ASISTIO,
CANCELADO y REPROGRAMADO. El servicio consulta `estados_turno`, incluidos sus indicadores;
no inventa un catálogo distinto. `es_estado_final` impide reabrir o editar turnos terminados.
No existe una matriz detallada de transiciones en el SQL; no se agregó una arbitraria.
La reprogramación modifica el mismo registro y utiliza el historial existente.
No se creó un flujo de reemplazo con un segundo turno vinculado mediante `id_turno_origen`.

```json
{ "estado": "CANCELADO", "motivo_cancelacion": "Cancelación solicitada" }
```

La cancelación conserva fechas y relaciones. Registra `cancelado_por`, `fecha_cancelacion` y motivo;
el trigger sincroniza los indicadores para liberar la agenda. No hay endpoint DELETE de Turnos.
Los estados finales no disparan una revalidación de reserva que impediría cancelar un turno pasado.

## Validación y reutilización

- Reutiliza `getPatientById`, `getProfesionalById`, `getSalitaById`, `getEspecialidadById`,
  `getEspecialidadesByProfesional`, `getSalitasByProfesional` y `getHorarioById`.
- Horarios: agregó únicamente `findHorariosParaTurno` al repositorio existente.
- Bloqueos: agregó únicamente `findBloqueoParaTurno` al repositorio existente.
- Reutiliza `timeToSeconds`, `authenticate`, `requireRole`, `AppError` y el middleware global.
- Comprueba entidades activas, asociaciones vigentes, día ISO, vigencia inclusiva, franja,
  duración y alineación de bloques según el horario, fecha futura, bloqueos globales o específicos,
  superposición de profesional/paciente, turno abierto por especialidad, sanciones y cupo diario.
- Los intervalos contiguos no se solapan: inicio nuevo < fin existente y fin nuevo > inicio existente.
- Las comparaciones locales siguen `America/Argentina/Buenos_Aires`, igual que el trigger SQL.
- No se reimplementaron los CRUD de Horarios, Bloqueos ni un módulo separado de Disponibilidad.
- `turno-error.ts` transforma errores conocidos de triggers y exclusiones en AppError;
  FK, CHECK y errores inesperados siguen pasando por el middleware de Leo sin modificarlo.

## Pruebas

| Endpoint / operación | Caso | Resultado |
|---|---|---|
| Los tres health | API, BBDD, usuarios | 200 real |
| POST turnos | Sin JWT | 401 real |
| GET turnos | Lista y filtros | 200 real |
| GET por ID | UUID inválido / inexistente | 400 / 404 real |
| POST turnos | Paciente / profesional inexistente | 404 real |
| POST turnos | Fecha pasada | 400 real |
| PATCH turno | Body vacío | 400 real |
| PATCH status | Código con formato inválido | 400 real |
| POST turnos | Roles PACIENTE / PROFESIONAL | 403 HTTP, Supabase simulado |
| POST turnos | Reserva válida | 201 HTTP, Supabase simulado |
| GET por ID | Existente | 200 HTTP, Supabase simulado |
| POST turnos | Franja/día/vigencia/alineación inválidos | 400, pruebas aisladas y HTTP |
| POST turnos | Bloqueo / ocupación | 409, pruebas aisladas y HTTP |
| PATCH turno | Reprogramación válida / bloqueada | 200 / 409 HTTP, Supabase simulado |
| PATCH status | Cancelación, preservación de datos, estado final | pruebas aisladas OK |
| Repositorios de bloqueos | Día completo / parcial / contiguo | true / true / false en Supabase real |

También hay pruebas de cupo, sanción, alcance por salita, control de versión, errores de exclusión
recibidos después de una prevalidación exitosa y catálogo de estados. Las simulaciones no certifican
el despliegue efectivo de triggers o constraints en Supabase.

## Concurrencia y pendientes

El SQL local contiene exclusiones GiST `ex_turnos_profesional_solapados` y
`ex_turnos_paciente_solapados`, más `uq_turno_abierto_paciente_especialidad`.
Son la protección final contra doble reserva; la API traduce 23P01/23505 a 409.
`validar_turno()` bloquea el horario con FOR UPDATE antes de comprobar cupo.
Los updates usan `id_turno + version`, y el trigger incrementa la versión.

No se verificó todavía con escrituras simultáneas que estas restricciones estén desplegadas
en la base real; no hay acceso directo al catálogo SQL desde el cliente REST.

El SQL revisado no serializa la creación de un bloqueo con una reserva concurrente: ambos triggers
pueden consultar antes de ver la escritura de la otra transacción. Propuesta pendiente:
un bloqueo transaccional común por salita/día en ambos caminos, seguido de validación, mediante
funciones/triggers revisados por el equipo. No se aplicó una migración.

El trigger de historial toma `app.current_user_id` o, en su defecto, `creado_por`.
Las escrituras REST conservan el historial, pero no pueden establecer esa variable por transacción:
el autor de una modificación puede quedar atribuido al creador. Cancelaciones sí guardan el actor
real en `cancelado_por`. Para auditoría completa se propone una RPC transaccional con actor validado;
no se falsificó `creado_por` ni se añadió un historial paralelo.

No se implementaron sanciones automáticas ni reglas adicionales de cancelación: existe configuración
de antelación, pero no una política completa de transiciones/penalizaciones en esta etapa.

## Archivos de esta etapa

Nuevos en `src/`:

- `controllers/turno.controller.ts`, `turno-read.controller.ts`, `turno-update.controller.ts`.
- `repositories/turno.repository.ts`, `turno-read.repository.ts`, `turno-update.repository.ts`,
  `turno-agenda.repository.ts`, `turno-access.repository.ts`, `turno-select.ts`.
- `services/turno.service.ts`, `turno-read.service.ts`, `turno-update.service.ts`,
  `turno-agenda.service.ts`, `turno-entities.service.ts`, `turno-access.service.ts`.
- `validators/turno.validator.ts`, `turno-query.validator.ts`, `turno-update.validator.ts`.
- `routes/turno.routes.ts`, `types/turno.types.ts`, `utils/turno-error.ts`, `utils/turno-time.ts`.

Nuevos en `tests/`: `turno-fixtures.ts`, `turno-agenda.test.ts`, `turno-update.test.ts`,
`turno-http.test.ts`, `turno-live-support.mjs`, `turno-live.mjs`, `turno-live-results.json`, `TURNOS.md`.

Existentes modificados en esta etapa: `src/routes/index.ts` (montaje),
`src/repositories/horario-atencion.repository.ts` y `src/repositories/bloqueo-agenda.repository.ts`
(consultas específicas reutilizables). Se regeneró `dist/`, ignorado por Git.
Los otros cambios mostrados por Git corresponden a la integración anterior.

## Repetir verificaciones

```bash
npm run typecheck
npm run build
npm test
npm run dev
# En otra terminal: solo smoke de lectura y solicitudes inválidas.
node tests/turno-live.mjs --development
```

Ejemplos para Git Bash, reemplazando UUID y una fecha realmente disponible:

```bash
read -rs -p 'JWT: ' TOKEN; echo
curl -sS 'http://localhost:3000/api/turnos?page=1&limit=20' -H "Authorization: Bearer $TOKEN"
curl -sS 'http://localhost:3000/api/turnos/UUID' -H "Authorization: Bearer $TOKEN"
curl -sS -X POST 'http://localhost:3000/api/turnos' \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"id_paciente":"UUID","id_profesional":"UUID","id_especialidad":"UUID","id_salita":"UUID","fecha_hora_inicio":"2026-10-19T11:00:00-03:00"}'
curl -sS -X PATCH 'http://localhost:3000/api/turnos/UUID/status' \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"estado":"CANCELADO","motivo_cancelacion":"Prueba finalizada"}'
unset TOKEN
```

Las dos últimas llamadas escriben datos; no forman parte del smoke de lectura.
