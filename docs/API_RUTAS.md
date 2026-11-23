# 🔌 Inventario de rutas HTTP

[Índice](README.md) · [Contrato HTTP](API.md)

Extraído de las declaraciones de routers. Las rutas de las tablas son locales al router, no URLs completas. Prefijar `/api` y el montaje correspondiente; el router administrativo de notificaciones agrega `/notificaciones/administrativas`. Los handlers muestran controles declarados, pero la autorización completa también depende de los servicios. No es una especificación OpenAPI ni un registro de llamadas ejecutadas.

## Montajes principales

```typescript
router.use('/chatbot', chatbotRoutes);
router.use('/public', publicContentRoutes);
router.use('/contenido', adminContentRoutes);
router.use('/configuracion', configuracionRoutes);
router.use('/health', healthRoutes);
router.use('/users', userRoutes);
router.use('/access-management', accessManagementRoutes);
router.use('/auth', authRoutes);
router.use('/auth/password', passwordRecoveryRoutes);
router.use('/auth/email', emailVerificationRoutes);
router.use('/auth/google', googleAuthRoutes);
router.use('/especialidades', especialidadRoutes);
router.use('/salitas', salitaRoutes);
router.use('/barrios', barrioRoutes);
router.use('/zonas', zonaRoutes);
router.use('/patients', patientRoutes);
router.use('/tutors', tutorRoutes);
router.use('/', patientTutorRoutes);
router.use('/salita-barrios', salitaBarrioRoutes);
router.use('/profesionales', profesionalRoutes);
router.use('/profesionales', profesionalEspecialidadRoutes);
router.use('/profesionales', profesionalSalitaRoutes);
router.use('/horarios-atencion', horarioAtencionRoutes);
router.use('/bloqueos-agenda', bloqueoAgendaRoutes);
router.use('/cierres-calendario', cierreCalendarioRoutes);
router.use('/disponibilidad', disponibilidadRoutes);
router.use('/turnos', turnoRoutes);
router.use('/', historialTurnoRoutes);
router.use('/sanciones', sancionRoutes);
router.use('/notificaciones', notificacionRoutes);
router.use('/auditoria', auditoriaRoutes);
router.use('/reportes', reporteRoutes);
```

Consultar los imports en [routes/index.ts](../backend/src/routes/index.ts) para resolver cada nombre de router.

## access-management.routes.ts

