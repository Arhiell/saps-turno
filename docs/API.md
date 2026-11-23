# 🌐 Contrato HTTP e integración

[Índice](README.md) · [Todas las rutas declaradas](API_RUTAS.md) · [Seguridad](SEGURIDAD_Y_ACCESO.md)

## Convenciones

La API monta sus módulos bajo `/api`. Las solicitudes con cuerpo utilizan JSON salvo que el endpoint indique otra representación. Las descargas de reportes tienen contenido binario o de impresión y no deben procesarse como JSON.

Para rutas protegidas enviar `Authorization: Bearer <access_token>`. Cada operación puede requerir además rol, perfil completo, verificación y alcance sobre el recurso. Los IDs suelen validarse como UUID; no son credenciales.

No existe un único formato de respuesta exitosa para todos los módulos. Consultar el controller correspondiente antes de implementar un cliente. El [inventario de rutas](API_RUTAS.md) conserva el método, ruta local y cadena declarada de handlers; combinarla con los montajes, incluyendo los anidados.

## Salud

`GET /api/health` confirma que responde la API y devuelve `success`, `message` y `timestamp`. No verifica por sí mismo PostgreSQL. `GET /api/health/database` ejecuta la comprobación de conexión y devuelve el resultado en `data`.

Ejemplo de consulta local en PowerShell:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/api/health'
```

## Sesión

Las rutas `/auth/login`, `/auth/refresh`, `/auth/logout` y `/auth/register` usan POST. `/auth/me` consulta el perfil con el middleware destinado a perfil. `/auth/profile` diferencia completar mediante POST y actualizar mediante PATCH. Las rutas `/auth/username` y `/auth/password` actualizan credenciales con PATCH.

La renovación rota la sesión. El cliente debe conservar el par nuevo y dejar de utilizar el token anterior. El frontend implementa un reintento tras 401; no repetir indefinidamente una solicitud que sigue siendo rechazada. Los cuerpos completos de autenticación y sus flujos están en [AUTENTICACION.md](AUTENTICACION.md) y en los validadores.

## Crear un turno

`POST /api/turnos` recibe los campos del [validador de turno](../backend/src/validators/turno.validator.ts):

| Campo | Contrato |
| --- | --- |
| `id_paciente` | UUID; el flujo PACIENTE puede omitirlo para resolver su propio perfil |
| `id_profesional` | UUID requerido |
| `id_especialidad` | UUID requerido |
| `id_salita` | UUID requerido |
| `id_horario` | UUID opcional; no confundir omisión con permiso universal de reserva manual |
| `fecha_hora_inicio` | ISO con zona, precisión de segundos |
| `motivo_consulta` | Opcional/nulo; texto no vacío, máximo 2000 caracteres |
| `observaciones` | Opcional/nulo; máximo 4000; no admitido en el flujo de creación del paciente |

El objeto es estricto. El cliente no decide `fecha_hora_fin`, duración ni estado. Omitir `id_paciente` no habilita reservar para terceros: una identidad distinta requiere autorización delegada válida.

Ejemplo estructural con identificadores ficticios; la fecha debe reemplazarse por un bloque realmente habilitado:

```json
{
  "id_profesional": "11111111-1111-4111-8111-111111111111",
  "id_especialidad": "22222222-2222-4222-8222-222222222222",
  "id_salita": "33333333-3333-4333-8333-333333333333",
  "id_horario": "44444444-4444-4444-8444-444444444444",
  "fecha_hora_inicio": "2026-11-10T09:00:00-03:00",
  "motivo_consulta": "Consulta programada"
}
```

La creación exitosa devuelve HTTP 201 con `{ "success": true, "message": "Turno creado", "data": { "turno": ... } }`. Un bloque mostrado previamente puede haber dejado de estar libre. No reintentar escrituras a ciegas ante una desconexión: comprobar primero si la operación quedó registrada.

## Cambios con impacto

Los endpoints de reprogramación separan impacto, propuesta, disponibilidad y confirmación. La propuesta no retiene el bloque. La versión permite detectar cambios posteriores a la consulta; la confirmación puede devolver resultados parciales por turno. El contrato detallado está en [reprogramación asistida](agenda-reprogramacion-asistida.md).

Para bloqueos y cierres manuales, resolver los turnos afectados antes de guardar. La importación institucional tiene la política específica descrita en [concurrencia](CONCURRENCIA_AGENDA.md).

## Errores

| HTTP | Interpretación general |
| --- | --- |
| 400 | Entrada inválida, relación inexistente o regla de datos |
| 401 | Autenticación ausente, inválida o vencida |
| 403 | Actor sin permiso, alcance o requisito de acceso |
| 404 | Ruta o recurso no encontrado, según operación |
| 409 | Conflicto de duplicación, agenda o versión según módulo |
| 500 | Error no contemplado por el manejador |

`AppError` produce `success: false`, `message` y, si existen, `code` y `data`. Los errores Zod usan HTTP 400 y una lista `errors` con `field` y `message`:

```json
{
  "success": false,
  "message": "Error de validación",
  "errors": [{ "field": "id_salita", "message": "Mensaje del validador" }]
}
```

El middleware traduce FK `23503` y CHECK `23514` a 400, y exclusión `23P01` a 409. Los servicios de agenda pueden traducir antes errores específicos a códigos de aplicación. No basar toda la lógica del cliente en comparar textos humanos.

## Localización de contratos completos

| Área | Documento y fuente |
| --- | --- |
| Pacientes y representación | [Autogestión](PACIENTE_AUTOGESTION.md), [vinculaciones](personas-a-cargo.md) |
| Comunicaciones | [Notificaciones](NOTIFICACIONES.md) |
| Cierres y sincronización | [Cierres](feriados-cierres-institucionales.md), [importación](argentinadatos-calendario.md) |
| Publicaciones | [Contenido público](CONTENIDO_PUBLICO.md) |
| Reportes | [Reportes y auditoría](REPORTES_Y_AUDITORIA.md) |
| Campos y límites de entrada | [Validadores](../backend/src/validators) |
| Formato de salida | [Controllers](../backend/src/controllers) y tipos del cliente |

No se presenta este catálogo como una especificación OpenAPI ejecutable. Antes de añadir un consumidor externo, fijar y verificar los contratos concretos que utilizará.
