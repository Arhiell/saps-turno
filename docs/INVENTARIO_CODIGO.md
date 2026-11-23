# 🧭 Inventario de código

[Índice](README.md) · [Backend](BACKEND.md) · [Frontend](FRONTEND.md)

Inventario estático de archivos de fuente, pruebas y configuración versionable presentes durante la revisión documental. Excluye dependencias, compilaciones, credenciales y metadatos Git. Los símbolos son declaraciones exportadas detectables por nombre; no equivalen a una descripción exhaustiva de cada función. Para contratos y reglas seguir el documento temático y los imports del archivo.

## backend/src / (raíz)

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [app.ts](../backend/src/app.ts) | Módulo, configuración o documentación; consultar fuente |
| [server.ts](../backend/src/server.ts) | Módulo, configuración o documentación; consultar fuente |

## backend/src / BBDD

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [BBDD/20260926_email_verification_attempts.sql](../backend/src/BBDD/20260926_email_verification_attempts.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20260929_password_recovery_codes.sql](../backend/src/BBDD/20260929_password_recovery_codes.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20260929_patient_email_change.sql](../backend/src/BBDD/20260929_patient_email_change.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261006_notificaciones_audiencia.sql](../backend/src/BBDD/20261006_notificaciones_audiencia.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261006_notificaciones_edicion.sql](../backend/src/BBDD/20261006_notificaciones_edicion.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261006_notificaciones_envios.sql](../backend/src/BBDD/20261006_notificaciones_envios.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261006_notificaciones_excluir_remitente.sql](../backend/src/BBDD/20261006_notificaciones_excluir_remitente.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261006_notificaciones_worker.sql](../backend/src/BBDD/20261006_notificaciones_worker.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261006_unique_person_email.sql](../backend/src/BBDD/20261006_unique_person_email.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261007_contenido_publico.sql](../backend/src/BBDD/20261007_contenido_publico.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261011_admin_profile.sql](../backend/src/BBDD/20261011_admin_profile.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261020_sancion_global_inasistencia.sql](../backend/src/BBDD/20261020_sancion_global_inasistencia.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261031_solicitudes_vinculacion.sql](../backend/src/BBDD/20261031_solicitudes_vinculacion.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261103_agenda_escritura.sql](../backend/src/BBDD/20261103_agenda_escritura.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261103_agenda_impacto.sql](../backend/src/BBDD/20261103_agenda_impacto.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261107_cierres_calendario.sql](../backend/src/BBDD/20261107_cierres_calendario.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261108_argentinadatos.sql](../backend/src/BBDD/20261108_argentinadatos.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261109_profesional_salita_vigencia.sql](../backend/src/BBDD/20261109_profesional_salita_vigencia.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261110_historia_clinica.sql](../backend/src/BBDD/20261110_historia_clinica.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261110_super_admin_auditoria_clinica.sql](../backend/src/BBDD/20261110_super_admin_auditoria_clinica.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261115_admin_recepcion_ver_historia_clinica.sql](../backend/src/BBDD/20261115_admin_recepcion_ver_historia_clinica.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/20261115_fix_auditoria_clinica_columns.sql](../backend/src/BBDD/20261115_fix_auditoria_clinica_columns.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/PROPUESTA_20261110_hc_borradores_y_turno_anticipado.sql](../backend/src/BBDD/PROPUESTA_20261110_hc_borradores_y_turno_anticipado.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/SAPS_Turno_BBDD3_FINAL.sql](../backend/src/BBDD/SAPS_Turno_BBDD3_FINAL.sql) | DDL / funciones SQL; consultar diccionario y migraciones |
| [BBDD/VERIFICACION_EMAIL.md](../backend/src/BBDD/VERIFICACION_EMAIL.md) | Módulo, configuración o documentación; consultar fuente |

## backend/src / config

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [config/chatbot.config.ts](../backend/src/config/chatbot.config.ts) | CHATBOT_ROLES, ChatbotRole, chatbotLimits, getChatbotSettings, chatbotInstructions |
| [config/chatbot-knowledge.ts](../backend/src/config/chatbot-knowledge.ts) | ChatbotArticle, chatbotKnowledge, selectChatbotArticle |
| [config/env.ts](../backend/src/config/env.ts) | env |
| [config/supabase.ts](../backend/src/config/supabase.ts) | supabase |

## backend/src / controllers

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [controllers/account.controller.ts](../backend/src/controllers/account.controller.ts) | changeUsername, changePassword |
| [controllers/agenda-impacto.controller.ts](../backend/src/controllers/agenda-impacto.controller.ts) | agendaAvailabilityController, agendaImpactController, agendaProposalController, agendaConfirmController |
| [controllers/auditoria.controller.ts](../backend/src/controllers/auditoria.controller.ts) | getAuditoriasController, getAuditoriaByIdController |
| [controllers/auth.controller.ts](../backend/src/controllers/auth.controller.ts) | register, login, refresh, logout |
| [controllers/auth-profile.controller.ts](../backend/src/controllers/auth-profile.controller.ts) | updateOwnProfile, ownProfile, completeProfile |
| [controllers/barrio.controller.ts](../backend/src/controllers/barrio.controller.ts) | getAllBarrios, getBarrioById, createBarrio, updateBarrio, deleteBarrio |
| [controllers/bloqueo-agenda.controller.ts](../backend/src/controllers/bloqueo-agenda.controller.ts) | obtenerBloqueos, obtenerBloqueo, crearBloqueoController, actualizarBloqueoController, eliminarBloqueoController |
| [controllers/chatbot.controller.ts](../backend/src/controllers/chatbot.controller.ts) | chatbotController |
| [controllers/cierre-calendario.controller.ts](../backend/src/controllers/cierre-calendario.controller.ts) | sincronizar, estadoSync, listar, guardar, desactivar |
| [controllers/configuracion.controller.ts](../backend/src/controllers/configuracion.controller.ts) | listConfiguracionesController, publicConfiguracionesController, getConfiguracionController, createConfiguracionController, updateConfiguracionController |
| [controllers/dashboard.controller.ts](../backend/src/controllers/dashboard.controller.ts) | getDashboardController |
| [controllers/disponibilidad.controller.ts](../backend/src/controllers/disponibilidad.controller.ts) | obtenerFechasPaciente, obtenerDisponibilidadController |
| [controllers/email-change.controller.ts](../backend/src/controllers/email-change.controller.ts) | requestChange, confirmChange |
| [controllers/email-verification.controller.ts](../backend/src/controllers/email-verification.controller.ts) | requestVerification, verifyEmail |
| [controllers/especialidad.controller.ts](../backend/src/controllers/especialidad.controller.ts) | getAllEspecialidades, getEspecialidadById, createEspecialidad, updateEspecialidad, deleteEspecialidad |
| [controllers/google-auth.controller.ts](../backend/src/controllers/google-auth.controller.ts) | googleLogin |
| [controllers/health.controller.ts](../backend/src/controllers/health.controller.ts) | healthCheck, databaseHealthCheck |
| [controllers/historia-clinica.controller.ts](../backend/src/controllers/historia-clinica.controller.ts) | registrarConsultaClinicaController, actualizarConsultaBorradorController, firmarConsultaMedicaController, anularConsultaBorradorController, consultarHistoriaClinicaController, consultarConsultaMedicaController, consultarDiagnosticosConsultaController, consultarEvolucionesConsultaController, consultarTratamientosConsultaController, consultarEstudiosConsultaController, consultarAntecedentesController, consultarAlergiasController, registrarEvolucionClinicaController, rectificarEvolucionClinicaController, actualizarEstadoEstudioController, informarEstudioController, listarDerivacionesController, solicitarDerivacionController, resolverDerivacionController, consultarAuditoriaClinicaController, obtenerBorradorTemporalController, guardarBorradorTemporalController, descartarBorradorTemporalController |
| [controllers/historia-clinica-support.controller.ts](../backend/src/controllers/historia-clinica-support.controller.ts) | obtenerContextoClinicoController, buscarPacientesClinicosController |
| [controllers/historial-turno.controller.ts](../backend/src/controllers/historial-turno.controller.ts) | getHistorialTurnoController, getHistorialGeneralController |
| [controllers/horario-atencion.controller.ts](../backend/src/controllers/horario-atencion.controller.ts) | obtenerHorarios, obtenerHorario, crearHorarioController, actualizarHorarioController, eliminarHorarioController |
| [controllers/notificacion.controller.ts](../backend/src/controllers/notificacion.controller.ts) | getNotificacionesController, getNotificacionController, leerNotificacionController, leerTodasController |
| [controllers/notificacion-admin.controller.ts](../backend/src/controllers/notificacion-admin.controller.ts) | editarEnvioController, opcionesEnvioController, previewEnvioController, buscarDestinatariosController, crearEnvioController, historialEnviosController, detalleEnvioController, cancelarEnvioController |
| [controllers/password-recovery.controller.ts](../backend/src/controllers/password-recovery.controller.ts) | forgotPassword, resetUserPassword |
| [controllers/patient.controller.ts](../backend/src/controllers/patient.controller.ts) | createPatientController |
| [controllers/patient-agenda.controller.ts](../backend/src/controllers/patient-agenda.controller.ts) | patientProfessionals |
| [controllers/patient-clinical.controller.ts](../backend/src/controllers/patient-clinical.controller.ts) | getMiHistoriaClinicaController |
| [controllers/patient-read.controller.ts](../backend/src/controllers/patient-read.controller.ts) | listPatientsController, getPatientController, getPatientByDniController |
| [controllers/patient-tutor.controller.ts](../backend/src/controllers/patient-tutor.controller.ts) | listPatientTutorsController, listTutorPatientsController, updatePatientTutorController, finishPatientTutorController |
| [controllers/patient-update.controller.ts](../backend/src/controllers/patient-update.controller.ts) | updatePatientController, updatePatientStatusController |
| [controllers/profesional.controller.ts](../backend/src/controllers/profesional.controller.ts) | getAllProfesionales, getProfesionalById, createProfesional, updateProfesional, deleteProfesional |
| [controllers/profesional-especialidad.controller.ts](../backend/src/controllers/profesional-especialidad.controller.ts) | getEspecialidades, createEspecialidad, updateEspecialidad, deleteEspecialidad |
| [controllers/profesional-horarios.controller.ts](../backend/src/controllers/profesional-horarios.controller.ts) | obtenerMisHorariosController |
| [controllers/profesional-salita.controller.ts](../backend/src/controllers/profesional-salita.controller.ts) | getSalitas, createSalita, updateSalita, deleteSalita |
| [controllers/public-content.controller.ts](../backend/src/controllers/public-content.controller.ts) | list, detail, municipal, options, adminList, adminDetail, save |
| [controllers/reporte.controller.ts](../backend/src/controllers/reporte.controller.ts) | getReporteResumenController, getReporteEspecialidadesController, getReporteProfesionalesController, exportReporteController |
| [controllers/reporte-agenda.controller.ts](../backend/src/controllers/reporte-agenda.controller.ts) | getAgendaDiariaController, exportAgendaDiariaController, printAgendaDiariaController |
| [controllers/salita.controller.ts](../backend/src/controllers/salita.controller.ts) | getAllSalitas, getAdminSalitas, getSalitaById, createSalita, updateSalita, deleteSalita |
| [controllers/salita-barrio.controller.ts](../backend/src/controllers/salita-barrio.controller.ts) | getAllSalitaBarrios, getBarriosBySalita, getSalitasByBarrio, createSalitaBarrio, updateSalitaBarrio, deleteSalitaBarrio |
| [controllers/sancion.controller.ts](../backend/src/controllers/sancion.controller.ts) | createSancionController, getSancionesController, getSancionByIdController, anularSancionController |
| [controllers/turno.controller.ts](../backend/src/controllers/turno.controller.ts) | createTurnoController |
| [controllers/turno-read.controller.ts](../backend/src/controllers/turno-read.controller.ts) | listTurnosController, getTurnoController |
| [controllers/turno-update.controller.ts](../backend/src/controllers/turno-update.controller.ts) | updateTurnoController, changeTurnoStatusController |
| [controllers/tutor.controller.ts](../backend/src/controllers/tutor.controller.ts) | createTutorController |
| [controllers/tutor-read.controller.ts](../backend/src/controllers/tutor-read.controller.ts) | listTutorsController, getTutorController, getTutorByDniController |
| [controllers/tutor-request.controller.ts](../backend/src/controllers/tutor-request.controller.ts) | createTutorRequestController, listOwnTutorRequestsController, listAdminTutorRequestsController, resolveTutorRequestController |
| [controllers/tutor-update.controller.ts](../backend/src/controllers/tutor-update.controller.ts) | updateTutorController, updateTutorStatusController |
| [controllers/user.controller.ts](../backend/src/controllers/user.controller.ts) | userHealthCheck, createAdmin, createPatient, createProfessional |
| [controllers/zona.controller.ts](../backend/src/controllers/zona.controller.ts) | getAllZonas, getZonaById, createZona, updateZona, deleteZona |