[Fuente](../backend/src/routes/access-management.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/accounts` | `async (req, res, next) => { try { const page = z.coerce .number() .int() .min(1) .default(1) .parse(req.query.page` |
| `router` | PATCH | `/accounts/:id/status` | `async (req, res, next) => { try { const id = z .string() .uuid() .parse(req.params.id` |
| `router` | PATCH | `/people/:id` | `async (req, res, next) => { try { const id = z .string() .uuid() .parse(req.params.id` |

Middleware o montajes compartidos:

```typescript
router.use(
  authenticate,
  requireRole('SUPER_ADMIN', 'ADMIN_SALITA')
);
```

## auditoria.routes.ts

[Fuente](../backend/src/routes/auditoria.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/` | `authenticate, requireRole( "SUPER_ADMIN", "ADMIN_SALITA", ), getAuditoriasController` |
| `router` | GET | `/:id` | `authenticate, requireRole( "SUPER_ADMIN", "ADMIN_SALITA", ), getAuditoriaByIdController` |

## auth.routes.ts

[Fuente](../backend/src/routes/auth.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | PATCH | `/username` | `authenticate, requireRole('PACIENTE', 'SUPER_ADMIN', 'ADMIN_SALITA', 'PROFESIONAL'), changeUsername` |
| `router` | PATCH | `/password` | `authenticate, requireRole('PACIENTE', 'SUPER_ADMIN', 'ADMIN_SALITA', 'PROFESIONAL'), changePassword` |
| `router` | GET | `/me` | `authenticateForProfile, ownProfile` |
| `router` | PATCH | `/profile` | `authenticate, requireRole('PACIENTE', 'SUPER_ADMIN', 'ADMIN_SALITA', 'PROFESIONAL'), updateOwnProfile` |
| `router` | POST | `/profile` | `authenticateForProfile, requireRole('PACIENTE', 'SUPER_ADMIN', 'ADMIN_SALITA'), completeProfile` |
| `router` | POST | `/register` | `register` |
| `router` | POST | `/login` | `login` |
| `router` | POST | `/refresh` | `refresh` |
| `router` | POST | `/logout` | `logout` |

## barrio.routes.ts

[Fuente](../backend/src/routes/barrio.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/` | `getAllBarrios` |
| `router` | GET | `/:id` | `getBarrioById` |
| `router` | POST | `/` | `authenticate, requireRole("SUPER_ADMIN"), createBarrio` |
| `router` | PUT | `/:id` | `authenticate, requireRole("SUPER_ADMIN"), updateBarrio` |
| `router` | DELETE | `/:id` | `authenticate, requireRole("SUPER_ADMIN"), deleteBarrio` |

## bloqueo-agenda.routes.ts

[Fuente](../backend/src/routes/bloqueo-agenda.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/` | `scheduleScope("bloqueos_agenda"), obtenerBloqueos` |
| `router` | GET | `/:id` | `scheduleScope("bloqueos_agenda"), obtenerBloqueo` |
| `router` | POST | `/` | `scheduleScope("bloqueos_agenda"), crearBloqueoController` |
| `router` | PUT | `/:id` | `scheduleScope("bloqueos_agenda"), actualizarBloqueoController` |
| `router` | DELETE | `/:id` | `scheduleScope("bloqueos_agenda"), eliminarBloqueoController` |

Middleware o montajes compartidos:

```typescript
router.use(authenticate);
router.use(requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"));
```

## chatbot.routes.ts

[Fuente](../backend/src/routes/chatbot.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | POST | `/` | `authenticate, requireRole(...CHATBOT_ROLES), chatbotController` |

Middleware o montajes compartidos:

```typescript
chatbotBodyParser.use(express.json({ limit: '8kb' }));
chatbotBodyParser.use(chatbotErrorHandler);
router.use(chatbotErrorHandler);
```

## cierre-calendario.routes.ts

[Fuente](../backend/src/routes/cierre-calendario.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/` | `listar` |
| `router` | GET | `/sincronizacion` | `estadoSync` |
| `router` | POST | `/sincronizacion` | `requireRole('SUPER_ADMIN'), sincronizar` |
| `router` | POST | `/` | `guardar` |
| `router` | PUT | `/:id` | `guardar` |
| `router` | DELETE | `/:id` | `desactivar` |

Middleware o montajes compartidos:

```typescript
router.use(
  authenticate,
  requireRole('SUPER_ADMIN', 'ADMIN_SALITA')
);
```

## configuracion.routes.ts

[Fuente](../backend/src/routes/configuracion.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/publica` | `publicConfiguracionesController` |
| `router` | GET | `/` | `authenticate, listConfiguracionesController` |
| `router` | GET | `/:clave` | `authenticate, getConfiguracionController` |
| `router` | POST | `/` | `authenticate, requireRole("SUPER_ADMIN", "ADMIN_SALITA"), createConfiguracionController` |
| `router` | PATCH | `/:id` | `authenticate, requireRole("SUPER_ADMIN", "ADMIN_SALITA"), updateConfiguracionController` |

Middleware o montajes compartidos:

```typescript
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store");
```

## disponibilidad.routes.ts

[Fuente](../backend/src/routes/disponibilidad.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/fechas` | `requireRole('PACIENTE'), obtenerFechasPaciente` |
| `router` | GET | `/` | `scheduleScope("disponibilidad"), obtenerDisponibilidadController` |

Middleware o montajes compartidos:

```typescript
router.use(authenticate, requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION", "PACIENTE"));
```

## email-verification.routes.ts

[Fuente](../backend/src/routes/email-verification.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | POST | `/change/request` | `authenticate, requireRole('PACIENTE', 'SUPER_ADMIN', 'ADMIN_SALITA', 'PROFESIONAL'), requestChange` |
| `router` | POST | `/change/verify` | `authenticate, requireRole('PACIENTE', 'SUPER_ADMIN', 'ADMIN_SALITA', 'PROFESIONAL'), confirmChange` |
| `router` | POST | `/request` | `requestVerification` |
| `router` | POST | `/verify` | `verifyEmail` |

## especialidad.routes.ts

[Fuente](../backend/src/routes/especialidad.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/` | `getAllEspecialidades` |
| `router` | GET | `/:id` | `getEspecialidadById` |
| `router` | POST | `/` | `authenticate, requireRole("SUPER_ADMIN"), createEspecialidad` |
| `router` | PUT | `/:id` | `authenticate, requireRole("SUPER_ADMIN"), updateEspecialidad` |
| `router` | DELETE | `/:id` | `authenticate, requireRole("SUPER_ADMIN"), deleteEspecialidad` |

## google-auth.routes.ts

[Fuente](../backend/src/routes/google-auth.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | POST | `/` | `googleLogin` |

## health.routes.ts

[Fuente](../backend/src/routes/health.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/` | `healthCheck` |
| `router` | GET | `/database` | `databaseHealthCheck` |

## historial-turno.routes.ts

[Fuente](../backend/src/routes/historial-turno.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/historial-turnos` | `authenticate, requireRole( "SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION", ), getHistorialGeneralController` |
| `router` | GET | `/turnos/:idTurno/historial` | `authenticate, requireRole( "PACIENTE", "PROFESIONAL", "SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION", ), getHistorialTurnoController` |

## horario-atencion.routes.ts

[Fuente](../backend/src/routes/horario-atencion.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/` | `scheduleScope("horarios_atencion"), obtenerHorarios` |
| `router` | GET | `/:id` | `scheduleScope("horarios_atencion"), obtenerHorario` |
| `router` | POST | `/` | `scheduleScope("horarios_atencion"), crearHorarioController` |
| `router` | PUT | `/:id` | `scheduleScope("horarios_atencion"), actualizarHorarioController` |
| `router` | DELETE | `/:id` | `scheduleScope("horarios_atencion"), eliminarHorarioController` |

Middleware o montajes compartidos:

```typescript
router.use(authenticate);
router.use(requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"));
```

## notificacion.routes.ts

[Fuente](../backend/src/routes/notificacion.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/` | `authenticate, getNotificacionesController` |
| `router` | PATCH | `/leer-todas` | `authenticate, leerTodasController` |
| `router` | GET | `/:id` | `authenticate, getNotificacionController` |
| `router` | PATCH | `/:id/leer` | `authenticate, leerNotificacionController` |

Middleware o montajes compartidos:

```typescript
router.use("/administrativas", administrativas);
```

## notificacion-admin.routes.ts

[Fuente](../backend/src/routes/notificacion-admin.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/opciones` | `controller.opcionesEnvioController` |
| `router` | POST | `/destinatarios` | `controller.buscarDestinatariosController` |
| `router` | POST | `/preview` | `controller.previewEnvioController` |
| `router` | GET | `/` | `controller.historialEnviosController` |
| `router` | POST | `/` | `controller.crearEnvioController` |
| `router` | GET | `/:id` | `controller.detalleEnvioController` |
| `router` | PATCH | `/:id` | `controller.editarEnvioController` |
| `router` | PATCH | `/:id/cancelar` | `controller.cancelarEnvioController` |

Middleware o montajes compartidos:

```typescript
router.use(
  authenticate,
  requireRole(
    'SUPER_ADMIN',
    'ADMIN_SALITA'
  )
);
```

## password-recovery.routes.ts

[Fuente](../backend/src/routes/password-recovery.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | POST | `/forgot` | `forgotPassword` |
| `router` | POST | `/reset` | `resetUserPassword` |

## patient.routes.ts

[Fuente](../backend/src/routes/patient.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | PATCH | `/:id/account` | `requireRole('SUPER_ADMIN', 'ADMIN_SALITA'), async (req, res) => { const id = z.string().uuid().parse(req.params.id` |
| `router` | GET | `/personas-a-cargo` | `requireRole('PACIENTE'), async (req, res) => { res.json({ data: await getManagedPatients(req.user!) }` |
| `router` | GET | `/solicitudes-vinculacion` | `requireRole('PACIENTE'), listOwnTutorRequestsController` |
| `router` | POST | `/solicitudes-vinculacion` | `requireRole('PACIENTE'), createTutorRequestController` |
| `router` | GET | `/mis-responsables` | `requireRole('PACIENTE'), async (req, res, next) => { try { const patient = await getOwnPatient(req.user!` |
| `router` | GET | `/` | `requireRole( "SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION" ), patientScope, listPatientsController` |
| `router` | GET | `/dni/:dni` | `requireRole( "SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION" ), patientScope, getPatientByDniController` |
| `router` | PATCH | `/:id/status` | `requireRole( "SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION" ), patientScope, updatePatientStatusController` |
| `router` | GET | `/:id` | `requireRole( "SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION" ), patientScope, getPatientController` |
| `router` | PATCH | `/:id` | `requireRole( "SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION" ), patientScope, updatePatientController` |
| `router` | POST | `/` | `requireRole( "SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION" ), patientScope, createPatientController` |

Middleware o montajes compartidos:

```typescript
router.use(authenticate);
```

## patient-tutor.routes.ts

[Fuente](../backend/src/routes/patient-tutor.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/tutor-requests` | `authenticate, requireRole('SUPER_ADMIN', 'ADMIN_SALITA'), listAdminTutorRequestsController` |
| `router` | PATCH | `/tutor-requests/:requestId` | `authenticate, requireRole('SUPER_ADMIN', 'ADMIN_SALITA'), resolveTutorRequestController` |
| `router` | POST | `/patients/:patientId/tutors/by-dni` | `...authorize, relationScope, requireTutorRequest` |
| `router` | POST | `/patients/:patientId/tutors` | `...authorize, relationScope, requireTutorRequest` |
| `router` | GET | `/patients/:patientId/tutors` | `...authorize, listPatientTutorsController` |
| `router` | PATCH | `/patients/:patientId/tutors/:tutorId` | `...authorize, updatePatientTutorController` |
| `router` | PATCH | `/patients/:patientId/tutors/:tutorId/end` | `...authorize, finishPatientTutorController` |
| `router` | GET | `/tutors/:tutorId/patients` | `...authorize, listTutorPatientsController` |

Middleware o montajes compartidos:

```typescript
router.use('/patients/:patientId/tutors', ...authorize, relationScope);
```

## profesional.routes.ts

[Fuente](../backend/src/routes/profesional.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/` | `authenticate, patientProfessionals` |
| `router` | GET | `/me/horarios-disponibilidad` | `authenticate, requireRole('PROFESIONAL'), obtenerMisHorariosController` |
| `router` | GET | `/` | `authenticate, requireRole('SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'), professionalScope, getAllProfesionales` |
| `router` | GET | `/:id` | `requireRole("SUPER_ADMIN", "ADMIN_SALITA"), professionalScope, getProfesionalById` |
| `router` | POST | `/` | `requireRole("SUPER_ADMIN", "ADMIN_SALITA"), professionalScope, createProfesional` |
| `router` | PUT | `/:id` | `requireRole("SUPER_ADMIN", "ADMIN_SALITA"), professionalScope, updateProfesional` |
| `router` | DELETE | `/:id` | `requireRole("SUPER_ADMIN", "ADMIN_SALITA"), professionalScope, deleteProfesional` |

Middleware o montajes compartidos:

```typescript
router.use(authenticate);
```

## profesional-especialidad.routes.ts

[Fuente](../backend/src/routes/profesional-especialidad.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/:id/especialidades` | `requireRole('SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'), professionalScope, getEspecialidades` |
| `router` | POST | `/:id/especialidades` | `requireRole('SUPER_ADMIN', 'ADMIN_SALITA'), professionalScope, createEspecialidad` |
| `router` | PUT | `/:id/especialidades/:idEspecialidad` | `requireRole('SUPER_ADMIN', 'ADMIN_SALITA'), professionalScope, updateEspecialidad` |
| `router` | DELETE | `/:id/especialidades/:idEspecialidad` | `requireRole('SUPER_ADMIN', 'ADMIN_SALITA'), professionalScope, deleteEspecialidad` |

Middleware o montajes compartidos:

```typescript
router.use(authenticate);
```

## profesional-salita.routes.ts

[Fuente](../backend/src/routes/profesional-salita.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/:id/salitas` | `requireRole('SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'), professionalScope, getSalitas` |
| `router` | POST | `/:id/salitas` | `requireRole('SUPER_ADMIN', 'ADMIN_SALITA'), professionalScope, createSalita` |
| `router` | PUT | `/:id/salitas/:idSalita` | `requireRole('SUPER_ADMIN', 'ADMIN_SALITA'), professionalScope, updateSalita` |
| `router` | DELETE | `/:id/salitas/:idSalita` | `requireRole('SUPER_ADMIN', 'ADMIN_SALITA'), professionalScope, deleteSalita` |

Middleware o montajes compartidos:

```typescript
router.use(authenticate);
```

## public-content.routes.ts

[Fuente](../backend/src/routes/public-content.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `publicContentRoutes` | GET | `/noticias` | `controller.list` |
| `publicContentRoutes` | GET | `/noticias/:id` | `controller.detail` |
| `publicContentRoutes` | GET | `/noticias-municipales` | `controller.municipal` |
| `adminContentRoutes` | GET | `/categorias` | `controller.options` |
| `adminContentRoutes` | GET | `/noticias` | `controller.adminList` |
| `adminContentRoutes` | POST | `/noticias` | `controller.save` |
| `adminContentRoutes` | GET | `/noticias/:id` | `controller.adminDetail` |
| `adminContentRoutes` | PUT | `/noticias/:id` | `controller.save` |

Middleware o montajes compartidos:

```typescript
adminContentRoutes.use(
  authenticate,
  requireRole(
    'SUPER_ADMIN',
    'ADMIN_SALITA'
  )
);
```

## reporte.routes.ts

[Fuente](../backend/src/routes/reporte.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/dashboard` | `authenticate, requireRole('SUPER_ADMIN'), getDashboardController` |
| `router` | GET | `/agenda-diaria` | `authenticate, requireRole("SUPER_ADMIN", "ADMIN_SALITA", "PROFESIONAL"), getAgendaDiariaController` |
| `router` | GET | `/agenda-diaria/exportar` | `authenticate, requireRole("SUPER_ADMIN", "ADMIN_SALITA", "PROFESIONAL"), exportAgendaDiariaController` |
| `router` | GET | `/agenda-diaria/imprimir` | `authenticate, requireRole("SUPER_ADMIN", "ADMIN_SALITA", "PROFESIONAL"), printAgendaDiariaController` |
| `router` | GET | `/resumen` | `authenticate, requireRole(...rolesReporte), getReporteResumenController` |
| `router` | GET | `/especialidades` | `authenticate, requireRole(...rolesReporte), getReporteEspecialidadesController` |
| `router` | GET | `/profesionales` | `authenticate, requireRole(...rolesReporte), getReporteProfesionalesController` |
| `router` | GET | `/exportar` | `authenticate, requireRole(...rolesReporte), exportReporteController` |

## salita.routes.ts

[Fuente](../backend/src/routes/salita.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/` | `getAllSalitas` |
| `router` | GET | `/admin` | `authenticate, requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"), getAdminSalitas` |
| `router` | GET | `/:id` | `getSalitaById` |
| `router` | POST | `/` | `authenticate, requireRole("SUPER_ADMIN"), createSalita` |
| `router` | PUT | `/:id` | `authenticate, requireRole("SUPER_ADMIN"), updateSalita` |
| `router` | DELETE | `/:id` | `authenticate, requireRole("SUPER_ADMIN"), deleteSalita` |

## salita-barrio.routes.ts

[Fuente](../backend/src/routes/salita-barrio.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/` | `getAllSalitaBarrios` |
| `router` | GET | `/salita/:id` | `getBarriosBySalita` |
| `router` | GET | `/barrio/:id` | `getSalitasByBarrio` |
| `router` | POST | `/` | `authenticate, requireRole("SUPER_ADMIN"), createSalitaBarrio` |
| `router` | PUT | `/:idSalita/:idBarrio` | `authenticate, requireRole("SUPER_ADMIN"), updateSalitaBarrio` |
| `router` | DELETE | `/:idSalita/:idBarrio` | `authenticate, requireRole("SUPER_ADMIN"), deleteSalitaBarrio` |

## sancion.routes.ts

[Fuente](../backend/src/routes/sancion.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/` | `authenticate, requireRole(...rolesGestion), getSancionesController` |
| `router` | GET | `/:id` | `authenticate, requireRole(...rolesGestion), getSancionByIdController` |
| `router` | POST | `/` | `authenticate, requireRole(...rolesGestion), createSancionController` |
| `router` | PATCH | `/:id/anular` | `authenticate, requireRole(...rolesGestion), anularSancionController` |

## turno.routes.ts

[Fuente](../backend/src/routes/turno.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | POST | `/reprogramacion/impacto` | `requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"), agendaImpactController` |
| `router` | POST | `/reprogramacion/propuesta` | `requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"), agendaProposalController` |
| `router` | POST | `/reprogramacion/confirmar` | `requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"), agendaConfirmController` |
| `router` | POST | `/reprogramacion/disponibilidad` | `requireRole('SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'), agendaAvailabilityController` |
| `router` | POST | `/` | `requireRole( "SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION", "PACIENTE" ), createTurnoController` |
| `router` | GET | `/` | `listTurnosController` |
| `router` | GET | `/:id` | `getTurnoController` |
| `router` | PATCH | `/:id` | `requireRole( "SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION" ), updateTurnoController` |
| `router` | PATCH | `/:id/status` | `requireRole( "SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION", "PROFESIONAL", "PACIENTE" ), changeTurnoStatusController` |

Middleware o montajes compartidos:

```typescript
router.use(authenticate);
router.use(
  requireRole(
    "SUPER_ADMIN",
    "ADMIN_SALITA",
    "RECEPCION",
    "PROFESIONAL",
    "PACIENTE"
  )
);
```

## tutor.routes.ts

[Fuente](../backend/src/routes/tutor.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/` | `listTutorsController` |
| `router` | GET | `/dni/:dni` | `getTutorByDniController` |
| `router` | GET | `/:id` | `getTutorController` |
| `router` | PATCH | `/:id/status` | `updateTutorStatusController` |
| `router` | PATCH | `/:id` | `updateTutorController` |
| `router` | POST | `/` | `createTutorController` |

Middleware o montajes compartidos:

```typescript
router.use(authenticate);
router.use(requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"));
```

## user.routes.ts

[Fuente](../backend/src/routes/user.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/health` | `userHealthCheck` |
| `router` | POST | `/admins` | `authenticate, requireRole("SUPER_ADMIN"), createAdmin` |
| `router` | POST | `/patients` | `authenticate, requireRole( "SUPER_ADMIN", "ADMIN_SALITA" ), createPatient` |
| `router` | POST | `/professionals` | `authenticate, requireRole( "SUPER_ADMIN", "ADMIN_SALITA" ), createProfessional` |

## zona.routes.ts

[Fuente](../backend/src/routes/zona.routes.ts)

| Router | Método | Ruta local | Handlers declarados |
| --- | --- | --- | --- |
| `router` | GET | `/` | `getAllZonas` |
| `router` | GET | `/:id` | `getZonaById` |
| `router` | POST | `/` | `authenticate, requireRole("SUPER_ADMIN"), createZona` |
| `router` | PUT | `/:id` | `authenticate, requireRole("SUPER_ADMIN"), updateZona` |
| `router` | DELETE | `/:id` | `authenticate, requireRole("SUPER_ADMIN"), deleteZona` |


## historia-clinica.routes.ts

[Fuente](../backend/src/routes/historia-clinica.routes.ts) · [Documentación detallada](HISTORIA_CLINICA.md)

Montado en el prefijo `/api/historia-clinica`. Todas las peticiones emiten la cabecera `Cache-Control: no-store` y exigen token JWT válido (`authenticate`).

| Router | Método | Ruta local | Handlers declarados | Permiso / Alcance |
| --- | --- | --- | --- | --- |
| `router` | GET | `/mi-historia` | `requireRole('PACIENTE'), getMiHistoriaClinicaController` | Portal del Paciente (propia HCE y tutelados) |
| `router` | GET | `/contexto` | `obtenerContextoClinicoController` | Contexto de salitas y especialidades del profesional |
| `router` | GET | `/pacientes` | `requirePermission('VER_HISTORIA_CLINICA'), buscarPacientesClinicosController` | Búsqueda clínica en salita asignada |
| `router` | GET | `/pacientes/:idPaciente` | `requirePermission('VER_HISTORIA_CLINICA'), clinicalScope(...), consultarHistoriaClinicaController` | Expediente longitudinal del paciente |
| `router` | GET | `/pacientes/:idPaciente/antecedentes` | `requirePermission('VER_HISTORIA_CLINICA'), clinicalScope(...), consultarAntecedentesController` | Antecedentes personales y familiares |
| `router` | GET | `/pacientes/:idPaciente/alergias` | `requirePermission('VER_HISTORIA_CLINICA'), clinicalScope(...), consultarAlergiasController` | Registro de alergias del paciente |
| `router` | GET | `/consultas/:idConsulta` | `requirePermission('VER_HISTORIA_CLINICA'), clinicalResourceScope(...), consultarConsultaMedicaController` | Detalle de consulta médica |
| `router` | GET | `/consultas/:idConsulta/diagnosticos`| `requirePermission('VER_HISTORIA_CLINICA'), clinicalResourceScope(...), consultarDiagnosticosConsultaController` | Diagnósticos de la consulta |
| `router` | GET | `/consultas/:idConsulta/evoluciones` | `requirePermission('VER_HISTORIA_CLINICA'), clinicalResourceScope(...), consultarEvolucionesConsultaController` | Evoluciones de la consulta |
| `router` | GET | `/consultas/:idConsulta/tratamientos`| `requirePermission('VER_HISTORIA_CLINICA'), clinicalResourceScope(...), consultarTratamientosConsultaController` | Tratamientos prescritos |
| `router` | GET | `/consultas/:idConsulta/estudios` | `requirePermission('VER_HISTORIA_CLINICA'), clinicalResourceScope(...), consultarEstudiosConsultaController` | Estudios complementarios solicitados |
| `router` | POST | `/consultas` | `requirePermission('CREAR_CONSULTA_CLINICA'), clinicalScope(...), registrarConsultaClinicaController` | Alta de consulta médica |
| `router` | PATCH | `/consultas/:idConsulta` | `requirePermission('CREAR_CONSULTA_CLINICA'), clinicalResourceScope(...), actualizarConsultaBorradorController` | Modificación de borrador de consulta |
| `router` | POST | `/consultas/:idConsulta/firmar` | `requirePermission('CREAR_CONSULTA_CLINICA'), clinicalResourceScope(...), firmarConsultaMedicaController` | Firma digital y consolidación inmutable |
| `router` | POST | `/consultas/:idConsulta/anular` | `requirePermission('CREAR_CONSULTA_CLINICA'), clinicalResourceScope(...), anularConsultaBorradorController` | Anulación justificada de borrador |
| `router` | GET | `/borradores-temporales` | `requirePermission('CREAR_CONSULTA_CLINICA'), clinicalScope(...), obtenerBorradorTemporalController` | Recupera borrador temporal autoguardado |
| `router` | PUT | `/borradores-temporales` | `requirePermission('CREAR_CONSULTA_CLINICA'), clinicalScope(...), guardarBorradorTemporalController` | Autoguarda borrador temporal con versionado |
| `router` | DELETE | `/borradores-temporales` | `requirePermission('CREAR_CONSULTA_CLINICA'), clinicalScope(...), descartarBorradorTemporalController` | Descarte del borrador temporal |
| `router` | POST | `/consultas/:idConsulta/evoluciones` | `requirePermission('REGISTRAR_EVOLUCIONES'), clinicalResourceScope(...), registrarEvolucionClinicaController` | Registro de nueva evolución médica |
| `router` | POST | `/evoluciones/:idEvolucion/rectificar` | `requirePermission('REGISTRAR_EVOLUCIONES'), clinicalResourceScope(...), rectificarEvolucionClinicaController` | Rectificación trazable con evolución previa |
| `router` | PATCH | `/estudios/:idEstudio/estado` | `requirePermission('GESTIONAR_ESTUDIOS_CLINICOS'), clinicalResourceScope(...), actualizarEstadoEstudioController` | Cambio de estado de estudio clínico |
| `router` | POST | `/estudios/:idEstudio/informar` | `requirePermission('GESTIONAR_ESTUDIOS_CLINICOS'), clinicalResourceScope(...), informarEstudioController` | Informe y resultado del estudio |
| `router` | GET | `/derivaciones` | `requirePermission('GESTIONAR_DERIVACIONES_CLINICAS'), clinicalDerivationScope(), listarDerivacionesController` | Listado de derivaciones inter-salitas |
| `router` | POST | `/derivaciones` | `requirePermission('GESTIONAR_DERIVACIONES_CLINICAS'), clinicalScope(...), solicitarDerivacionController` | Emisión de derivación inter-salita |
| `router` | PATCH | `/derivaciones/:idDerivacion` | `requirePermission('GESTIONAR_DERIVACIONES_CLINICAS'), clinicalDerivationScope(), resolverDerivacionController` | Resolución / autorización de derivación |
| `router` | PATCH | `/derivaciones/:idDerivacion/resolver` | `requirePermission('GESTIONAR_DERIVACIONES_CLINICAS'), clinicalDerivationScope(), resolverDerivacionController` | Alias para resolución de derivación |
| `router` | GET | `/auditoria` | `requirePermission('VER_AUDITORIA_CLINICA'), clinicalAuditScope(), consultarAuditoriaClinicaController` | Auditoría inmutable de accesos clínicos |
