# Autogestión del paciente

Se conserva React, React Router, Axios, Bootstrap, la navegación y la identidad SAPS.
La API existente incorpora autogestión; los endpoints administrativos conservan su alcance.

## Preparación

Antes de ejecutar esta versión, aplicar en la base de Supabase:

`backend/src/BBDD/20260929_patient_email_change.sql`

La migración no se ejecuta automáticamente desde Node. Agrega el correo pendiente a
`tokens_verificacion_email` y dos funciones reservadas a `service_role`: emisión y consumo
atómicos del código. Se necesita también para la verificación inicial por código, que
comparte el mismo mecanismo. El correo vigente permanece intacto hasta confirmar.
El código vence a los 10 minutos, permite 5 intentos y exige 60 segundos entre emisiones.
No modifica contraseñas ni identidades Google. El inicio mediante Google conserva su vínculo por `sub`.

Reiniciar el backend y el frontend después de aplicar la migración. Usar las variables
de entorno y la configuración SMTP ya existentes. No se agregaron dependencias.

## Comportamiento

- Acceso y seguridad: muestra el nombre de usuario y permite cambiarlo respetando su
  unicidad. El saludo muestra el usuario y debajo nombres y apellidos.
- Cambio de contraseña: exige contraseña actual y confirmación de la nueva en la interfaz;
  comparte las reglas de recuperación, limita intentos con el bloqueo de cuenta existente,
  invalida tokens de recuperación y revoca sesiones de renovación. Luego pide ingresar de nuevo.
  Los access tokens ya emitidos conservan su vencimiento habitual. Las cuentas sin contraseña
  local pueden establecerla desde la recuperación por correo existente.
  Estas funciones no requieren una migración adicional.

- Perfil: nombres, apellidos, teléfono, dirección, barrio, obra social, afiliado y contacto
  de emergencia editables. DNI, fecha de nacimiento, sexo y correo no se aceptan en ese PATCH.
- Cobertura: se leen barrios, zonas, salitas y `salita_barrios`. Al cambiar barrio se mantiene
  una asignación vigente; si dejó de ser válida y hay una sola salita activa se reasigna.
  Si hay cero o varias alternativas, se informa que debe intervenir administración y no
  se guarda ese cambio. Los turnos históricos no se trasladan.
- Reservas: profesionales de la salita asignada, relaciones activas y vigentes para la
  fecha, especialidades y horarios habilitados. La API vuelve a validar cobertura, agenda,
  cupos, bloqueos, sanciones y superposiciones al guardar.
- El paciente se resuelve en el servidor. El formulario de reserva no envía `id_paciente`.
- Cancelación: solo turnos propios, futuros y no finales; conserva el historial. La
  reprogramación sigue siendo administrativa y el paciente consulta sus cambios.
- Historial: paginado, fecha descendente, filtros de período y estado. El filtro de
  reprogramación consulta los eventos reales aunque el estado actual siga confirmado.
- Detalle: código, horario, motivo, profesional, especialidad, salita, dirección,
  cancelación e historial real. No se publican observaciones internas ni correos del personal.
- Notificaciones: campana con total pendiente, páginas, lectura individual y masiva.
  Incluye avisos administrativos ya almacenados, sin crear otro sistema de mensajería.

## Contratos utilizados

| Método y ruta (prefijo `/api`) | Alcance del paciente |
| --- | --- |
| `GET /auth/me` | Perfil propio |
| `PATCH /auth/profile` | Campos permitidos, sin IDs de otra persona o salita |
| `PATCH /auth/username` | `{ nombre_usuario }`, solo la cuenta autenticada |
| `PATCH /auth/password` | `{ currentPassword, newPassword }`, solo la cuenta autenticada |
| `POST /auth/email/change/request` | `{ email }` nuevo |
| `POST /auth/email/change/verify` | `{ email, code }`, código de 4 dígitos |
| `GET /profesionales?fecha=AAAA-MM-DD` | Proyección pública del equipo habilitado |
| `GET /disponibilidad` | Salita asignada y profesionales habilitados; solo horarios libres |
| `POST /turnos` | Reserva propia, sin `id_paciente` ni observaciones internas |
| `GET /turnos` | Solo propios; `periodo`, `estado`, `orden`, `reprogramados`, `page`, `limit` |
| `GET /turnos/:id` | Solo propio |
| `PATCH /turnos/:id/status` | Solo `CANCELADO` y propio |
| `GET /turnos/:id/historial` | Solo propio, sin datos del operador |
| `GET /notificaciones` | Solo destinatario autenticado |
| `PATCH /notificaciones/:id/leer` | Solo destinatario autenticado |
| `PATCH /notificaciones/leer-todas` | Solo destinatario autenticado |

## Prueba manual sugerida

No se crearon ni ejecutaron tests automáticos.

1. Entrar como PACIENTE con perfil completo; revisar Inicio, Mi perfil y los nombres de
   barrio, zona y salita. Revisar estados vacíos y desconexión de la API.
2. Editar contacto, afiliado y dirección. Volver a entrar y verificar persistencia.
3. Cambiar a un barrio cubierto por la salita actual, a uno con una única alternativa
   y a otro con varias o ninguna. Verificar aviso y que nunca se elija una salita arbitraria.
4. Solicitar un turno. Cambiar fecha/especialidad/profesional y comprobar que se limpian
   las selecciones dependientes. Intentar reservar un horario tomado desde otra sesión.
5. Consultar detalle, cancelar con motivo y revisar historial y notificación.
6. Reprogramar desde administración: revisar el nuevo horario, el evento y el filtro
   Reprogramados. Marcar Atendido o No asistió desde el rol habilitado y revisar el historial.
7. Marcar avisos individualmente y todos; probar más de 10 avisos y que el badge cuente
   todos los pendientes. Cerrar el panel con Escape y con click afuera.
8. Solicitar cambio de correo: verificar que el anterior siga vigente hasta confirmar;
   probar código incorrecto, vencido, reutilizado, límite de intentos y reenvío. Verificar
   que cuenta y persona reciban el nuevo correo y que login/registro normal sigan funcionando.
9. En 320, 375, 425, 768, 1024 y 1440 px, revisar perfil, formulario, lista, detalle y
   campana; comprobar navegación inferior, foco de teclado y ausencia de desbordamiento.
10. Desde una sesión de paciente, intentar IDs ajenos y campos no permitidos en la API;
    deben ser rechazados. Revisar también paneles de SUPER_ADMIN, ADMIN_SALITA y PROFESIONAL.
11. Cambiar el nombre de usuario; comprobar el perfil, navbar, saludo y siguiente login.
    Intentar un nombre duplicado y otro con caracteres inválidos.
12. Cambiar la contraseña: probar la actual incorrecta, nueva débil y confirmación distinta.
    Con datos válidos debe volver al login con un mensaje de éxito; la contraseña anterior
    debe fallar y la nueva debe permitir ingresar. Revisar también el acceso por recuperación
    en una cuenta que usa Google y no tiene contraseña local.

Compilación: `npm run build` en frontend y backend; `npm run typecheck` en backend.
En PowerShell con scripts deshabilitados se puede usar `npm.cmd`.
La migración no fue ejecutada contra la base. La validación visual queda para el entorno
del proyecto: esta sesión no dispone de navegador conectado.