## backend/src / middlewares

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [middlewares/auth.middleware.ts](../backend/src/middlewares/auth.middleware.ts) | authenticate, authenticateForProfile |
| [middlewares/chatbot-rate-limit.middleware.ts](../backend/src/middlewares/chatbot-rate-limit.middleware.ts) | ChatbotRateLimiter |
| [middlewares/clinical-scope.middleware.ts](../backend/src/middlewares/clinical-scope.middleware.ts) | clinicalScope, clinicalResourceScope, clinicalDerivationScope, clinicalAuditScope |
| [middlewares/error.middleware.ts](../backend/src/middlewares/error.middleware.ts) | errorHandler |
| [middlewares/not-found.middleware.ts](../backend/src/middlewares/not-found.middleware.ts) | notFoundHandler |
| [middlewares/permission.middleware.ts](../backend/src/middlewares/permission.middleware.ts) | requirePermission |
| [middlewares/profile-scope.middleware.ts](../backend/src/middlewares/profile-scope.middleware.ts) | patientScope, professionalScope, scheduleScope |
| [middlewares/role.middleware.ts](../backend/src/middlewares/role.middleware.ts) | requireRole |

## backend/src / repositories

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [repositories/account.repository.ts](../backend/src/repositories/account.repository.ts) | findAccountByPersonId, findAccountCredentials, updateUsername, replacePassword |
| [repositories/account-display.select.ts](../backend/src/repositories/account-display.select.ts) | accountDisplaySelect, personAccountSelect, canViewAccount, AccountDisplay |
| [repositories/agenda-impacto.repository.ts](../backend/src/repositories/agenda-impacto.repository.ts) | findAgendaAffected, saveAgenda |
| [repositories/argentinadatos.repository.ts](../backend/src/repositories/argentinadatos.repository.ts) | argentinaDatosSource, FeriadoExterno, fetchFeriados |
| [repositories/auditoria.repository.ts](../backend/src/repositories/auditoria.repository.ts) | findAuditorias, findAuditoriaById |
| [repositories/barrio.repository.ts](../backend/src/repositories/barrio.repository.ts) | getAllBarrios, getBarrioById, createBarrio, updateBarrio, deleteBarrio |
| [repositories/bloqueo-agenda.repository.ts](../backend/src/repositories/bloqueo-agenda.repository.ts) | getAllBloqueos, getBloqueoById, findBloqueoParaTurno |
| [repositories/cierre-calendario.repository.ts](../backend/src/repositories/cierre-calendario.repository.ts) | findCierres, findCierre, saveCierre, findProfesionalesCierre, SyncYearResult, SyncSummary, SyncStatus, getCalendarioSync, claimCalendarioSync, applyFeriados, finishCalendarioSync, getCierresPendientes |
| [repositories/clinical-scope.repository.ts](../backend/src/repositories/clinical-scope.repository.ts) | findClinicalScopeAccess, findClinicalResourceScopeAccess, findClinicalDerivationScopeAccess, findClinicalAuditScopeAccess |
| [repositories/configuracion.repository.ts](../backend/src/repositories/configuracion.repository.ts) | findConfiguraciones, findConfiguracionById, findConfiguracionByClave, createConfiguracion, updateConfiguracion |
| [repositories/dashboard.repository.ts](../backend/src/repositories/dashboard.repository.ts) | countDashboardRecords, countDashboardTurnos, findDashboardActivity |
| [repositories/disponibilidad.repository.ts](../backend/src/repositories/disponibilidad.repository.ts) | getHorariosParaDisponibilidad, getBloqueosParaDisponibilidad, getTurnosParaDisponibilidad |
| [repositories/email-verification.repository.ts](../backend/src/repositories/email-verification.repository.ts) | consumeEmailCode, issueEmailCode, invalidateEmailCode, findUserForEmailVerification, invalidatePreviousEmailTokens, createEmailVerificationToken, findEmailVerificationToken, markEmailAsVerified, markEmailTokenAsUsed, findLatestPendingEmailToken, registerEmailCodeAttempt |
| [repositories/especialidad.repository.ts](../backend/src/repositories/especialidad.repository.ts) | getAllEspecialidades, getEspecialidadById, createEspecialidad, updateEspecialidad, deleteEspecialidad |
| [repositories/google-auth.repository.ts](../backend/src/repositories/google-auth.repository.ts) | findGoogleIdentity, findUserByGoogleEmail, markGoogleEmailAsVerified, createGoogleUser, createGoogleIdentity |
| [repositories/historia-clinica.repository.ts](../backend/src/repositories/historia-clinica.repository.ts) | findHistoriaClinicaByPaciente, createConsultaClinica, updateConsultaBorrador, firmarConsultaMedica, anularConsultaBorrador, findConsultaMedicaById, findDiagnosticosByConsulta, findEvolucionesByConsulta, findTratamientosByConsulta, findEstudiosByConsulta, findAntecedentesByPaciente, findAlergiasByPaciente, createEvolucionClinica, rectificarEvolucionClinica, updateEstadoEstudio, informarEstudio, listDerivacionesClinicas, createDerivacionClinica, resolveDerivacionClinica, findAuditoriaClinica, upsertBorradorTemporal, getBorradorTemporal, deleteBorradorTemporal |
| [repositories/historia-clinica-support.repository.ts](../backend/src/repositories/historia-clinica-support.repository.ts) | getHistoriaClinicaContext, searchClinicalPatients |
| [repositories/historial-turno.repository.ts](../backend/src/repositories/historial-turno.repository.ts) | findTurnoForHistorial, findHistorialByTurno, findHistorialGeneral |
| [repositories/horario-atencion.repository.ts](../backend/src/repositories/horario-atencion.repository.ts) | getAllHorarios, getHorarioById, findHorariosParaTurno |
| [repositories/municipal-news.repository.ts](../backend/src/repositories/municipal-news.repository.ts) | municipalSource, MunicipalNews, fetchMunicipalNews |
| [repositories/notificacion.repository.ts](../backend/src/repositories/notificacion.repository.ts) | createNotificacion, findNotificacionesByUsuario, findNotificacionById, markNotificacionAsRead, markAllNotificacionesAsRead |
| [repositories/notificacion-admin.repository.ts](../backend/src/repositories/notificacion-admin.repository.ts) | Destinatario, Preview, Envio, previewAudiencia, insertarEnvio, consultarEnvios, consultarEnvio, consultarCabeceraEnvio, resumenFallas, modificarEnvio, cancelarEnvio, opcionesNotificaciones, nombreRemitente |
| [repositories/notificacion-turno.repository.ts](../backend/src/repositories/notificacion-turno.repository.ts) | findTutorUsersByTurno, findUsuarioByTurno, findTurnoEmailContextById |
| [repositories/notificacion-worker.repository.ts](../backend/src/repositories/notificacion-worker.repository.ts) | Entrega, reclamarEntrega, finalizarEntrega |
| [repositories/password-recovery.repository.ts](../backend/src/repositories/password-recovery.repository.ts) | findRecoveryUserByEmail, invalidatePreviousRecoveryTokens, createPasswordRecoveryToken, issuePasswordRecoveryCode, consumePasswordRecoveryCode, invalidatePasswordRecoveryCode, findPasswordRecoveryToken, markRecoveryTokenAsUsed, updateRecoveredPassword |
| [repositories/patient.repository.ts](../backend/src/repositories/patient.repository.ts) | createPatient |
| [repositories/patient-agenda.repository.ts](../backend/src/repositories/patient-agenda.repository.ts) | PatientProfessional, findPatientProfessionals |
| [repositories/patient-clinical.repository.ts](../backend/src/repositories/patient-clinical.repository.ts) | findMyHistoriaClinica, findTuteladoHistoriaClinica |
| [repositories/patient-read.repository.ts](../backend/src/repositories/patient-read.repository.ts) | findPatients, findPatientById, findPatientDetailsByDni, findPatientByPersonId |
| [repositories/patient-select.ts](../backend/src/repositories/patient-select.ts) | PatientRow, patientSelect, patientAdminSelect, flattenPatient |
| [repositories/patient-tutor.repository.ts](../backend/src/repositories/patient-tutor.repository.ts) | findActivePatientTutorRelation, findCurrentPrincipalTutor, findTutorsByPatientId, findPatientTutorHistory, findPatientsByTutorId, updatePatientTutorRelation, endPatientTutorRelation |
| [repositories/patient-update.repository.ts](../backend/src/repositories/patient-update.repository.ts) | updatePatient, updatePatientStatus |
| [repositories/person.repository.ts](../backend/src/repositories/person.repository.ts) | createPerson, createPersonForAdmin |
| [repositories/person-read.repository.ts](../backend/src/repositories/person-read.repository.ts) | personSelect, findPersonByDni, findPersonById, findPersonsByEmail |
| [repositories/person-update.repository.ts](../backend/src/repositories/person-update.repository.ts) | updatePerson |
| [repositories/permission.repository.ts](../backend/src/repositories/permission.repository.ts) | findUserPermissions, hasUserPermission |
| [repositories/profesional.repository.ts](../backend/src/repositories/profesional.repository.ts) | findProfesionalIdentity, getAllProfesionales, getProfesionalById, createProfesional, updateProfesional, deleteProfesional |
| [repositories/profesional-especialidad.repository.ts](../backend/src/repositories/profesional-especialidad.repository.ts) | getEspecialidadesByProfesional, createProfesionalEspecialidad, updateProfesionalEspecialidad, deleteProfesionalEspecialidad |
| [repositories/profesional-salita.repository.ts](../backend/src/repositories/profesional-salita.repository.ts) | getSalitasByProfesional, createProfesionalSalita, updateProfesionalSalita, deleteProfesionalSalita |
| [repositories/profile-assignment.repository.ts](../backend/src/repositories/profile-assignment.repository.ts) | findProfileAssignments |
| [repositories/public-news.repository.ts](../backend/src/repositories/public-news.repository.ts) | categories, listNews, findNews, saveNews |
| [repositories/public-salitas.repository.ts](../backend/src/repositories/public-salitas.repository.ts) | PublicSalitaRow, publicSalitas |
| [repositories/reporte.repository.ts](../backend/src/repositories/reporte.repository.ts) | findTurnosReporte |
| [repositories/salita.repository.ts](../backend/src/repositories/salita.repository.ts) | getAllSalitas, getSalitasByIds, getSalitaById, createSalita, updateSalita, deleteSalita |
| [repositories/salita-barrio.repository.ts](../backend/src/repositories/salita-barrio.repository.ts) | getAllSalitaBarrios, getBarriosBySalita, getSalitasByBarrio, createSalitaBarrio, updateSalitaBarrio, deleteSalitaBarrio |
| [repositories/sancion.repository.ts](../backend/src/repositories/sancion.repository.ts) | createSancion, anularSancion |
| [repositories/sancion-read.repository.ts](../backend/src/repositories/sancion-read.repository.ts) | findSancionById, findSanciones |
| [repositories/sesion.repository.ts](../backend/src/repositories/sesion.repository.ts) | createRefreshSession, findRefreshSession, revokeRefreshSession, revokeAllUserRefreshSessions |
| [repositories/system.repository.ts](../backend/src/repositories/system.repository.ts) | SystemRole, getSystemRoles |
| [repositories/turno.repository.ts](../backend/src/repositories/turno.repository.ts) | TurnoInsert, insertTurno |
| [repositories/turno-access.repository.ts](../backend/src/repositories/turno-access.repository.ts) | findTurnoSalitasForUser |
| [repositories/turno-agenda.repository.ts](../backend/src/repositories/turno-agenda.repository.ts) | findTurnoOverlap, findOpenTurno, countTurnosDelHorario, findTurnoSanction |
| [repositories/turno-read.repository.ts](../backend/src/repositories/turno-read.repository.ts) | findPatientIdsForTurnoSearch, findTurnoById, findTurnoState, findTurnos |
| [repositories/turno-select.ts](../backend/src/repositories/turno-select.ts) | turnoSelect |
| [repositories/turno-update.repository.ts](../backend/src/repositories/turno-update.repository.ts) | TurnoPatch, patchTurno |
| [repositories/tutor.repository.ts](../backend/src/repositories/tutor.repository.ts) | findTutorByPersonId, createTutor |
| [repositories/tutor-read.repository.ts](../backend/src/repositories/tutor-read.repository.ts) | findTutors, findTutorById, findTutorByDni, findTutorPersonState |
| [repositories/tutor-request.repository.ts](../backend/src/repositories/tutor-request.repository.ts) | createTutorRequest, findTutorRequestsByUser, findTutorRequestsForAdmin, findTutorRequestById, approveTutorRequest, rejectTutorRequest |
| [repositories/tutor-select.ts](../backend/src/repositories/tutor-select.ts) | TutorRow, tutorSelect, flattenTutor |
| [repositories/tutor-update.repository.ts](../backend/src/repositories/tutor-update.repository.ts) | updateTutorStatus |
| [repositories/user.repository.ts](../backend/src/repositories/user.repository.ts) | countUsers, countRoles, UserAccount, CreateUserData, findUserByEmail, findUserByUsername, findRoleByCode, createUser, findUserForLogin, findRoleById, findUserById, registerSuccessfulLogin, findActiveSalitaById, assignUserToSalita, registerFailedLogin, clearExpiredLoginLock, verifyUserEmailDirectly |
| [repositories/zona.repository.ts](../backend/src/repositories/zona.repository.ts) | getAllZonas, getZonaById, createZona, updateZona, deleteZona |

