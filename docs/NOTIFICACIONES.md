# Notificaciones administrativas

## Revisión de la implementación previa

- `notificacion.controller/service/repository/validator/routes` ya exponían la bandeja propia, lectura individual y lectura total. Se amplían; no se crea otra bandeja.
- `notificacion-turno.service` y su repository generan avisos automáticos y usan `email.service`. Se conserva ese flujo y el mismo transporte SMTP.
- `notificaciones` ya tenía `fecha_programada`, estados y canales separados, pero no había ejecutor de programaciones, cabecera de envío ni remitente.
- `NotificationBell` estaba restringida a pacientes y no tenía página de historial personal. Ahora aparece para todos los usuarios autenticados y se sincroniza con la página personal.
- Autenticación propia JWT, `requireRole`, `usuario_salita` y el alcance vigente existente se reutilizan. No se agregan roles ni relaciones entre personas, pacientes o profesionales.
- Se reutilizan Navbar, AppLayout, navegación móvil, Bootstrap, variables SAPS y ConfirmationModal. El historial usa tabla en escritorio y cards por debajo de 992 px.

## Instalación de base de datos

**Aplicar antes de iniciar la API actualizada**, sobre el esquema `SAPS_Turno_BBDD3_FINAL.sql`, en este orden:

1. `backend/src/BBDD/20261006_notificaciones_audiencia.sql`
2. `backend/src/BBDD/20261006_notificaciones_envios.sql`
3. `backend/src/BBDD/20261006_notificaciones_worker.sql`
4. `backend/src/BBDD/20261006_notificaciones_edicion.sql`
5. `backend/src/BBDD/20261006_notificaciones_excluir_remitente.sql`

Si las cuatro primeras ya están instaladas, ejecutar **solamente la quinta**. Esta actualización excluye al remitente de destinatarios, confirma la audiencia con ese filtro tanto al crear como al editar y solicita recargar el caché de PostgREST. La cuarta actualización es repetible, incorpora edición de pendientes y repone `notificacion_resumen_fallas`. No volver a crear las tablas. El backend también puede consultar las fallas directamente si esa función todavía no aparece en el caché (`PGRST202`). La respuesta de creación confirma el guardado sin consultar después el resumen de fallas.

Cada archivo tiene su propia transacción. Las primeras tres son migraciones de una sola aplicación; no volver a ejecutarlas si ya finalizaron. La cuarta y quinta actualizaciones son repetibles. No recrear la base existente. Estas migraciones se entregan como archivos: no fueron ejecutadas contra la base remota durante esta implementación.

La única tabla nueva, `notificacion_envios`, guarda la cabecera, audiencia y remitente histórico. Cada entrega, tanto SISTEMA como EMAIL, se guarda en `notificaciones`. La bandeja devuelve solamente SISTEMA/ENVIADA. Una vista calcula el progreso de cada envío. Las funciones y vistas son exclusivas de `service_role`; no están expuestas al navegador. La cabecera reutiliza `auditar_cambios` con contexto de usuario y salita dentro de la transacción.

## Alcance y destinatarios

- SUPER_ADMIN: usuarios globales, por rol, administradores, pacientes o profesionales; filtros combinables de salita, especialidad y usuario específico.
- ADMIN_SALITA: debe elegir una de sus salitas vigentes. Puede seleccionar grupos o usuarios individuales dentro de esa salita; no incluye SUPER_ADMIN ni permite alcance global. El grupo general incluye pacientes, profesionales, administración y recepción con relación vigente.
- Pacientes: `usuarios.id_persona → pacientes.id_persona`, perfil activo e `id_salita_asignada`.
- Profesionales: persona, perfil activo, `profesional_salita` y `profesional_especialidad` activas y vigentes. No se infiere la salita por turnos históricos.
- Administrativos: `usuario_salita` activa y vigente. Usuarios, personas vinculadas y roles deben estar activos.
- Se confirma una huella de los destinatarios: si cambian entre el modal y la creación, se pide revisar nuevamente. La audiencia se congela al crear; no se añaden nuevas altas a envíos ya programados.
- El remitente se excluye de la vista previa y de las entregas administrativas, incluso al editar una programación.
- Antes de cada entrega se vuelve a validar el remitente y la pertenencia del destinatario. Una baja, cambio de rol o pérdida de alcance cancela esa entrega.
- Las consultas masivas se resuelven en PostgreSQL sin el límite de filas de la API de Supabase. La búsqueda individual devuelve hasta 20 coincidencias y requiere al menos 2 caracteres.

## Procesamiento y errores

`server.ts` inicia el procesador de la API. Consulta pendientes cada 15 segundos cuando no hay trabajo y continúa por lotes de 50 cuando hay cola. La API debe permanecer ejecutándose; si está apagada, las programaciones vencidas se retoman al arrancar. No hay temporizadores de programación en el navegador.

Cada entrega se reclama con bloqueo PostgreSQL y token exclusivo. Varias instancias pueden compartir la cola. SISTEMA y EMAIL tienen estados independientes, de modo que un correo fallido no borra una entrega interna. La clave de operación evita duplicar un envío al reintentar la misma solicitud.

