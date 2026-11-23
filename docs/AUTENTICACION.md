# Autenticación SAPS Turno

## Configuración local

- Frontend: `VITE_API_URL` (por defecto `http://localhost:3000/api`) y `VITE_GOOGLE_CLIENT_ID` en `frontend/.env.local`.
- Backend: conservar las variables JWT, Supabase, Google y SMTP existentes. `FRONTEND_URL` define el destino de los enlaces de correo y vale `http://localhost:5173` por defecto.
- El Client ID de Google debe coincidir en ambos lados. El origen del frontend debe estar autorizado en la consola de Google. Referencia: [Google Identity Services](https://developers.google.com/identity/gsi/web/guides/display-button).
- Los archivos `.env` están excluidos del repositorio. No agregar credenciales reales a este documento ni a código fuente.

## Flujos implementados

- `/login`: login normal para los roles del sistema, mostrando errores de la API y evitando envíos repetidos.
- `/registro`: crea exclusivamente una cuenta PACIENTE. El backend genera el nombre de usuario y envía la verificación. Después de verificar el correo, el paciente inicia sesión y completa su perfil.
- Google reutiliza `/api/auth/google`: crea pacientes nuevos o inicia sesión en una identidad existente. Para vincular una cuenta local preexistente se exige que sea PACIENTE, esté activa y tenga correo verificado.
- `/completar-perfil`: usa la identidad autenticada y su correo, sin aceptar un usuario ni un email elegidos por el cliente. Rechaza DNI o email asociados a otra persona. La vinculación de una ficha preexistente requiere intervención administrativa; no se duplica ni se reclama automáticamente por DNI.
- `/recuperar-contrasena` y `/restablecer-contrasena?token=…`: reutilizan la recuperación existente y el envío SMTP. La solicitud devuelve un mensaje genérico y no devuelve el token al cliente.
- `/verificar-email?token=…`: confirma el correo. Sin token permite solicitar otro enlace.
- `/administracion`: SUPER_ADMIN crea administradores; SUPER_ADMIN y ADMIN_SALITA crean cuentas para profesionales ya registrados y autorizados. Las cuentas se vinculan a `usuarios.id_persona`.

## Acceso

| Rol | Destino y alcance |
| --- | --- |
| SUPER_ADMIN | Dashboard administrativo existente y módulos administrativos. |
| ADMIN_SALITA | Dashboard existente. Pacientes, profesionales, turnos, agenda y reportes restringidos a sus salitas en los endpoints modificados. |
| PROFESIONAL | `/mi-agenda` y `/mis-pacientes`. Turnos propios, estados ATENDIDO/NO_ASISTIO y agenda diaria PDF. |
| PACIENTE | Completar perfil si falta; luego `/mis-turnos` y `/mi-perfil`. |

El paciente puede solicitar y cancelar sus propios turnos desde la aplicación; también puede gestionar los turnos de otra persona cuando exista una vinculación aprobada y vigente con permiso para hacerlo. La reprogramación continúa siendo una operación administrativa. El backend vuelve a validar titularidad, delegación, cobertura y reglas de agenda; la interfaz no sustituye esos controles.

El menú comparte AppLayout, Sidebar y Navbar. ProtectedRoute controla los roles; el backend verifica además la identidad y el alcance de los datos. No se alteró el mecanismo de almacenamiento de tokens. Las renovaciones concurrentes del frontend comparten una petición.

## Comprobación manual

1. Ejecutar `npm run dev` en backend y frontend en terminales separadas.
2. Abrir Login y Registro en escritorio, tablet y celular. Revisar teclado, foco, mostrar/ocultar contraseña y ausencia de desplazamiento horizontal.
3. Ingresar manualmente con cada rol. Confirmar el destino, el menú y el rechazo al abrir una ruta administrativa con PACIENTE o PROFESIONAL.
4. Con dos administradores de salitas distintas, comprobar listados y consultas directas por ID de pacientes, profesionales, turnos y reportes.
5. Con un profesional vinculado, consultar agenda, marcar atención/inasistencia y descargar PDF. Cambiar el filtro o ID no debe devolver turnos de otro profesional.
6. Registrar un paciente con un correo propio, verificar el enlace, completar el perfil y volver a ingresar. Probar email y DNI repetidos.
7. Ingresar con Google nuevo y existente. Revisar el paso de completar perfil y que nunca se creen cuentas administrativas.
8. Solicitar recuperación con correo registrado y no registrado: mismo mensaje público. Probar token inválido, vencido y utilizado; cambiar contraseña e ingresar de nuevo.

El envío real de correos y la autorización de Google requieren comprobación con las cuentas y proveedores configurados. No se crearon cuentas reales para probarlos automáticamente.

## Perfil administrativo obligatorio

Antes de desplegar este cambio, ejecutar en Supabase
`backend/src/BBDD/20261011_admin_profile.sql`. Agrega solamente la RPC
`completar_perfil_administrativo`, con ejecución restringida a `service_role`.
No agrega columnas ni modifica el SQL histórico. La migración se entrega preparada;
no fue aplicada desde esta sesión.

- SUPER_ADMIN puede crear SUPER_ADMIN o ADMIN_SALITA mediante `POST /api/users/admins`.
  `rol` admite sólo esos códigos; si se omite conserva ADMIN_SALITA para clientes existentes.
  ADMIN_SALITA exige una salita activa; SUPER_ADMIN rechaza `id_salita` y no crea asociación.
- El alta conserva `id_persona = NULL` y correo sin verificar. Reutiliza el código de email actual.
- `GET /api/auth/me` devuelve `user.id_persona`, `user.email_verificado`,
  `user.perfil_completo` y `person`, sin credenciales. El estado administrativo se deriva del vínculo.
- React obliga a ambos roles administrativos a pasar por `/completar-perfil`.
  La API rechaza sus operaciones protegidas con 403 `PROFILE_INCOMPLETE` mientras falte persona.
  Se permiten consulta propia y `POST /api/auth/profile`; login, refresh, logout y verificación
  conservan sus rutas. Las páginas públicas continúan disponibles.
- Se reutiliza `createPersonSchema`: DNI, nombres y apellidos obligatorios;
  fecha, sexo, teléfono, domicilio y código postal opcionales. Localidad/provincia tienen
  los valores por defecto del modelo. No se trasladan requisitos clínicos de pacientes al administrador.
- El correo personal inicial procede de la cuenta verificada. No se agrega sincronización posterior.
- Un DNI existente requiere revisión administrativa, tenga o no cuenta/paciente/profesional.
  No se reclama una identidad sólo por conocer el DNI. La operación crea una persona nueva
  y su vínculo en una transacción, con bloqueo de usuario y auditoría existente.
- Tras guardar se actualiza el contexto y se vuelve a `/panel`. `/mi-perfil` permite consultar
  los datos; la edición administrativa posterior queda fuera de este cambio.
- La política de contraseñas sigue siendo 8–128 caracteres con mayúscula, minúscula,
  número y símbolo. Las altas internas y recuperación reutilizan el esquema de registro.

La consulta de diagnóstico del 11/10/2026 encontró 3 cuentas administrativas, todas sin
persona vinculada. No encontró perfiles administrativos vinculados parcialmente.
No se modificaron cuentas durante esa revisión.

### Comprobación funcional manual pendiente

1. Aplicar la RPC antes de iniciar sesión con las cuentas administrativas existentes.
2. Completar perfil del SUPER_ADMIN inicial; verificar una sola persona y su `usuarios.id_persona`.
3. Crear ambos tipos administrativos. Comprobar correo sin verificar y relación con salita
   exclusivamente para ADMIN_SALITA, principal y activa, con `fecha_desde` predeterminada.
4. Verificar correo, ingresar, recargar y escribir `/panel` u otra URL protegida directamente:
   debe exigir perfil. Una petición directa a la API también debe recibir 403.
5. Completar perfil y comprobar mensaje, nombre visible y consulta de `/mi-perfil` sin relogin.
6. Repetir el POST y enviar dos solicitudes simultáneas: no debe crear otra persona.
   Probar un DNI vinculado a otra cuenta y uno preexistente sin cuenta: ambos se rechazan claramente.
7. Comprobar en una base de prueba que un fallo al actualizar el vínculo revierte también
   la inserción de persona. La RPC no utiliza compensaciones ni borrados posteriores.
8. Intentar crear SUPER_ADMIN desde ADMIN_SALITA: 403. Enviar otro rol o una salita
   para SUPER_ADMIN: 400. Probar una salita inexistente/inactiva: rechazo.
9. Confirmar login, refresh, logout y flujos de pacientes/profesionales existentes.
10. Revisar formulario a 320, 375, 425, 768, 1024 y 1440 px, sin desplazamiento horizontal.

No se crearon tests automáticos; estas pruebas funcionales quedan a cargo del equipo.