## backend/src / routes

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [routes/access-management.routes.ts](../backend/src/routes/access-management.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/auditoria.routes.ts](../backend/src/routes/auditoria.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/auth.routes.ts](../backend/src/routes/auth.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/barrio.routes.ts](../backend/src/routes/barrio.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/bloqueo-agenda.routes.ts](../backend/src/routes/bloqueo-agenda.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/chatbot.routes.ts](../backend/src/routes/chatbot.routes.ts) | chatbotErrorHandler, chatbotBodyParser |
| [routes/cierre-calendario.routes.ts](../backend/src/routes/cierre-calendario.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/configuracion.routes.ts](../backend/src/routes/configuracion.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/disponibilidad.routes.ts](../backend/src/routes/disponibilidad.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/email-verification.routes.ts](../backend/src/routes/email-verification.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/especialidad.routes.ts](../backend/src/routes/especialidad.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/google-auth.routes.ts](../backend/src/routes/google-auth.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/health.routes.ts](../backend/src/routes/health.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/historia-clinica.routes.ts](../backend/src/routes/historia-clinica.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/historial-turno.routes.ts](../backend/src/routes/historial-turno.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/horario-atencion.routes.ts](../backend/src/routes/horario-atencion.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/index.ts](../backend/src/routes/index.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/notificacion.routes.ts](../backend/src/routes/notificacion.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/notificacion-admin.routes.ts](../backend/src/routes/notificacion-admin.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/password-recovery.routes.ts](../backend/src/routes/password-recovery.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/patient.routes.ts](../backend/src/routes/patient.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/patient-tutor.routes.ts](../backend/src/routes/patient-tutor.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/profesional.routes.ts](../backend/src/routes/profesional.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/profesional-especialidad.routes.ts](../backend/src/routes/profesional-especialidad.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/profesional-salita.routes.ts](../backend/src/routes/profesional-salita.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/public-content.routes.ts](../backend/src/routes/public-content.routes.ts) | publicContentRoutes, adminContentRoutes |
| [routes/reporte.routes.ts](../backend/src/routes/reporte.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/salita.routes.ts](../backend/src/routes/salita.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/salita-barrio.routes.ts](../backend/src/routes/salita-barrio.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/sancion.routes.ts](../backend/src/routes/sancion.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/turno.routes.ts](../backend/src/routes/turno.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/tutor.routes.ts](../backend/src/routes/tutor.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/user.routes.ts](../backend/src/routes/user.routes.ts) | Módulo, configuración o documentación; consultar fuente |
| [routes/zona.routes.ts](../backend/src/routes/zona.routes.ts) | Módulo, configuración o documentación; consultar fuente |

## backend/src / scripts

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [scripts/check-email.ts](../backend/src/scripts/check-email.ts) | Módulo, configuración o documentación; consultar fuente |
| [scripts/create-super-admin.ts](../backend/src/scripts/create-super-admin.ts) | Módulo, configuración o documentación; consultar fuente |
| [scripts/test-email.ts](../backend/src/scripts/test-email.ts) | Pruebas; revisar alcance en el archivo |

