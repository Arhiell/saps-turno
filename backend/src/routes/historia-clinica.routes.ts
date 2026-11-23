import { Router } from 'express';

import {
  buscarPacientesClinicosController,
  obtenerContextoClinicoController,
} from '../controllers/historia-clinica-support.controller.js';

import {
  actualizarConsultaBorradorController,
  actualizarEstadoEstudioController,
  anularConsultaBorradorController,
  consultarAlergiasController,
  consultarAntecedentesController,
  consultarAuditoriaClinicaController,
  consultarConsultaMedicaController,
  consultarDiagnosticosConsultaController,
  consultarEstudiosConsultaController,
  consultarEvolucionesConsultaController,
  consultarHistoriaClinicaController,
  consultarTratamientosConsultaController,
  descartarBorradorTemporalController,
  firmarConsultaMedicaController,
  guardarBorradorTemporalController,
  informarEstudioController,
  listarDerivacionesController,
  obtenerBorradorTemporalController,
  rectificarEvolucionClinicaController,
  registrarConsultaClinicaController,
  registrarEvolucionClinicaController,
  resolverDerivacionController,
  solicitarDerivacionController,
} from '../controllers/historia-clinica.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  clinicalAuditScope,
  clinicalDerivationScope,
  clinicalResourceScope,
  clinicalScope,
} from '../middlewares/clinical-scope.middleware.js';
import { requirePermission } from '../middlewares/permission.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { getMiHistoriaClinicaController } from '../controllers/patient-clinical.controller.js';
import { CLINICAL_PERMISSIONS } from '../types/permission.types.js';

const router = Router();

// Impide almacenamiento en caché de información clínica sensible.
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Todas las rutas requieren JWT válido y usuario/rol activos.
router.use(authenticate);

// Portal del paciente: consulta de su propia historia clínica (y tutelados autorizados).
router.get('/mi-historia', requireRole('PACIENTE'), getMiHistoriaClinicaController);

// 0. Contexto de salitas/especialidades y buscador de pacientes dentro del alcance clínico.
router.get('/contexto', obtenerContextoClinicoController);

router.get(
  '/pacientes',
  requirePermission(CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA),
  buscarPacientesClinicosController
);

// 1. Historia clínica longitudinal, antecedentes y alergias del paciente.
router.get(
  '/pacientes/:idPaciente',
  requirePermission(CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA),
  clinicalScope({
    permiso: CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA,
    requiereLongitudinal: 'whenNoEspecialidad',
  }),
  consultarHistoriaClinicaController
);

router.get(
  '/pacientes/:idPaciente/antecedentes',
  requirePermission(CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA),
  clinicalScope({
    permiso: CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA,
    requiereLongitudinal: 'whenNoEspecialidad',
  }),
  consultarAntecedentesController
);

router.get(
  '/pacientes/:idPaciente/alergias',
  requirePermission(CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA),
  clinicalScope({
    permiso: CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA,
    requiereLongitudinal: 'whenNoEspecialidad',
  }),
  consultarAlergiasController
);

// 2. Consultas médicas y sus secciones dependientes.
router.get(
  '/consultas/:idConsulta',
  requirePermission(CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA),
  clinicalResourceScope({ permiso: CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA }),
  consultarConsultaMedicaController
);

router.get(
  '/consultas/:idConsulta/diagnosticos',
  requirePermission(CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA),
  clinicalResourceScope({ permiso: CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA }),
  consultarDiagnosticosConsultaController
);

router.get(
  '/consultas/:idConsulta/evoluciones',
  requirePermission(CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA),
  clinicalResourceScope({ permiso: CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA }),
  consultarEvolucionesConsultaController
);

router.get(
  '/consultas/:idConsulta/tratamientos',
  requirePermission(CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA),
  clinicalResourceScope({ permiso: CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA }),
  consultarTratamientosConsultaController
);

router.get(
  '/consultas/:idConsulta/estudios',
  requirePermission(CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA),
  clinicalResourceScope({ permiso: CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA }),
  consultarEstudiosConsultaController
);

router.post(
  '/consultas',
  requirePermission(CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA),
  clinicalScope({ permiso: CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA }),
  registrarConsultaClinicaController
);

