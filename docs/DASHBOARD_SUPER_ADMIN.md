# Dashboard general de SUPER_ADMIN

El dashboard reutiliza las tarjetas, paneles, iconos y grilla adaptable existentes. Los demás roles conservan sus indicadores y los próximos turnos siguen disponibles.

## Fuente y significado de los indicadores

`GET /api/reportes/dashboard` requiere autenticación y rol `SUPER_ADMIN`. La respuesta no se almacena en caché y contiene:

- Salitas, profesionales y pacientes: total, activos e inactivos según el campo `activo` de cada entidad. La habilitación de su cuenta y las asignaciones vigentes son condiciones diferentes y no alteran estos conteos.
- Administradores de salita y superadministradores: cuentas únicas por rol y campo `usuarios.activo`. Una cuenta asignada a varias salitas se cuenta una sola vez. Un bloqueo temporal de acceso no equivale a una baja de la cuenta.
- Turnos registrados hoy: filtrados por `fecha_solicitud`, aunque estén programados para otra fecha.
- Turnos programados para hoy: filtrados por `fecha_hora_inicio`, independientemente de cuándo se reservaron. Su desglose muestra el estado actual de esas citas; por ejemplo, cancelados no significa cancelaciones realizadas hoy para cualquier fecha.
- Pendientes de atención: suma de `SOLICITADO`, `CONFIRMADO` y `EN_ESPERA`. Los estados finales se muestran por separado.
- Actividad reciente: últimos ocho registros de auditoría, con acción, entidad y fecha. No incluye datos anteriores/nuevos, información clínica, direcciones IP ni credenciales. Depende de que la auditoría esté instalada y registrando operaciones en la base.

El día se calcula en `America/Argentina/Buenos_Aires`, desde medianoche inclusive hasta la siguiente medianoche exclusiva. Los turnos históricos siguen contando aunque sus entidades relacionadas estén actualmente inactivas.

Los indicadores se calculan con conteos exactos en PostgreSQL, sin descargar listados completos. No requieren nuevas tablas ni aplicar migraciones. Las consultas son independientes: una operación concurrente puede reflejarse entre dos conteos.

## Actualización y errores

El resumen carga al ingresar y mediante **Actualizar**, que también recarga los próximos turnos. La pantalla informa la última actualización y oculta los valores anteriores durante una carga o un error para evitar confundirlos con valores actuales. Si falla únicamente la auditoría, los indicadores siguen disponibles y se informa el fallo de actividad.

## Verificación

Desde `backend`: `node --import tsx --test tests/dashboard.test.ts` y `npm run typecheck`.

Desde `frontend`: `npm run build` y `npm run lint`.

La prueba automatizada utiliza Supabase simulado y HTTP real de Express; cubre permisos, conteos mayores que el límite habitual de los listados, estados, fechas, base vacía y errores. No valida la configuración de una base desplegada.

Para la revisión manual, ingresar con SUPER_ADMIN, contrastar las tarjetas con los listados de cada módulo y usar Actualizar después de un cambio. Crear una reserva para mañana permite comprobar que aumenta “Turnos registrados hoy” sin aumentar “Turnos programados para hoy”. Revisar también la distribución de las tarjetas en móvil.