## backend/src / services

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [services/access-management.service.ts](../backend/src/services/access-management.service.ts) | AdminFilters, listManagedRecords, correctManagedPerson, changeManagedAccess |
| [services/account.service.ts](../backend/src/services/account.service.ts) | changeOwnUsername, changeOwnPassword |
| [services/account-access.service.ts](../backend/src/services/account-access.service.ts) | assertAccountAccess |
| [services/admin-onboarding.service.ts](../backend/src/services/admin-onboarding.service.ts) | createAdminWithVerification |
| [services/admin-profile.service.ts](../backend/src/services/admin-profile.service.ts) | isAdministrativeRole, completeAdminProfile |
| [services/agenda-confirmacion.service.ts](../backend/src/services/agenda-confirmacion.service.ts) | confirmAgendaProposal |
| [services/agenda-disponibilidad.service.ts](../backend/src/services/agenda-disponibilidad.service.ts) | getAgendaAvailability |
| [services/agenda-impacto.service.ts](../backend/src/services/agenda-impacto.service.ts) | assertNoAgendaAffected, getAgendaImpact |
| [services/agenda-propuesta.service.ts](../backend/src/services/agenda-propuesta.service.ts) | destinationAllowed, generateAgendaProposal |
| [services/auditoria.service.ts](../backend/src/services/auditoria.service.ts) | getAuditorias, getAuditoriaById |
| [services/auth.service.ts](../backend/src/services/auth.service.ts) | registerUser, loginUser |
| [services/auth-profile.service.ts](../backend/src/services/auth-profile.service.ts) | getOwnProfile, completeOwnProfile, getOwnEntity |
| [services/barrio.service.ts](../backend/src/services/barrio.service.ts) | getBarrios, getBarrio, crearBarrio, actualizarBarrio, eliminarBarrio |
| [services/bloqueo-agenda.service.ts](../backend/src/services/bloqueo-agenda.service.ts) | getBloqueos, getBloqueo, crearBloqueo, actualizarBloqueo, eliminarBloqueo |
| [services/booking-restriction.service.ts](../backend/src/services/booking-restriction.service.ts) | assertPatientCanBook |
| [services/calendario-sync.service.ts](../backend/src/services/calendario-sync.service.ts) | sincronizarFeriados, estadoSincronizacion, revisarSincronizacionCalendario |
| [services/chatbot.service.ts](../backend/src/services/chatbot.service.ts) | createChatbotService, replyToChatbot |
| [services/cierre-access.service.ts](../backend/src/services/cierre-access.service.ts) | cierreScope, assertCierreScope, authorizeCierre |
| [services/cierre-calendario.service.ts](../backend/src/services/cierre-calendario.service.ts) | listCierres, notificarCalendario, guardarCierre, desactivarCierre |
| [services/clinical-scope.service.ts](../backend/src/services/clinical-scope.service.ts) | verifyClinicalScope, verifyClinicalResourceScope, verifyClinicalDerivationScope, verifyClinicalAuditScope |
| [services/configuracion.service.ts](../backend/src/services/configuracion.service.ts) | getClinicSpecialtyIds, assertClinicSpecialty, getConfiguraciones, getConfiguracionesPublicas, getConfiguracion, registerConfiguracion, editConfiguracion, getConfiguracionValue |
| [services/configuracion-policy.ts](../backend/src/services/configuracion-policy.ts) | configuracionAdminKeys, assertConfiguracionValue, isSafePublic, assertPublicValue, requireConfiguracionUser, configuracionReadAccess, assertConfiguracionWrite, publicConfiguracion |
| [services/dashboard.service.ts](../backend/src/services/dashboard.service.ts) | getDashboardSummary |
| [services/disponibilidad.service.ts](../backend/src/services/disponibilidad.service.ts) | obtenerDisponibilidad, obtenerDisponibilidadAdministrativa |
| [services/email.service.ts](../backend/src/services/email.service.ts) | sendEmail, sendAuthEmail, sendEmailVerificationCode, sendPasswordRecoveryCode |
| [services/email-change.service.ts](../backend/src/services/email-change.service.ts) | requestEmailChange, confirmEmailChange |
| [services/email-code.service.ts](../backend/src/services/email-code.service.ts) | consumeVerificationCode |
| [services/email-verification.service.ts](../backend/src/services/email-verification.service.ts) | createEmailCode, createVerificationCodeForNewUser, requestEmailVerification, verifyUserEmail, verifyEmailCode, createVerificationForUser, createVerificationForNewUser |
| [services/email-verification-token.service.ts](../backend/src/services/email-verification-token.service.ts) | generateEmailVerificationToken, hashEmailVerificationToken, generateEmailVerificationCode, hashEmailVerificationCode |
| [services/especialidad.service.ts](../backend/src/services/especialidad.service.ts) | getEspecialidades, getEspecialidad, crearEspecialidad, actualizarEspecialidad, eliminarEspecialidad |
| [services/gemini.service.ts](../backend/src/services/gemini.service.ts) | GeminiFunctionalQuery, generateFunctionalReply |
| [services/google-auth.service.ts](../backend/src/services/google-auth.service.ts) | loginWithGoogle |
| [services/google-token.service.ts](../backend/src/services/google-token.service.ts) | VerifiedGoogleUser, verifyGoogleCredential |
| [services/health.service.ts](../backend/src/services/health.service.ts) | checkDatabaseConnection |
| [services/historia-clinica.service.ts](../backend/src/services/historia-clinica.service.ts) | getHistoriaClinica, registrarConsulta, actualizarConsultaBorrador, firmarConsulta, anularConsultaBorrador, getConsultaMedica, getDiagnosticosConsulta, getEvolucionesConsulta, getTratamientosConsulta, getEstudiosConsulta, getAntecedentesPaciente, getAlergiasPaciente, registrarEvolucion, rectificarEvolucion, actualizarEstadoEstudio, informarEstudio, listarDerivaciones, solicitarDerivacion, resolverDerivacion, getAuditoriaClinica, obtenerBorradorTemporal, guardarBorradorTemporal, descartarBorradorTemporal |
| [services/historia-clinica-support.service.ts](../backend/src/services/historia-clinica-support.service.ts) | getHistoriaClinicaContext, searchClinicalPatients |
| [services/historial-turno.service.ts](../backend/src/services/historial-turno.service.ts) | getHistorialByTurno, getHistorialGeneral |
| [services/horario-atencion.service.ts](../backend/src/services/horario-atencion.service.ts) | getHorarios, getHorario, crearHorario, actualizarHorario, eliminarHorario |
| [services/jwt.service.ts](../backend/src/services/jwt.service.ts) | generateAccessToken, verifyAccessToken, generateLoginVerificationToken, verifyLoginVerificationToken |
| [services/login-access.service.ts](../backend/src/services/login-access.service.ts) | validateLoginAccess |
| [services/login-email-verification.service.ts](../backend/src/services/login-email-verification.service.ts) | verifyLoginEmailCode |
| [services/municipal-news.service.ts](../backend/src/services/municipal-news.service.ts) | municipalNews |
| [services/notificacion.service.ts](../backend/src/services/notificacion.service.ts) | sendSystemNotification, getNotificacionesUsuario, getNotificacionUsuario, readNotificacion, readAllNotificaciones |
| [services/notificacion-admin.service.ts](../backend/src/services/notificacion-admin.service.ts) | opcionesEnvio, historialEnvios, detalleEnvio, crearEnvio, editarProgramacion, cancelarProgramacion |
| [services/notificacion-audiencia.service.ts](../backend/src/services/notificacion-audiencia.service.ts) | alcanceNotificaciones, validarAudiencia, resolverDestinatarios |
| [services/notificacion-email-template.service.ts](../backend/src/services/notificacion-email-template.service.ts) | buildNotificacionEmail |
| [services/notificacion-turno.service.ts](../backend/src/services/notificacion-turno.service.ts) | notifyTurnoCreado, notifyTurnoReprogramado, notifyTurnoCancelado, notifyCambioProfesional |
| [services/notificacion-worker.service.ts](../backend/src/services/notificacion-worker.service.ts) | iniciarProcesadorNotificaciones |
| [services/one-time-code.service.ts](../backend/src/services/one-time-code.service.ts) | generateFourDigitCode, hashUserCode |
| [services/own-person.service.ts](../backend/src/services/own-person.service.ts) | editOwnProfile, editOwnPerson |
| [services/password.service.ts](../backend/src/services/password.service.ts) | hashPassword, verifyPassword |
| [services/password-recovery.service.ts](../backend/src/services/password-recovery.service.ts) | requestPasswordRecovery, resetPassword |
| [services/patient.service.ts](../backend/src/services/patient.service.ts) | registerPatient |
| [services/patient-account.service.ts](../backend/src/services/patient-account.service.ts) | linkPatientAccount |
| [services/patient-agenda.service.ts](../backend/src/services/patient-agenda.service.ts) | getPatientProfessionals, getPatientAvailability, getPatientAvailableDates |
| [services/patient-clinical.service.ts](../backend/src/services/patient-clinical.service.ts) | getMyHistoriaClinica |
| [services/patient-coverage.service.ts](../backend/src/services/patient-coverage.service.ts) | getCoveredSalitas, getOwnPatient, resolvePatientSalita, assertOwnCoverage |
| [services/patient-data.ts](../backend/src/services/patient-data.ts) | splitPatientInput |
| [services/patient-managed.service.ts](../backend/src/services/patient-managed.service.ts) | resolveManagedPatient, getManagedPatients |
| [services/patient-read.service.ts](../backend/src/services/patient-read.service.ts) | getPatients, getPatientById, getPatientByDni |
| [services/patient-tutor.service.ts](../backend/src/services/patient-tutor.service.ts) | getPatientTutors, getTutorPatients, editPatientTutorRelation, finishPatientTutorRelation |
| [services/patient-update.service.ts](../backend/src/services/patient-update.service.ts) | editOwnPatient, editPatient, changePatientStatus |
| [services/permission.service.ts](../backend/src/services/permission.service.ts) | getUserPermissions, assertUserPermission |
| [services/person.service.ts](../backend/src/services/person.service.ts) | findOrCreatePerson, validatePersonUpdate, editPerson |
| [services/profesional.service.ts](../backend/src/services/profesional.service.ts) | getProfesionales, getProfesional, crearProfesional, actualizarProfesional, eliminarProfesional |
| [services/profesional-especialidad.service.ts](../backend/src/services/profesional-especialidad.service.ts) | getEspecialidadesProfesional, agregarEspecialidadProfesional, actualizarEspecialidadProfesional, eliminarEspecialidadProfesional |
| [services/profesional-horarios.service.ts](../backend/src/services/profesional-horarios.service.ts) | SlotDisponibilidad, getMisHorariosYDisponibilidad |
| [services/profesional-salita.service.ts](../backend/src/services/profesional-salita.service.ts) | getSalitasProfesional, agregarSalitaProfesional, actualizarSalitaProfesional, eliminarSalitaProfesional |
| [services/profile-role.service.ts](../backend/src/services/profile-role.service.ts) | getProfileRoleInfo |
| [services/public-news.service.ts](../backend/src/services/public-news.service.ts) | publicNews, publicNewsDetail, newsOptions, adminNews, adminNewsDetail, saveNews |
| [services/recovery-token.service.ts](../backend/src/services/recovery-token.service.ts) | generateRecoveryToken, hashRecoveryToken |
| [services/reporte.service.ts](../backend/src/services/reporte.service.ts) | getReporteResumen, getReporteEspecialidades |
| [services/reporte-agenda-diaria.service.ts](../backend/src/services/reporte-agenda-diaria.service.ts) | getAgendaDiaria |
| [services/reporte-agenda-presentacion.ts](../backend/src/services/reporte-agenda-presentacion.ts) | agendaSecciones, agendaHtml |
| [services/reporte-documento.ts](../backend/src/services/reporte-documento.ts) | reportLogo, reportDate, reportTimestamp, reportScopeLabel, reportDocument |
| [services/reporte-excel.service.ts](../backend/src/services/reporte-excel.service.ts) | generateExcel |
| [services/reporte-export.service.ts](../backend/src/services/reporte-export.service.ts) | getReporteExportData, exportReporte, generateReporteFile |
| [services/reporte-pdf.service.ts](../backend/src/services/reporte-pdf.service.ts) | generatePdf |
| [services/reporte-pdf-tabla.ts](../backend/src/services/reporte-pdf-tabla.ts) | drawReporteSections |
| [services/reporte-profesional.service.ts](../backend/src/services/reporte-profesional.service.ts) | getReporteProfesionales |
| [services/reporte-word.service.ts](../backend/src/services/reporte-word.service.ts) | generateWord |
| [services/resfresh-token.services.ts](../backend/src/services/resfresh-token.services.ts) | generateRefreshToken, hashRefreshToken |
| [services/salita.service.ts](../backend/src/services/salita.service.ts) | getSalitas, getSalitasAdministrativas, getSalita, crearSalita, actualizarSalita, eliminarSalita |
| [services/salita-barrio.service.ts](../backend/src/services/salita-barrio.service.ts) | getSalitaBarrios, getBarriosDeSalita, getSalitasDeBarrio, crearSalitaBarrio, actualizarSalitaBarrio, eliminarSalitaBarrio |
| [services/sancion.service.ts](../backend/src/services/sancion.service.ts) | registerSancion, getSancionById, getSanciones, cancelSancion |
| [services/session.service.ts](../backend/src/services/session.service.ts) | createSession, refreshSession, logoutSession |
| [services/socket.service.ts](../backend/src/services/socket.service.ts) | EventoAgenda, initSocketServer, getSocketServer, emitirCambioAgenda, emitirHorarioAtencionActualizado |
| [services/turno.service.ts](../backend/src/services/turno.service.ts) | createTurno |
| [services/turno-access.service.ts](../backend/src/services/turno-access.service.ts) | getTurnoScope, assertTurnoScope |
| [services/turno-agenda.service.ts](../backend/src/services/turno-agenda.service.ts) | validateTurnoAgenda |
| [services/turno-email-template.service.ts](../backend/src/services/turno-email-template.service.ts) | buildTurnoCreadoEmail, buildTurnoCanceladoEmail, buildTurnoReprogramadoEmail, buildCambioProfesionalEmail |
| [services/turno-entities.service.ts](../backend/src/services/turno-entities.service.ts) | validateTurnoEntities |
| [services/turno-read.service.ts](../backend/src/services/turno-read.service.ts) | getTurno, getTurnoState, getTurnos |
| [services/turno-update.service.ts](../backend/src/services/turno-update.service.ts) | updateTurno, changeTurnoStatus |
| [services/tutor.service.ts](../backend/src/services/tutor.service.ts) | validateTutorPerson, registerTutor, registerExistingTutor |
| [services/tutor-read.service.ts](../backend/src/services/tutor-read.service.ts) | getTutors, getTutorById, getTutorByDni |
| [services/tutor-request.service.ts](../backend/src/services/tutor-request.service.ts) | requestTutorLink, getOwnTutorRequests, getAdminTutorRequests, resolveTutorRequest |
| [services/tutor-update.service.ts](../backend/src/services/tutor-update.service.ts) | editTutor, changeTutorStatus |
| [services/user.service.ts](../backend/src/services/user.service.ts) | checkUserModule |
| [services/user.services.ts](../backend/src/services/user.services.ts) | Módulo, configuración o documentación; consultar fuente |
| [services/user-management.service.ts](../backend/src/services/user-management.service.ts) | createAdminAccount, createPatientAccount, createProfessionalAccount |
| [services/zona.service.ts](../backend/src/services/zona.service.ts) | getZonas, getZona, crearZona, actualizarZona, eliminarZona |

## backend/src / types

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [types/auth.types.ts](../backend/src/types/auth.types.ts) | AuthenticatedUser |
| [types/configuracion.types.ts](../backend/src/types/configuracion.types.ts) | ConfiguracionRow, ConfiguracionAccess |
| [types/express.d.ts](../backend/src/types/express.d.ts) | Módulo, configuración o documentación; consultar fuente |
| [types/historia-clinica.types.ts](../backend/src/types/historia-clinica.types.ts) | ClinicalPermission, AntecedenteTipo, AlergiaGravedad, DiagnosticoTipo, ConsultaEstado, EvolucionEstado, TratamientoEstado, EstudioEstado, DerivacionTipo, DerivacionAlcance, DerivacionEstado |
| [types/permission.types.ts](../backend/src/types/permission.types.ts) | CLINICAL_PERMISSIONS, ClinicalPermission |
| [types/public-news.types.ts](../backend/src/types/public-news.types.ts) | PublicNews, AdminNews |
| [types/reporte-agenda.types.ts](../backend/src/types/reporte-agenda.types.ts) | AgendaPaciente, AgendaLista, ReporteSecciones, esReporteSecciones |
| [types/request-metadata.types.ts](../backend/src/types/request-metadata.types.ts) | RequestMetadata |
| [types/turno.types.ts](../backend/src/types/turno.types.ts) | TurnoState, TurnoRow |

## backend/src / utils

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [utils/app-error.ts](../backend/src/utils/app-error.ts) | AppError |
| [utils/booking-window.ts](../backend/src/utils/booking-window.ts) | bookingWindow, assertBookingDate |
| [utils/chatbot-privacy.ts](../backend/src/utils/chatbot-privacy.ts) | normalizeChatbotText, hasSensitiveChatbotData, isMedicalChatbotQuestion |
| [utils/cierre-calendario.ts](../backend/src/utils/cierre-calendario.ts) | cierreAfecta, cierreEtiqueta |
| [utils/duplicate-error.ts](../backend/src/utils/duplicate-error.ts) | duplicateMessages, duplicateError |
| [utils/like-pattern.ts](../backend/src/utils/like-pattern.ts) | literalLikePattern |
| [utils/person-age.ts](../backend/src/utils/person-age.ts) | isAdultOnDate |
| [utils/profile-error.ts](../backend/src/utils/profile-error.ts) | hasDatabaseCode, rethrowPatientError |
| [utils/time.ts](../backend/src/utils/time.ts) | timeToSeconds |
| [utils/turno-error.ts](../backend/src/utils/turno-error.ts) | rethrowTurnoError |
| [utils/turno-time.ts](../backend/src/utils/turno-time.ts) | agendaZone, agendaDateTime, agendaDayBounds |
| [utils/tutor-error.ts](../backend/src/utils/tutor-error.ts) | rethrowTutorError |
| [utils/username-generator.ts](../backend/src/utils/username-generator.ts) | generateUsernameFromEmail |

