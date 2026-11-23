
import { Router } from 'express';

import chatbotRoutes from './chatbot.routes.js';

import {
  adminContentRoutes,
  publicContentRoutes,
} from './public-content.routes.js';

import configuracionRoutes from './configuracion.routes.js';
import healthRoutes from './health.routes.js';
import userRoutes from './user.routes.js';
import authRoutes from './auth.routes.js';
import passwordRecoveryRoutes from './password-recovery.routes.js';
import emailVerificationRoutes from './email-verification.routes.js';
import googleAuthRoutes from './google-auth.routes.js';

import especialidadRoutes from './especialidad.routes.js';
import salitaRoutes from './salita.routes.js';
import barrioRoutes from './barrio.routes.js';
import zonaRoutes from './zona.routes.js';

import patientRoutes from './patient.routes.js';
import tutorRoutes from './tutor.routes.js';
import patientTutorRoutes from './patient-tutor.routes.js';

import salitaBarrioRoutes from './salita-barrio.routes.js';

import profesionalRoutes from './profesional.routes.js';
import profesionalEspecialidadRoutes from './profesional-especialidad.routes.js';
import profesionalSalitaRoutes from './profesional-salita.routes.js';

import horarioAtencionRoutes from './horario-atencion.routes.js';
import bloqueoAgendaRoutes from './bloqueo-agenda.routes.js';
import cierreCalendarioRoutes from './cierre-calendario.routes.js';
import disponibilidadRoutes from './disponibilidad.routes.js';

import turnoRoutes from './turno.routes.js';
import historialTurnoRoutes from './historial-turno.routes.js';
import sancionRoutes from './sancion.routes.js';

import notificacionRoutes from './notificacion.routes.js';
import accessManagementRoutes from './access-management.routes.js';
import auditoriaRoutes from './auditoria.routes.js';
import historiaClinicaRoutes from './historia-clinica.routes.js';
import reporteRoutes from './reporte.routes.js';

// Inicializa el enrutador principal de la API.
const router = Router();

// Rutas del chatbot.
router.use('/chatbot', chatbotRoutes);

// Contenido público y administración de contenido.
router.use('/public', publicContentRoutes);
router.use('/contenido', adminContentRoutes);

// Parámetros globales y configuraciones por salita.
router.use('/configuracion', configuracionRoutes);

// Estado general de la API.
router.use('/health', healthRoutes);

// Gestión de usuarios y permisos de acceso.
router.use('/users', userRoutes);
router.use('/access-management', accessManagementRoutes);

// Autenticación, recuperación de contraseña y verificación de correo.
router.use('/auth', authRoutes);
router.use('/auth/password', passwordRecoveryRoutes);
router.use('/auth/email', emailVerificationRoutes);
router.use('/auth/google', googleAuthRoutes);

// Catálogos principales del sistema.
router.use('/especialidades', especialidadRoutes);
router.use('/salitas', salitaRoutes);
router.use('/barrios', barrioRoutes);
router.use('/zonas', zonaRoutes);

// Gestión de pacientes, tutores y sus relaciones.
router.use('/patients', patientRoutes);
router.use('/tutors', tutorRoutes);
router.use('/', patientTutorRoutes);

// Cobertura de barrios por salita.
router.use('/salita-barrios', salitaBarrioRoutes);

// Gestión de profesionales y sus asignaciones.
router.use('/profesionales', profesionalRoutes);
router.use('/profesionales', profesionalEspecialidadRoutes);
router.use('/profesionales', profesionalSalitaRoutes);

// Gestión de horarios, bloqueos, cierres y disponibilidad.
router.use('/horarios-atencion', horarioAtencionRoutes);
router.use('/bloqueos-agenda', bloqueoAgendaRoutes);
router.use('/cierres-calendario', cierreCalendarioRoutes);
router.use('/disponibilidad', disponibilidadRoutes);

// Gestión de turnos e historial de modificaciones.
router.use('/turnos', turnoRoutes);
router.use('/', historialTurnoRoutes);

// Gestión de sanciones por inasistencia.
router.use('/sanciones', sancionRoutes);

// Notificaciones internas del usuario.
router.use('/notificaciones', notificacionRoutes);

// Auditoría de las operaciones del sistema.
router.use('/auditoria', auditoriaRoutes);
router.use('/historia-clinica', historiaClinicaRoutes);

// Reportes y estadísticas.
router.use('/reportes', reporteRoutes);

export default router;
