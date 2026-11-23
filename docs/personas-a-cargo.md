# Personas a cargo, tutores y responsables

## Modelo

Cada persona conserva su ficha y su perfil de paciente propios. La cuenta autenticada identifica a quien inicia la operación; `turnos.id_paciente` identifica a quien recibe la atención y `turnos.creado_por` identifica quién hizo la solicitud.

- Un menor puede tener una ficha de paciente sin cuenta propia. Una persona adulta con cuenta de paciente activa puede solicitar gestionar sus turnos.
- Una persona adulta puede solicitar que otra persona adulta con cuenta de paciente activa gestione sus turnos.
- El parentesco no concede permisos automáticamente. Ninguna solicitud activa permisos hasta que una administración la aprueba.
- El paciente atendido conserva su cobertura, salita, sanciones, turnos e historial. Los límites de turnos abiertos se aplican por paciente y especialidad.

## Trámite del paciente

En **Personas a cargo** se muestran las vinculaciones aprobadas que habilitan gestionar turnos, quién está autorizado sobre el perfil titular y el historial de las solicitudes. El paciente puede solicitar cualquiera de estos trámites:

1. Gestionar los turnos de otra persona, indicando su DNI y el vínculo declarado.
2. Delegar la gestión de sus propios turnos a una persona adulta, indicando su DNI y la autorización declarada.

La solicitud solo registra el pedido. Las personas involucradas deben presentar sus DNI y la documentación pertinente en la salita. Quien gestionará los turnos debe ser adulto, tener una ficha con teléfono registrado y una cuenta de paciente activa. Si la persona que recibirá atención todavía no está registrada, el personal debe crear su ficha de paciente antes de aprobar el vínculo. No se cargan documentos ni datos sanitarios desde el formulario.

## Administración

La bandeja **Solicitudes de vinculación** muestra solicitudes pendientes, aprobadas y rechazadas del alcance autorizado. Antes de aprobar, el personal debe confirmar presencialmente la identidad y documentación; si el paciente titular es adulto, debe constatar su consentimiento expreso, y si es menor, la representación de su padre, madre o tutor. El motivo es obligatorio al rechazar. La aprobación crea o renueva la relación y la solicitud en una única transacción de PostgreSQL. Las solicitudes pendientes, rechazadas y los vínculos revocados no habilitan operaciones.

Desde el detalle de paciente se pueden consultar los vínculos y revocar autorizaciones vigentes. Las altas y renovaciones solo se hacen desde una solicitud iniciada por una cuenta de paciente y aprobada por la salita tras confirmar por separado identidad, documentación y autorización expresa. El historial conserva cada alta, cambio y revocación. Las administraciones de salita quedan limitadas a las solicitudes, pacientes y vinculaciones de sus salitas; la API vuelve a comprobar ese alcance y no confía en identificadores enviados por el navegador.

Las relaciones vigentes se pueden renovar mediante una nueva solicitud y verificación; no se reactivan directamente desde una relación revocada. Para renovar, el solicitante vuelve a presentar la autorización.

## Turnos e historial

En **Solicitar turno** se elige al titular o a una persona con autorización vigente. La API verifica la relación y que cubra la fecha del turno, y vuelve a comprobar la cobertura y las restricciones para el paciente seleccionado. Disponibilidad, agenda, sanciones y límites se evalúan para esa persona, no para quien inició sesión.

**Mis turnos** permite consultar cada historial por separado con el selector de paciente. El detalle identifica quién solicitó el turno. La autorización se comprueba también al leer el turno, su historial y al cancelar; la reprogramación permanece a cargo del personal autorizado.

## API añadida

- `GET /patients/personas-a-cargo`: vínculos vigentes que puede gestionar la cuenta.
- `GET /patients/mis-responsables`: personas autorizadas sobre el perfil propio.
- `GET|POST /patients/solicitudes-vinculacion`: consulta y creación de solicitudes propias.
- `GET /tutor-requests`: bandeja de solicitudes en el alcance administrativo.
- `PATCH /tutor-requests/:requestId`: aprobación con confirmaciones obligatorias o rechazo con motivo.
- Se amplió `GET /patients/:patientId/tutors` con estado histórico, responsable y trazabilidad; `PATCH` edita datos no autorizantes y `PATCH .../end` revoca. Los `POST` directos de vínculos responden 403: altas y renovaciones requieren solicitud aprobada.

## Migración requerida

Antes de desplegar la API, ejecutar una vez [`20261031_solicitudes_vinculacion.sql`](../backend/src/BBDD/20261031_solicitudes_vinculacion.sql) en la base Supabase. Es aditiva: conserva los registros actuales, agrega metadatos de trazabilidad, las solicitudes, un historial de relaciones, restricciones contra ciclos y una función transaccional de aprobación. Habilita RLS sin políticas para las tablas nuevas; las consultas pasan exclusivamente por la API con la clave de servidor. La función de aprobación solo concede ejecución a `service_role`.

Las relaciones preexistentes reciben los indicadores de identidad, documentación y autorización en `FALSE` y, por eso, no habilitan acceso ni notificaciones hasta que una solicitud nueva se apruebe con las tres verificaciones. La migración no elimina esos registros.

La migración no se ejecutó en una base externa durante este cambio. Debe aplicarse y validarse primero en un entorno de prueba antes del despliegue; los nuevos endpoints requieren esas tablas y la función RPC.