## backend/src / validators

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [validators/account.validator.ts](../backend/src/validators/account.validator.ts) | usernameUpdateSchema, passwordChangeSchema |
| [validators/agenda-impacto.validator.ts](../backend/src/validators/agenda-impacto.validator.ts) | agendaChangeSchema, agendaProposalSchema, agendaConfirmSchema, AgendaChange, AgendaConfirmation, agendaAvailabilitySchema |
| [validators/auditoria.validator.ts](../backend/src/validators/auditoria.validator.ts) | auditoriaIdSchema, auditoriaQuerySchema, AuditoriaQuery |
| [validators/auth.validator.ts](../backend/src/validators/auth.validator.ts) | registerSchema, RegisterInput, loginSchema, LoginInput, refreshTokenSchema |
| [validators/bloqueo-agenda.validator.ts](../backend/src/validators/bloqueo-agenda.validator.ts) | createBloqueoAgendaSchema, updateBloqueoAgendaSchema, CreateBloqueoAgendaInput, UpdateBloqueoAgendaInput |
| [validators/catalogo.validator.ts](../backend/src/validators/catalogo.validator.ts) | createZonaSchema, createBarrioSchema, createEspecialidadSchema, createSalitaSchema, createCoberturaSchema, updateZonaSchema, updateBarrioSchema, updateEspecialidadSchema, updateSalitaSchema, updateCoberturaSchema |
| [validators/chatbot.validator.ts](../backend/src/validators/chatbot.validator.ts) | chatbotMessageSchema |
| [validators/cierre-calendario.validator.ts](../backend/src/validators/cierre-calendario.validator.ts) | tiposCierre, cierreSchema, CierreInput, Cierre, datosCierre |
| [validators/configuracion.validator.ts](../backend/src/validators/configuracion.validator.ts) | configuracionClaveSchema, configuracionQuerySchema, configuracionClaveParamsSchema, configuracionIdParamsSchema, createConfiguracionSchema, updateConfiguracionSchema, ConfiguracionQuery, CreateConfiguracionInput, UpdateConfiguracionInput, ConfiguracionValor |
| [validators/disponibilidad.validator.ts](../backend/src/validators/disponibilidad.validator.ts) | disponibilidadQuerySchema, DisponibilidadQuery, disponibilidadAdminQuerySchema |
| [validators/email-verification.validators.ts](../backend/src/validators/email-verification.validators.ts) | requestEmailVerificationSchema, verifyEmailSchema, verifyEmailCodeSchema, RequestEmailVerificationInput, VerifyEmailInput, VerifyEmailCodeInput |
| [validators/field-rules.ts](../backend/src/validators/field-rules.ts) | namePattern, nameCharacters, phonePattern, phoneCharacters, dniPattern, licensePattern, licenseCharacters, usernamePattern, fieldMessages |
| [validators/google-auth.validator.ts](../backend/src/validators/google-auth.validator.ts) | googleLoginSchema, GoogleLoginInput |
| [validators/historial-turno.validator.ts](../backend/src/validators/historial-turno.validator.ts) | historialTurnoParamsSchema, historialTurnoQuerySchema, HistorialTurnoParams, HistorialTurnoQuery |
| [validators/horario-atencion.validator.ts](../backend/src/validators/horario-atencion.validator.ts) | horaSchema, createHorarioAtencionSchema, updateHorarioAtencionSchema, CreateHorarioAtencionInput, UpdateHorarioAtencionInput |
| [validators/horario-rules.ts](../backend/src/validators/horario-rules.ts) | validarHorario |
| [validators/news-schedule.ts](../backend/src/validators/news-schedule.ts) | newsScheduleError |
| [validators/notificacion.validator.ts](../backend/src/validators/notificacion.validator.ts) | notificacionIdSchema, notificacionQuerySchema, createNotificacionSchema, NotificacionQuery, CreateNotificacionInput |
| [validators/notificacion-admin.validator.ts](../backend/src/validators/notificacion-admin.validator.ts) | audienciaSchema, previewNotificacionSchema, buscarDestinatariosSchema, crearEnvioSchema, historialEnviosSchema, editarEnvioSchema, EditarEnvio, Audiencia, CrearEnvio |
| [validators/password-recovery.validator.ts](../backend/src/validators/password-recovery.validator.ts) | forgotPasswordSchema, newPasswordSchema, resetPasswordSchema, ForgotPasswordInput, ResetPasswordInput |
| [validators/patient.validator.ts](../backend/src/validators/patient.validator.ts) | patientProfileSchema, createPatientSchema, PatientProfileInput, CreatePatientInput, updatePatientProfileSchema, UpdatePatientProfileInput |
| [validators/patient-query.validator.ts](../backend/src/validators/patient-query.validator.ts) | patientIdSchema, patientDniSchema, patientListQuerySchema, PatientListQuery |
| [validators/patient-tutor.validator.ts](../backend/src/validators/patient-tutor.validator.ts) | updatePatientTutorSchema, patientTutorParamsSchema, patientIdParamSchema, tutorIdParamSchema, UpdatePatientTutorInput |
| [validators/patient-update.validator.ts](../backend/src/validators/patient-update.validator.ts) | updatePatientSchema, patientStatusSchema, UpdatePatientInput, PatientStatusInput, ownPatientUpdateSchema |
| [validators/person.validator.ts](../backend/src/validators/person.validator.ts) | personNameSchema, contactNameSchema, personPhoneSchema, personEmailSchema, personDniSchema, personSexSchema, personBirthDateSchema, personAddressSchema, createPersonSchema, updatePersonSchema, ownPersonUpdateSchema, completePersonSchema, CompletePersonInput, CreatePersonInput, UpdatePersonInput |
| [validators/profesional.validator.ts](../backend/src/validators/profesional.validator.ts) | createProfesionalSchema, updateProfesionalSchema, CreateProfesionalInput, UpdateProfesionalInput |
| [validators/profesional-especialidad.validator.ts](../backend/src/validators/profesional-especialidad.validator.ts) | createProfesionalEspecialidadSchema, updateProfesionalEspecialidadSchema, CreateProfesionalEspecialidadInput, UpdateProfesionalEspecialidadInput |
| [validators/profesional-salita.validator.ts](../backend/src/validators/profesional-salita.validator.ts) | createProfesionalSalitaSchema, updateProfesionalSalitaSchema, CreateProfesionalSalitaInput, UpdateProfesionalSalitaInput |
| [validators/public-news.validator.ts](../backend/src/validators/public-news.validator.ts) | newsId, newsQuery, newsInput, NewsInput, NewsQuery |
| [validators/reporte.validator.ts](../backend/src/validators/reporte.validator.ts) | reporteQuerySchema, reporteFormatoSchema, reporteTipoSchema, reporteExportQuerySchema, ReporteExportQuery, ReporteQuery, reporteAgendaQuerySchema, reporteAgendaExportSchema, ReporteAgendaQuery |
| [validators/sancion.validator.ts](../backend/src/validators/sancion.validator.ts) | createSancionSchema, sancionIdSchema, anularSancionSchema, sancionQuerySchema, CreateSancionInput, SancionQuery |
| [validators/turno.validator.ts](../backend/src/validators/turno.validator.ts) | turnoFields, createTurnoSchema, CreateTurnoInput |
| [validators/turno-query.validator.ts](../backend/src/validators/turno-query.validator.ts) | turnoIdSchema, turnoEstadoSchema, turnoQuerySchema, TurnoQuery |
| [validators/turno-update.validator.ts](../backend/src/validators/turno-update.validator.ts) | updateTurnoSchema, turnoStatusSchema, UpdateTurnoInput, TurnoStatusInput |
| [validators/tutor.validator.ts](../backend/src/validators/tutor.validator.ts) | createTutorSchema, CreateTutorInput |
| [validators/tutor-query.validator.ts](../backend/src/validators/tutor-query.validator.ts) | tutorIdSchema, tutorDniSchema, tutorListQuerySchema, TutorListQuery |
| [validators/tutor-request.validator.ts](../backend/src/validators/tutor-request.validator.ts) | createTutorRequestSchema, resolveTutorRequestSchema, CreateTutorRequestInput, ResolveTutorRequestInput |
| [validators/tutor-update.validator.ts](../backend/src/validators/tutor-update.validator.ts) | updateTutorSchema, tutorStatusSchema, UpdateTutorInput |
| [validators/user.validator.ts](../backend/src/validators/user.validator.ts) | createAdminSchema, createPatientAccountSchema, createProfessionalAccountSchema, CreateAdminInput, CreatePatientAccountInput, CreateProfessionalAccountInput |

## backend/tests / (raíz)

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [AGENDA_DIARIA.md](../backend/tests/AGENDA_DIARIA.md) | Módulo, configuración o documentación; consultar fuente |
| [agenda-diaria.test.ts](../backend/tests/agenda-diaria.test.ts) | Pruebas; revisar alcance en el archivo |
| [agenda-diaria-fixtures.ts](../backend/tests/agenda-diaria-fixtures.ts) | id, other, user, row, queue, drained, auth, scope, data, curl |
| [api-smoke.mjs](../backend/tests/api-smoke.mjs) | Módulo, configuración o documentación; consultar fuente |
| [booking-policy.test.ts](../backend/tests/booking-policy.test.ts) | Pruebas; revisar alcance en el archivo |
| [configuracion.test.ts](../backend/tests/configuracion.test.ts) | Pruebas; revisar alcance en el archivo |
| [configuracion-fixtures.ts](../backend/tests/configuracion-fixtures.ts) | id, other, user, row, local, auth, scope, config, checked, curl |
| [dashboard.test.ts](../backend/tests/dashboard.test.ts) | Pruebas; revisar alcance en el archivo |
| [email-verification.test.ts](../backend/tests/email-verification.test.ts) | Pruebas; revisar alcance en el archivo |
| [historial-turno.test.ts](../backend/tests/historial-turno.test.ts) | Pruebas; revisar alcance en el archivo |
| [integration.test.ts](../backend/tests/integration.test.ts) | Pruebas; revisar alcance en el archivo |
| [news-schedule.test.ts](../backend/tests/news-schedule.test.ts) | Pruebas; revisar alcance en el archivo |
| [patient.test.ts](../backend/tests/patient.test.ts) | Pruebas; revisar alcance en el archivo |
| [patient-fixtures.ts](../backend/tests/patient-fixtures.ts) | input, person, row, queue, drained, conflict |
| [patient-live.mjs](../backend/tests/patient-live.mjs) | Módulo, configuración o documentación; consultar fuente |
| [patient-live-results.json](../backend/tests/patient-live-results.json) | Módulo, configuración o documentación; consultar fuente |
| [patient-tutor-validation.test.ts](../backend/tests/patient-tutor-validation.test.ts) | Pruebas; revisar alcance en el archivo |
| [PERSONAS_PACIENTES_BBDD3.md](../backend/tests/PERSONAS_PACIENTES_BBDD3.md) | Módulo, configuración o documentación; consultar fuente |
| [reporte.test.ts](../backend/tests/reporte.test.ts) | Pruebas; revisar alcance en el archivo |
| [salita-admin.test.ts](../backend/tests/salita-admin.test.ts) | Pruebas; revisar alcance en el archivo |
| [sancion.test.ts](../backend/tests/sancion.test.ts) | Pruebas; revisar alcance en el archivo |
| [turno-agenda.test.ts](../backend/tests/turno-agenda.test.ts) | Pruebas; revisar alcance en el archivo |
| [turno-fixtures.ts](../backend/tests/turno-fixtures.ts) | id, user, input, state, horario, turno, entities, freeSlot |
| [turno-http.test.ts](../backend/tests/turno-http.test.ts) | Pruebas; revisar alcance en el archivo |
| [turno-live.mjs](../backend/tests/turno-live.mjs) | Módulo, configuración o documentación; consultar fuente |
| [turno-live-results.json](../backend/tests/turno-live-results.json) | Módulo, configuración o documentación; consultar fuente |
| [turno-live-support.mjs](../backend/tests/turno-live-support.mjs) | Módulo, configuración o documentación; consultar fuente |
| [TURNOS.md](../backend/tests/TURNOS.md) | Módulo, configuración o documentación; consultar fuente |
| [turno-update.test.ts](../backend/tests/turno-update.test.ts) | Pruebas; revisar alcance en el archivo |
| [tutor.test.ts](../backend/tests/tutor.test.ts) | Pruebas; revisar alcance en el archivo |
| [tutor-live.mjs](../backend/tests/tutor-live.mjs) | Módulo, configuración o documentación; consultar fuente |
| [tutor-live-results.json](../backend/tests/tutor-live-results.json) | Módulo, configuración o documentación; consultar fuente |
| [tutor-live-support.mjs](../backend/tests/tutor-live-support.mjs) | Módulo, configuración o documentación; consultar fuente |
| [tutor-request.test.ts](../backend/tests/tutor-request.test.ts) | Pruebas; revisar alcance en el archivo |