Si el proceso se interrumpe, las entregas SISTEMA pueden recuperarse luego de 10 minutos. Un EMAIL con procesamiento interrumpido se marca FALLIDA al vencer ese plazo; **no se reenvía automáticamente**, ya que SMTP podría haberlo aceptado antes del corte. No puede garantizarse entrega exactamente una vez con SMTP. Un correo ENVIADO significa aceptado por SMTP, no leído ni recibido definitivamente por el destinatario. Las fallas y cancelaciones se resumen en el detalle.

Solo puede editarse o cancelarse una programación futura que no comenzó. Edición, cancelación y reclamo se coordinan por bloqueo de cabecera. La edición permite cambiar audiencia, contenido, canales y fecha/hora, conserva al remitente y audita al editor. Si otra persona cambió el contenido mientras el formulario estaba abierto, se rechaza el guardado y se solicita recargar. La cancelación conserva el historial e impide las entregas; no borra físicamente el envío.

Luego de crear correctamente un envío, el formulario se vacía y muestra un enlace al detalle. Si la solicitud falla, se conservan los campos y la clave del intento. Los errores 500 anteriores causados por consultar el resumen podían ocurrir **después del guardado**: revisar el historial antes de volver a crear esos avisos.

Asunto: 3–160 caracteres, conforme al campo existente. Mensaje: 3–2000. Se validan texto español y puntuación común en frontend/backend; se rechazan HTML, emojis y controles (se permite salto de línea en mensaje). El email escapa el contenido antes de generar HTML. Fecha y hora usan Argentina (UTC−3) explícitamente.

## Pantallas y API

- `/notificaciones/nueva`: redacción y confirmación.
- `/notificaciones`: historial paginado, más reciente primero.
- `/notificaciones/programadas`: pendientes programadas, próxima fecha primero.
- `/notificaciones/:id`: detalle, progreso, fallas y cancelación.
- `/notificaciones/:id/editar`: edición de una programación futura con confirmación.
- `/mis-notificaciones`: bandeja personal para todos los roles, incluso pacientes que todavía no completaron su perfil.
- La campana muestra hasta tres notificaciones recientes; la bandeja personal y el historial administrativo muestran cinco elementos por página.

Los endpoints administrativos viven bajo `/api/notificaciones/administrativas`: GET `/opciones`, POST `/destinatarios`, POST `/preview`, POST `/`, GET `/`, GET `/:id`, PATCH `/:id` y PATCH `/:id/cancelar`. Todos requieren sesión y rol SUPER_ADMIN/ADMIN_SALITA. Se mantienen los endpoints personales anteriores.

## Pruebas manuales sugeridas

1. Aplicar las migraciones en el orden indicado e iniciar la API y frontend.
2. Enviar un aviso individual con SISTEMA; comprobar remitente, mensaje completo y badge. Leer desde la bandeja y comprobar la campana.
3. Crear un envío masivo con ambos canales; contrastar cantidad, destinatarios y resumen del modal. Confirmar que cada usuario recibe una única notificación interna.
4. Con SUPER_ADMIN recorrer usuarios, roles, administradores, pacientes, profesionales, salita y especialidad combinadas. Buscar por cada campo admitido.
5. Con ADMIN_SALITA probar grupos e individuales de sus salitas. Modificar manualmente la solicitud con otra salita, otro usuario o rol SUPER_ADMIN: debe rechazarse o resolver cero destinatarios, sin enviar.
6. Con PACIENTE, PROFESIONAL y RECEPCION intentar crear, listar y cancelar envíos administrativos: debe responder 403. La bandeja propia debe seguir disponible.
7. Programar unos minutos adelante: no debe aparecer antes en la campana ni enviarse email. Reiniciar la API y comprobar que la programación se conserva.
8. Cancelar una programación y verificar que no se entrega. Una cancelación luego de comenzar debe responder 409.
9. Cambiar la asignación o desactivar remitente/destinatario antes del horario programado: comprobar las entregas canceladas y su motivo.
10. Simular error SMTP en un entorno de prueba: conservar las entregas internas y mostrar fallas en el detalle. No usar datos reales para esta prueba.
11. Probar asunto largo, emojis, HTML, controles y fecha pasada; comprobar rechazo. Comprobar tildes, ñ, signos y saltos de línea válidos.
12. Revisar creación, historial, modal y campana a 320, 375, 425, 768, 1024 y 1440 px; no debe haber scroll horizontal.
13. Crear, reprogramar y cancelar un turno: verificar que siguen llegando los avisos automáticos previos.
14. Crear un aviso y comprobar que se vacían destinatario, asunto, mensaje y horario, manteniendo el aviso de éxito y el enlace al detalle. Un error debe conservar los campos.
15. Editar una programación desde la lista: cambiar texto, audiencia, canales y fecha/hora. Confirmar que solo se entrega la versión actualizada. Intentar guardar una versión vieja desde otra pestaña: debe responder 409.
16. Cancelar desde Programadas y comprobar que desaparece de pendientes y permanece CANCELADA en el historial. Intentar editar o cancelar después del horario: debe responder 409.

No se añadieron tests automáticos. Verificación de compilación solicitada: `npm run typecheck` en backend y `npm run build` en frontend. En PowerShell con scripts deshabilitados puede usarse `npm.cmd`.