router.patch(
  '/consultas/:idConsulta',
  requirePermission(CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA),
  clinicalResourceScope({
    permiso: CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA,
  }),
  actualizarConsultaBorradorController
);

router.post(
  '/consultas/:idConsulta/firmar',
  requirePermission(CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA),
  clinicalResourceScope({
    permiso: CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA,
  }),
  firmarConsultaMedicaController
);

router.post(
  '/consultas/:idConsulta/anular',
  requirePermission(CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA),
  clinicalResourceScope({
    permiso: CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA,
  }),
  anularConsultaBorradorController
);

// 2.b Borradores temporales de formulario clínico (autoguardado backend con concurrencia optimista).
router.get(
  '/borradores-temporales',
  requirePermission(CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA),
  clinicalScope({ permiso: CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA }),
  obtenerBorradorTemporalController
);

router.put(
  '/borradores-temporales',
  requirePermission(CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA),
  clinicalScope({ permiso: CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA }),
  guardarBorradorTemporalController
);

router.delete(
  '/borradores-temporales',
  requirePermission(CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA),
  clinicalScope({ permiso: CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA }),
  descartarBorradorTemporalController
);

// 3. Evoluciones clínicas (registro sobre consulta firmada y rectificación trazable).
router.post(
  '/consultas/:idConsulta/evoluciones',
  requirePermission(CLINICAL_PERMISSIONS.REGISTRAR_EVOLUCIONES),
  clinicalResourceScope({
    permiso: CLINICAL_PERMISSIONS.REGISTRAR_EVOLUCIONES,
  }),
  registrarEvolucionClinicaController
);

router.post(
  '/evoluciones/:idEvolucion/rectificar',
  requirePermission(CLINICAL_PERMISSIONS.REGISTRAR_EVOLUCIONES),
  clinicalResourceScope({
    permiso: CLINICAL_PERMISSIONS.REGISTRAR_EVOLUCIONES,
  }),
  rectificarEvolucionClinicaController
);

// 4. Estudios clínicos (cambio de estado e informe de resultado).
router.patch(
  '/estudios/:idEstudio/estado',
  requirePermission(CLINICAL_PERMISSIONS.GESTIONAR_ESTUDIOS_CLINICOS),
  clinicalResourceScope({
    permiso: CLINICAL_PERMISSIONS.GESTIONAR_ESTUDIOS_CLINICOS,
  }),
  actualizarEstadoEstudioController
);

router.post(
  '/estudios/:idEstudio/informar',
  requirePermission(CLINICAL_PERMISSIONS.GESTIONAR_ESTUDIOS_CLINICOS),
  clinicalResourceScope({
    permiso: CLINICAL_PERMISSIONS.GESTIONAR_ESTUDIOS_CLINICOS,
  }),
  informarEstudioController
);

// 5. Derivaciones y autorizaciones clínicas entre salitas.
router.get(
  '/derivaciones',
  requirePermission(CLINICAL_PERMISSIONS.GESTIONAR_DERIVACIONES_CLINICAS),
  clinicalDerivationScope(),
  listarDerivacionesController
);

router.post(
  '/derivaciones',
  requirePermission(CLINICAL_PERMISSIONS.GESTIONAR_DERIVACIONES_CLINICAS),
  clinicalScope({
    permiso: CLINICAL_PERMISSIONS.GESTIONAR_DERIVACIONES_CLINICAS,
  }),
  solicitarDerivacionController
);

router.patch(
  '/derivaciones/:idDerivacion',
  requirePermission(CLINICAL_PERMISSIONS.GESTIONAR_DERIVACIONES_CLINICAS),
  clinicalDerivationScope(),
  resolverDerivacionController
);

router.patch(
  '/derivaciones/:idDerivacion/resolver',
  requirePermission(CLINICAL_PERMISSIONS.GESTIONAR_DERIVACIONES_CLINICAS),
  clinicalDerivationScope(),
  resolverDerivacionController
);

// 6. Auditoría clínica inmutable.
router.get(
  '/auditoria',
  requirePermission(CLINICAL_PERMISSIONS.VER_AUDITORIA_CLINICA),
  clinicalAuditScope(),
  consultarAuditoriaClinicaController
);

export default router;