## frontend/src / (raíz)

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [App.css](../frontend/src/App.css) | Recurso visual o estilos |
| [App.tsx](../frontend/src/App.tsx) | Módulo, configuración o documentación; consultar fuente |
| [index.css](../frontend/src/index.css) | Recurso visual o estilos |
| [main.tsx](../frontend/src/main.tsx) | Módulo, configuración o documentación; consultar fuente |

## frontend/src / assets

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [assets/hero.png](../frontend/src/assets/hero.png) | Recurso visual o estilos |
| [assets/react.svg](../frontend/src/assets/react.svg) | Recurso visual o estilos |
| [assets/vite.svg](../frontend/src/assets/vite.svg) | Recurso visual o estilos |

## frontend/src / components

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [components/chatbot/Chatbot.tsx](../frontend/src/components/chatbot/Chatbot.tsx) | Chatbot |
| [components/chatbot/useChatbotLauncher.ts](../frontend/src/components/chatbot/useChatbotLauncher.ts) | useChatbotLauncher |
| [components/layout/AppLayout.tsx](../frontend/src/components/layout/AppLayout.tsx) | Módulo, configuración o documentación; consultar fuente |
| [components/layout/MobileBottomNav.tsx](../frontend/src/components/layout/MobileBottomNav.tsx) | MobileBottomNav |
| [components/layout/Navbar.tsx](../frontend/src/components/layout/Navbar.tsx) | Módulo, configuración o documentación; consultar fuente |
| [components/layout/NotificationBell.tsx](../frontend/src/components/layout/NotificationBell.tsx) | NotificationBell |
| [components/layout/Sidebar.tsx](../frontend/src/components/layout/Sidebar.tsx) | Módulo, configuración o documentación; consultar fuente |
| [components/layout/SidebarItem.tsx](../frontend/src/components/layout/SidebarItem.tsx) | Módulo, configuración o documentación; consultar fuente |
| [components/layout/sidebar-menu.ts](../frontend/src/components/layout/sidebar-menu.ts) | SidebarMenuItem, sidebarMenu, getMenuForRole, roleLabels, configurationMenu |
| [components/notificaciones/AccionesProgramacion.tsx](../frontend/src/components/notificaciones/AccionesProgramacion.tsx) | AccionesProgramacion |
| [components/notificaciones/AudienciaSelector.tsx](../frontend/src/components/notificaciones/AudienciaSelector.tsx) | AudienciaSelector |
| [components/notificaciones/NotificacionesNav.tsx](../frontend/src/components/notificaciones/NotificacionesNav.tsx) | fechaNotificacion, EstadoEnvio, NotificacionesNav |
| [components/profesionales/AsignacionVigencia.tsx](../frontend/src/components/profesionales/AsignacionVigencia.tsx) | AsignacionVigencia |
| [components/profesionales/ProfesionalForm.tsx](../frontend/src/components/profesionales/ProfesionalForm.tsx) | ProfessionalFormData |
| [components/profesionales/ProfessionalAccessAccount.tsx](../frontend/src/components/profesionales/ProfessionalAccessAccount.tsx) | ProfessionalAccessAccount |
| [components/profesionales/WeeklyScheduleFields.tsx](../frontend/src/components/profesionales/WeeklyScheduleFields.tsx) | WeeklyScheduleFields |
| [components/public/HowItWorks.tsx](../frontend/src/components/public/HowItWorks.tsx) | HowItWorks |
| [components/public/MunicipalNewsSection.tsx](../frontend/src/components/public/MunicipalNewsSection.tsx) | MunicipalNewsSection |
| [components/public/NewsCard.tsx](../frontend/src/components/public/NewsCard.tsx) | newsDate, NewsCard |
| [components/public/NewsEditorFields.tsx](../frontend/src/components/public/NewsEditorFields.tsx) | NewsEditorFields |
| [components/public/PublicCarousel.tsx](../frontend/src/components/public/PublicCarousel.tsx) | PublicCarousel, InformationalCarousel |
| [components/public/PublicHero.tsx](../frontend/src/components/public/PublicHero.tsx) | PublicHero |
| [components/public/PublicLayout.tsx](../frontend/src/components/public/PublicLayout.tsx) | PublicLayout |
| [components/public/PublicSalitasSection.tsx](../frontend/src/components/public/PublicSalitasSection.tsx) | PublicSalitasSection |
| [components/public/ResourceState.tsx](../frontend/src/components/public/ResourceState.tsx) | ResourceState |
| [components/public/SapsNewsSection.tsx](../frontend/src/components/public/SapsNewsSection.tsx) | SapsNewsSection |
| [components/salitas/SalitaForm.tsx](../frontend/src/components/salitas/SalitaForm.tsx) | Módulo, configuración o documentación; consultar fuente |
| [components/turnos/AbsenceForm.tsx](../frontend/src/components/turnos/AbsenceForm.tsx) | AbsenceForm |
| [components/turnos/AbsenceList.tsx](../frontend/src/components/turnos/AbsenceList.tsx) | AbsenceList |
| [components/turnos/AbsenceSchedule.tsx](../frontend/src/components/turnos/AbsenceSchedule.tsx) | AbsenceSchedule |
| [components/turnos/AgendaAffectedList.tsx](../frontend/src/components/turnos/AgendaAffectedList.tsx) | AgendaAffectedList |
| [components/turnos/AgendaImpactPanel.tsx](../frontend/src/components/turnos/AgendaImpactPanel.tsx) | AgendaImpactPanel |
| [components/turnos/AgendaQuickRow.tsx](../frontend/src/components/turnos/AgendaQuickRow.tsx) | AgendaQuickRow |
| [components/turnos/AgendaReview.tsx](../frontend/src/components/turnos/AgendaReview.tsx) | AgendaReview |
| [components/turnos/CalendarioSyncPanel.tsx](../frontend/src/components/turnos/CalendarioSyncPanel.tsx) | CalendarioSyncPanel |
| [components/turnos/CierreForm.tsx](../frontend/src/components/turnos/CierreForm.tsx) | CierreForm |
| [components/turnos/ProfessionalCalendar.tsx](../frontend/src/components/turnos/ProfessionalCalendar.tsx) | ProfessionalCalendar |
| [components/turnos/ProfessionalTurnoHistory.tsx](../frontend/src/components/turnos/ProfessionalTurnoHistory.tsx) | ProfessionalTurnoHistory |
| [components/turnos/useAbsenceForm.ts](../frontend/src/components/turnos/useAbsenceForm.ts) | useAbsenceForm |
| [components/ui/AccessManagementPanel.tsx](../frontend/src/components/ui/AccessManagementPanel.tsx) | AccessManagementPanel |
| [components/ui/AccessNoticeModal.tsx](../frontend/src/components/ui/AccessNoticeModal.tsx) | AccessNoticeModal |
| [components/ui/AccountEmailForm.tsx](../frontend/src/components/ui/AccountEmailForm.tsx) | AccountEmailForm |
| [components/ui/AccountPasswordForm.tsx](../frontend/src/components/ui/AccountPasswordForm.tsx) | AccountPasswordForm |
| [components/ui/AccountSecuritySection.tsx](../frontend/src/components/ui/AccountSecuritySection.tsx) | AccountSecuritySection |
| [components/ui/AccountSummary.tsx](../frontend/src/components/ui/AccountSummary.tsx) | AccountSummary |
| [components/ui/AccountUsernameForm.tsx](../frontend/src/components/ui/AccountUsernameForm.tsx) | AccountUsernameForm |
| [components/ui/AdminAccounts.tsx](../frontend/src/components/ui/AdminAccounts.tsx) | AdminAccounts |
| [components/ui/AgendaLiveToast.tsx](../frontend/src/components/ui/AgendaLiveToast.tsx) | AgendaLiveToasts, AgendaSocketStatusBadge |
| [components/ui/CancelAppointment.tsx](../frontend/src/components/ui/CancelAppointment.tsx) | CancelAppointment |
| [components/ui/ConfirmationModal.tsx](../frontend/src/components/ui/ConfirmationModal.tsx) | ConfirmationModalVariant, ConfirmationModal |
| [components/ui/ManagedPatientSelector.tsx](../frontend/src/components/ui/ManagedPatientSelector.tsx) | ManagedPatientSelector |
| [components/ui/PatientAccountPanel.tsx](../frontend/src/components/ui/PatientAccountPanel.tsx) | PatientAccountPanel |
| [components/ui/PatientBookingForm.tsx](../frontend/src/components/ui/PatientBookingForm.tsx) | PatientBookingForm |
| [components/ui/PatientBookingSlots.tsx](../frontend/src/components/ui/PatientBookingSlots.tsx) | PatientBookingSlots |
| [components/ui/PatientCoverageCard.tsx](../frontend/src/components/ui/PatientCoverageCard.tsx) | PatientCoverageCard |
| [components/ui/PatientProfileForm.tsx](../frontend/src/components/ui/PatientProfileForm.tsx) | PatientProfileForm |
| [components/ui/PatientTutorsPanel.tsx](../frontend/src/components/ui/PatientTutorsPanel.tsx) | PatientTutorsPanel |
| [components/ui/PersonalProfileForm.tsx](../frontend/src/components/ui/PersonalProfileForm.tsx) | PersonalProfileForm |
| [components/ui/PersonProfileFields.tsx](../frontend/src/components/ui/PersonProfileFields.tsx) | PersonProfileFields |
| [components/ui/PrivacyBanner.tsx](../frontend/src/components/ui/PrivacyBanner.tsx) | PrivacyBanner |
| [components/ui/PrivacyNotice.tsx](../frontend/src/components/ui/PrivacyNotice.tsx) | PrivacyDetails, PrivacyPolicyLink, PrivacyNoticeActions |
| [components/ui/PrivacySection.tsx](../frontend/src/components/ui/PrivacySection.tsx) | PrivacySection |
| [components/ui/ProfileInfoCard.tsx](../frontend/src/components/ui/ProfileInfoCard.tsx) | ProfileInfoCard |
| [components/ui/TurnoCard.tsx](../frontend/src/components/ui/TurnoCard.tsx) | TurnoCard |
| [components/ui/ValidatedInput.tsx](../frontend/src/components/ui/ValidatedInput.tsx) | ValidatedInput |
| [components/ui/ZonaBarrioSelect.tsx](../frontend/src/components/ui/ZonaBarrioSelect.tsx) | ZonaBarrioSelect |

## frontend/src / context

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [context/AgendaSocketContext.tsx](../frontend/src/context/AgendaSocketContext.tsx) | useAgendaSocket, AgendaSocketProvider |
| [context/AuthContext.tsx](../frontend/src/context/AuthContext.tsx) | AuthProvider, useAuth |
| [context/useManagedPatients.ts](../frontend/src/context/useManagedPatients.ts) | useManagedPatients |
| [context/usePatientCoverage.ts](../frontend/src/context/usePatientCoverage.ts) | coveredClinics, usePatientCoverage |
| [context/usePrivacyNotice.ts](../frontend/src/context/usePrivacyNotice.ts) | usePrivacyNotice |
| [context/usePublicResource.ts](../frontend/src/context/usePublicResource.ts) | usePublicResource |

## frontend/src / pages

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [pages/auth/AccountManagementPage.tsx](../frontend/src/pages/auth/AccountManagementPage.tsx) | AccountManagementPage |
| [pages/auth/AdminProfilePage.tsx](../frontend/src/pages/auth/AdminProfilePage.tsx) | AdminProfilePage |
| [pages/auth/AuthForm.tsx](../frontend/src/pages/auth/AuthForm.tsx) | AuthForm |
| [pages/auth/CompleteAdminProfilePage.tsx](../frontend/src/pages/auth/CompleteAdminProfilePage.tsx) | CompleteAdminProfilePage |
| [pages/auth/CompletePatientProfilePage.tsx](../frontend/src/pages/auth/CompletePatientProfilePage.tsx) | CompletePatientProfilePage |
| [pages/auth/FourDigitCodeInput.tsx](../frontend/src/pages/auth/FourDigitCodeInput.tsx) | FourDigitCodeInput |
| [pages/auth/GoogleButton.tsx](../frontend/src/pages/auth/GoogleButton.tsx) | GoogleButton |
| [pages/auth/Login.tsx](../frontend/src/pages/auth/Login.tsx) | Módulo, configuración o documentación; consultar fuente |
| [pages/auth/PasswordInput.tsx](../frontend/src/pages/auth/PasswordInput.tsx) | PasswordInput |
| [pages/auth/PasswordRecoveryPage.tsx](../frontend/src/pages/auth/PasswordRecoveryPage.tsx) | PasswordRecoveryPage |
| [pages/auth/PrivacyPolicyPage.tsx](../frontend/src/pages/auth/PrivacyPolicyPage.tsx) | PrivacyPolicyPage |
| [pages/auth/RegisterPage.tsx](../frontend/src/pages/auth/RegisterPage.tsx) | RegisterPage |
| [pages/auth/VerifyEmailCodePage.tsx](../frontend/src/pages/auth/VerifyEmailCodePage.tsx) | VerifyEmailCodePage |
| [pages/configuracion/BloqueosPage.tsx](../frontend/src/pages/configuracion/BloqueosPage.tsx) | BloqueosPage |
| [pages/configuracion/CatalogoPage.tsx](../frontend/src/pages/configuracion/CatalogoPage.tsx) | CatalogoPage |
| [pages/configuracion/CierresPage.tsx](../frontend/src/pages/configuracion/CierresPage.tsx) | CierresPage |
| [pages/configuracion/CoberturaPage.tsx](../frontend/src/pages/configuracion/CoberturaPage.tsx) | CoberturaPage |
| [pages/configuracion/HorariosPage.tsx](../frontend/src/pages/configuracion/HorariosPage.tsx) | HorariosPage |
| [pages/configuracion/ParametrosPage.tsx](../frontend/src/pages/configuracion/ParametrosPage.tsx) | ParametrosPage |
| [pages/contenido/NewsAdminPage.tsx](../frontend/src/pages/contenido/NewsAdminPage.tsx) | NewsAdminPage |
| [pages/contenido/NewsEditorPage.tsx](../frontend/src/pages/contenido/NewsEditorPage.tsx) | NewsEditorPage |
| [pages/dashboard/ConfiguracionPage.tsx](../frontend/src/pages/dashboard/ConfiguracionPage.tsx) | ConfiguracionPage |
| [pages/dashboard/Dashboard.tsx](../frontend/src/pages/dashboard/Dashboard.tsx) | Dashboard |
| [pages/dashboard/SuperAdminOverview.tsx](../frontend/src/pages/dashboard/SuperAdminOverview.tsx) | SuperAdminOverview |
| [pages/historia-clinica/AuditoriaClinicaPage.tsx](../frontend/src/pages/historia-clinica/AuditoriaClinicaPage.tsx) | AuditoriaClinicaPage |
| [pages/historia-clinica/ConsultaDetallePage.tsx](../frontend/src/pages/historia-clinica/ConsultaDetallePage.tsx) | ConsultaDetallePage |
| [pages/historia-clinica/DerivacionesClinicasPage.tsx](../frontend/src/pages/historia-clinica/DerivacionesClinicasPage.tsx) | DerivacionesClinicasPage |
| [pages/historia-clinica/HistoriaClinicaBuscadorPage.tsx](../frontend/src/pages/historia-clinica/HistoriaClinicaBuscadorPage.tsx) | HistoriaClinicaBuscadorPage |
| [pages/historia-clinica/HistoriaClinicaPacientePage.tsx](../frontend/src/pages/historia-clinica/HistoriaClinicaPacientePage.tsx) | HistoriaClinicaPacientePage |
| [pages/historia-clinica/NuevaConsultaPage.tsx](../frontend/src/pages/historia-clinica/NuevaConsultaPage.tsx) | NuevaConsultaPage |
| [pages/notificaciones/DetalleNotificacionPage.tsx](../frontend/src/pages/notificaciones/DetalleNotificacionPage.tsx) | DetalleNotificacionPage |
| [pages/notificaciones/HistorialNotificacionesPage.tsx](../frontend/src/pages/notificaciones/HistorialNotificacionesPage.tsx) | HistorialNotificacionesPage |
| [pages/notificaciones/MisNotificacionesPage.tsx](../frontend/src/pages/notificaciones/MisNotificacionesPage.tsx) | MisNotificacionesPage |
| [pages/notificaciones/NuevaNotificacionPage.tsx](../frontend/src/pages/notificaciones/NuevaNotificacionPage.tsx) | NuevaNotificacionPage |
| [pages/pacientes/MiHistoriaClinicaPage.tsx](../frontend/src/pages/pacientes/MiHistoriaClinicaPage.tsx) | MiHistoriaClinicaPage |
| [pages/pacientes/MiPerfilPage.tsx](../frontend/src/pages/pacientes/MiPerfilPage.tsx) | MiPerfilPage |
| [pages/pacientes/NuevoPacientePage.tsx](../frontend/src/pages/pacientes/NuevoPacientePage.tsx) | Módulo, configuración o documentación; consultar fuente |
| [pages/pacientes/PacienteDetallePage.tsx](../frontend/src/pages/pacientes/PacienteDetallePage.tsx) | Módulo, configuración o documentación; consultar fuente |
| [pages/pacientes/PacientesPage.tsx](../frontend/src/pages/pacientes/PacientesPage.tsx) | Módulo, configuración o documentación; consultar fuente |
| [pages/pacientes/PersonasACargoPage.tsx](../frontend/src/pages/pacientes/PersonasACargoPage.tsx) | PersonasACargoPage |
| [pages/pacientes/SolicitudesVinculacionPage.tsx](../frontend/src/pages/pacientes/SolicitudesVinculacionPage.tsx) | SolicitudesVinculacionPage |
| [pages/profesionales/EditarProfesionalPage.tsx](../frontend/src/pages/profesionales/EditarProfesionalPage.tsx) | Módulo, configuración o documentación; consultar fuente |
| [pages/profesionales/MisHorariosPage.tsx](../frontend/src/pages/profesionales/MisHorariosPage.tsx) | MisHorariosPage |
| [pages/profesionales/NuevoProfesionalPage.tsx](../frontend/src/pages/profesionales/NuevoProfesionalPage.tsx) | Módulo, configuración o documentación; consultar fuente |
| [pages/profesionales/ProfesionalDetallePage.tsx](../frontend/src/pages/profesionales/ProfesionalDetallePage.tsx) | Módulo, configuración o documentación; consultar fuente |
| [pages/profesionales/ProfesionalesPage.tsx](../frontend/src/pages/profesionales/ProfesionalesPage.tsx) | Módulo, configuración o documentación; consultar fuente |
| [pages/public/PublicHomePage.tsx](../frontend/src/pages/public/PublicHomePage.tsx) | PublicHomePage |
| [pages/public/PublicNewsDetailPage.tsx](../frontend/src/pages/public/PublicNewsDetailPage.tsx) | PublicNewsDetailPage |
| [pages/reportes/ReportesPage.tsx](../frontend/src/pages/reportes/ReportesPage.tsx) | Módulo, configuración o documentación; consultar fuente |
| [pages/salitas/EditarSalitaPage.tsx](../frontend/src/pages/salitas/EditarSalitaPage.tsx) | Módulo, configuración o documentación; consultar fuente |
| [pages/salitas/NuevaSalitaPage.tsx](../frontend/src/pages/salitas/NuevaSalitaPage.tsx) | Módulo, configuración o documentación; consultar fuente |
| [pages/salitas/SalitaDetallePage.tsx](../frontend/src/pages/salitas/SalitaDetallePage.tsx) | Módulo, configuración o documentación; consultar fuente |
| [pages/salitas/SalitasPage.tsx](../frontend/src/pages/salitas/SalitasPage.tsx) | Módulo, configuración o documentación; consultar fuente |
| [pages/turnos/MisTurnosPage.tsx](../frontend/src/pages/turnos/MisTurnosPage.tsx) | MisTurnosPage |
| [pages/turnos/NuevoTurnoPage.tsx](../frontend/src/pages/turnos/NuevoTurnoPage.tsx) | Módulo, configuración o documentación; consultar fuente |
| [pages/turnos/PatientAppointmentDetailPage.tsx](../frontend/src/pages/turnos/PatientAppointmentDetailPage.tsx) | PatientAppointmentDetailPage |
| [pages/turnos/PatientAppointmentsPage.tsx](../frontend/src/pages/turnos/PatientAppointmentsPage.tsx) | PatientAppointmentsPage |
| [pages/turnos/ReprogramarTurnoPage.tsx](../frontend/src/pages/turnos/ReprogramarTurnoPage.tsx) | Módulo, configuración o documentación; consultar fuente |
| [pages/turnos/SolicitarTurnoPage.tsx](../frontend/src/pages/turnos/SolicitarTurnoPage.tsx) | SolicitarTurnoPage |
| [pages/turnos/TurnoDetallePage.tsx](../frontend/src/pages/turnos/TurnoDetallePage.tsx) | Módulo, configuración o documentación; consultar fuente |
| [pages/turnos/TurnosPage.tsx](../frontend/src/pages/turnos/TurnosPage.tsx) | Módulo, configuración o documentación; consultar fuente |

## frontend/src / routes

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [routes/AppRoutes.tsx](../frontend/src/routes/AppRoutes.tsx) | Módulo, configuración o documentación; consultar fuente |
| [routes/ProtectedRoute.tsx](../frontend/src/routes/ProtectedRoute.tsx) | Módulo, configuración o documentación; consultar fuente |

## frontend/src / services

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [services/access-management.service.ts](../frontend/src/services/access-management.service.ts) | ManagedAccount, ManagedPage, getManagedAccounts, setManagedAccountStatus, correctManagedPerson |
| [services/agenda-impacto.service.ts](../frontend/src/services/agenda-impacto.service.ts) | AgendaChange, AffectedTurno, AgendaProposal, AgendaResult, getAgendaAvailability, isAgendaConflict, getAgendaImpact, getAgendaProposal, confirmAgendaProposal |
| [services/api.ts](../frontend/src/services/api.ts) | Módulo, configuración o documentación; consultar fuente |
| [services/auth.service.ts](../frontend/src/services/auth.service.ts) | updateOwnProfile, login, refreshSession, logout, registerPatient, loginWithGoogle, requestPasswordRecovery, resetPassword, verifyEmail, requestEmailVerification, getProfile, changeUsername, changePassword, requestEmailChange, confirmEmailChange, completeProfile, completePatientProfile, createInternalAccount |
| [services/auth-api.ts](../frontend/src/services/auth-api.ts) | Módulo, configuración o documentación; consultar fuente |
| [services/barrios.service.ts](../frontend/src/services/barrios.service.ts) | getBarrios |
| [services/chatbot.service.ts](../frontend/src/services/chatbot.service.ts) | sendChatbotMessage, observeChatbotLogout, chatbotErrorMessage |
| [services/cierre-calendario.service.ts](../frontend/src/services/cierre-calendario.service.ts) | getCierres, guardarCierre, desactivarCierre, getCalendarioSync, sincronizarFeriados |
| [services/configuracion.service.ts](../frontend/src/services/configuracion.service.ts) | getZonas, getCatalogo, guardarCatalogo, getCoberturas, guardarCobertura, getHorarios, guardarHorario, getBloqueos, guardarBloqueo, getParametros, getSalitasConfigurables, guardarParametro |
| [services/dashboard.service.ts](../frontend/src/services/dashboard.service.ts) | DashboardTotals, DashboardSummary, getDashboardSummary |
| [services/especialidades.service.ts](../frontend/src/services/especialidades.service.ts) | getSpecialties |
| [services/historia-clinica.service.ts](../frontend/src/services/historia-clinica.service.ts) | getHistoriaClinicaContext, searchClinicalPatients, getHistoriaClinicaPaciente, getMiHistoriaClinica, getConsultaMedicaById, registrarConsultaClinica, actualizarConsultaBorrador, firmarConsultaMedica, anularConsultaBorrador, obtenerBorradorTemporal, guardarBorradorTemporal, descartarBorradorTemporal, registrarEvolucionClinica, rectificarEvolucionClinica, actualizarEstadoEstudio, informarEstudio, listDerivacionesClinicas, solicitarDerivacionClinica, resolverDerivacionClinica, getAuditoriaClinica |
| [services/managed-patients.service.ts](../frontend/src/services/managed-patients.service.ts) | ManagedPatient, getManagedPatients |
| [services/notificaciones.service.ts](../frontend/src/services/notificaciones.service.ts) | getNotificaciones, leerNotificacion, leerTodasNotificaciones, getOpcionesEnvio, previewEnvio, buscarDestinatarios, crearEnvioAdministrativo, editarEnvioAdministrativo, getEnvios, getEnvio, cancelarEnvio |
| [services/patients.service.ts](../frontend/src/services/patients.service.ts) | updateOwnPatient, getPatients, getPatientByDni, getPatientById, createPatient, updatePatientStatus, updatePatient |
| [services/profesionales.service.ts](../frontend/src/services/profesionales.service.ts) | getProfessionals, getProfessionalById, createProfessional, updateProfessional, deleteProfessional, getProfessionalSpecialties, addProfessionalSpecialty, updateProfessionalSpecialty, deleteProfessionalSpecialty, getProfessionalClinics, addProfessionalClinic, updateProfessionalClinic, deleteProfessionalClinic, getPatientProfessionals, SlotDisponibilidad, FranjaHorario, CronogramaDia, DisponibilidadFecha, MisHorariosData, getMisHorarios |
| [services/public-content.service.ts](../frontend/src/services/public-content.service.ts) | getPublicNews, getPublicNewsDetail, getPublicSalitas, getMunicipalNews, getNewsCategories, getAdminNews, getAdminNewsDetail, saveNews |
| [services/reportes.service.ts](../frontend/src/services/reportes.service.ts) | reporteDownloadError, getReporteResumen, getReporteEspecialidades, getReporteProfesionales, descargarReporte, AgendaFiltros, getAgendaDiaria, descargarAgendaDiaria |
| [services/reprogramacion.service.ts](../frontend/src/services/reprogramacion.service.ts) | reprogramarTurno |
| [services/salitas.service.ts](../frontend/src/services/salitas.service.ts) | getSalitas, getAdminSalitas, getSalitaById, createSalita, updateSalita, deleteSalita |
| [services/turnos.service.ts](../frontend/src/services/turnos.service.ts) | getTurnoHistory, createOwnTurno, getTurnos, getTurnoById, createTurno, updateTurno, changeTurnoStatus, getDisponibilidad, PatientAvailableDates, getPatientAvailableDates |
| [services/tutor-requests.service.ts](../frontend/src/services/tutor-requests.service.ts) | TutorRequestDirection, TutorRequestStatus, TutorRequest, PatientTutor, getOwnPatientTutors, getOwnTutorRequests, createTutorRequest, getAdminTutorRequests, resolveTutorRequest |

## frontend/src / styles

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [styles/agenda-socket.css](../frontend/src/styles/agenda-socket.css) | Recurso visual o estilos |
| [styles/auth.css](../frontend/src/styles/auth.css) | Recurso visual o estilos |
| [styles/chatbot.css](../frontend/src/styles/chatbot.css) | Recurso visual o estilos |
| [styles/layout.css](../frontend/src/styles/layout.css) | Recurso visual o estilos |
| [styles/mis-horarios.css](../frontend/src/styles/mis-horarios.css) | Recurso visual o estilos |
| [styles/navbar.css](../frontend/src/styles/navbar.css) | Recurso visual o estilos |
| [styles/notificaciones.css](../frontend/src/styles/notificaciones.css) | Recurso visual o estilos |
| [styles/pacientes.css](../frontend/src/styles/pacientes.css) | Recurso visual o estilos |
| [styles/privacy.css](../frontend/src/styles/privacy.css) | Recurso visual o estilos |
| [styles/profesionales.css](../frontend/src/styles/profesionales.css) | Recurso visual o estilos |
| [styles/professional-agenda.css](../frontend/src/styles/professional-agenda.css) | Recurso visual o estilos |
| [styles/public.css](../frontend/src/styles/public.css) | Recurso visual o estilos |
| [styles/reportes.css](../frontend/src/styles/reportes.css) | Recurso visual o estilos |
| [styles/salitas.css](../frontend/src/styles/salitas.css) | Recurso visual o estilos |
| [styles/turnos.css](../frontend/src/styles/turnos.css) | Recurso visual o estilos |
| [styles/variables.css](../frontend/src/styles/variables.css) | Recurso visual o estilos |

## frontend/src / types

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [types/account-display.types.ts](../frontend/src/types/account-display.types.ts) | AccountDisplay |
| [types/auth.types.ts](../frontend/src/types/auth.types.ts) | UserRole, AuthUser, LoginRequest, LoginResponseData, LoginVerificationRequiredData, LoginResultData, LoginResponse, LoginResultResponse, RefreshRequest, RefreshResponseData, RefreshResponse, LogoutRequest, ApiErrorResponse, RegisterPatientInput, PasswordRecoveryInput, ResetPasswordInput, CompletePatientProfileInput, ProfileResponse, PersonProfile, OwnPersonUpdate, ProfileRoleInfo, CompletePersonInput |
| [types/barrio.types.ts](../frontend/src/types/barrio.types.ts) | Barrio, BarriosResponse |
| [types/chatbot.types.ts](../frontend/src/types/chatbot.types.ts) | ChatbotResponse, ChatbotMessage |
| [types/cierre-calendario.types.ts](../frontend/src/types/cierre-calendario.types.ts) | tiposCierre, CierreInput, Cierre, datosCierre, SyncYearResult, SyncStatus, SyncResult |
| [types/configuracion.types.ts](../frontend/src/types/configuracion.types.ts) | Zona, CatalogoTipo, CatalogoRegistro, CatalogoInput, Cobertura, HorarioInput, Horario, BloqueoInput, Bloqueo, Parametro |
| [types/historia-clinica.types.ts](../frontend/src/types/historia-clinica.types.ts) | CLINICAL_PERMISSIONS, ClinicalPermission, AntecedenteTipo, AntecedenteEstado, AlergiaGravedad, AlergiaEstado, DiagnosticoTipo, DiagnosticoEstado, ConsultaEstado, EvolucionEstado, TratamientoEstado, EstudioEstado, DerivacionTipo, DerivacionAlcance, DerivacionEstado, HistoriaClinicaContextData, ClinicalPatientSearchItem, ConsultaMedicaDetalle, BorradorFormularioClinico |
| [types/notificacion.types.ts](../frontend/src/types/notificacion.types.ts) | Notificacion, NotificacionesResponse, Audiencia, Destinatario, PreviewEnvio, OpcionesEnvio, NuevoEnvio, EnvioAdministrativo, ProgramacionOriginal, HistorialEnvios |
| [types/patient.types.ts](../frontend/src/types/patient.types.ts) | PatientSex, PatientStatusFilter, OwnPatientUpdate, Patient, PatientPagination, PatientsResponse, PatientResponse, UpdatePatientRequest, CreatePatientRequest |
| [types/profesional.types.ts](../frontend/src/types/profesional.types.ts) | ProfessionalSex, ProfessionalPerson, Professional, ProfessionalResponse, ProfessionalsResponse, CreateProfessionalRequest, UpdateProfessionalRequest, ProfessionalSpecialty, ProfessionalSpecialtiesResponse, CreateProfessionalSpecialtyRequest, UpdateProfessionalSpecialtyRequest, ProfessionalClinic, ProfessionalClinicsResponse, CreateProfessionalClinicRequest, UpdateProfessionalClinicRequest, Specialty, SpecialtiesResponse, PatientProfessional |
| [types/public-content.types.ts](../frontend/src/types/public-content.types.ts) | NewsCategory, PublicNews, NewsInput, AdminNews, NewsList, PublicSalita, MunicipalNews, MunicipalResult |
| [types/reporte.types.ts](../frontend/src/types/reporte.types.ts) | ReporteTipo, ReporteFormato, ReporteFiltros, ReportePeriodo, ReporteResumen, ReporteEspecialidad, ReporteProfesional, ReporteResumenResponse, ReporteEspecialidadesResponse, ReporteProfesionalesResponse, AgendaPaciente, AgendaLista, AgendaDiariaResponse |
| [types/salita.types.ts](../frontend/src/types/salita.types.ts) | Salita, SalitaResponse, SalitasResponse, CreateSalitaRequest, UpdateSalitaRequest |
| [types/socket.types.ts](../frontend/src/types/socket.types.ts) | TipoEventoAgenda, EventoAgenda, EstadoConexionSocket |
| [types/turno.types.ts](../frontend/src/types/turno.types.ts) | TurnoEstadoCodigo, TurnoEstado, TurnoPaciente, TurnoProfesional, TurnoSalita, TurnoEspecialidad, Turno, TurnosPagination, TurnosResponse, TurnoResponse, CreateTurnoRequest, UpdateTurnoRequest, ChangeTurnoStatusRequest, DisponibilidadEstado, DisponibilidadSlot, DisponibilidadHorario, DisponibilidadResponse, TurnosFilters, AppointmentHistory |

## frontend/src / utils

| Archivo | Declaraciones exportadas / tipo |
| --- | --- |
| [utils/access-notice.ts](../frontend/src/utils/access-notice.ts) | AccessNotice, subscribeAccessNotice, getAccessNotice, closeAccessNotice, reportAccessNotice |
| [utils/agenda-display.ts](../frontend/src/utils/agenda-display.ts) | agendaDate, agendaDateTime, agendaToday |
| [utils/auth-errors.ts](../frontend/src/utils/auth-errors.ts) | authError, passwordError |
| [utils/auth-storage.ts](../frontend/src/utils/auth-storage.ts) | getAccessToken, getRefreshToken, getStoredUser, saveAuthSession, updateAuthTokens, clearAuthSession, saveStoredUser |
| [utils/chatbot-session.ts](../frontend/src/utils/chatbot-session.ts) | ChatbotSession |
| [utils/field-validation.ts](../frontend/src/utils/field-validation.ts) | fieldRule, fieldError, personFieldsError |
| [utils/historia-clinica-format.ts](../frontend/src/utils/historia-clinica-format.ts) | formatArgentinaDate, formatArgentinaDateTime, getNowArgentinaDateTimeLocal, getTodayArgentinaIsoDate, toArgentinaOffsetIso, formatSignedConsultaNotice |
| [utils/historia-clinica-navigation.ts](../frontend/src/utils/historia-clinica-navigation.ts) | buildConsultaSectionsForMode, resolveConsultaBlockViewMode, resolvePrimaryBackTarget, ClinicalNavState, ConsultaSectionKey |
| [utils/news-schedule.ts](../frontend/src/utils/news-schedule.ts) | retainedNewsDate, newsScheduleError |
| [utils/privacy-notice.ts](../frontend/src/utils/privacy-notice.ts) | PRIVACY_NOTICE_VERSION, PRIVACY_NOTICE_STORAGE_KEY, PrivacyAcknowledgement, parsePrivacyAcknowledgement, getPrivacyNoticeSnapshot, acknowledgePrivacyNotice, subscribePrivacyNotice |
| [utils/turno-status.ts](../frontend/src/utils/turno-status.ts) | getEstadoClass |
| [utils/weekly-schedule.ts](../frontend/src/utils/weekly-schedule.ts) | scheduleDays, WeeklySlot, newWeeklySlot |

## Configuración de aplicaciones

- [backend/.prettierrc.json](../backend/.prettierrc.json)
- [backend/Andres-Log.md](../backend/Andres-Log.md)
- [backend/package.json](../backend/package.json)
- [backend/package-lock.json](../backend/package-lock.json)
- [backend/PROJECT_GUIDE.md](../backend/PROJECT_GUIDE.md)
- [backend/tsconfig.json](../backend/tsconfig.json)
- [frontend/.oxlintrc.json](../frontend/.oxlintrc.json)
- [frontend/index.html](../frontend/index.html)
- [frontend/package.json](../frontend/package.json)
- [frontend/package-lock.json](../frontend/package-lock.json)
- [frontend/README.md](../frontend/README.md)
- [frontend/tsconfig.app.json](../frontend/tsconfig.app.json)
- [frontend/tsconfig.json](../frontend/tsconfig.json)
- [frontend/tsconfig.node.json](../frontend/tsconfig.node.json)
- [frontend/vite.config.ts](../frontend/vite.config.ts)
