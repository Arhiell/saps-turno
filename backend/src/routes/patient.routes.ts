import { patientScope } from "../middlewares/profile-scope.middleware.js";
import { getManagedPatients } from '../services/patient-managed.service.js';
import { z } from 'zod';
import { personEmailSchema } from '../validators/person.validator.js';
import { linkPatientAccount } from '../services/patient-account.service.js';
import {
  createTutorRequestController,
  listOwnTutorRequestsController,
} from '../controllers/tutor-request.controller.js';
import { getMiHistoriaClinicaController } from '../controllers/patient-clinical.controller.js';
import { getPatientTutors } from '../services/patient-tutor.service.js';
import { getOwnPatient } from '../services/patient-coverage.service.js';
import {
  Router
} from "express";

import {
  createPatientController
} from "../controllers/patient.controller.js";

import {
  getPatientByDniController,
  getPatientController,
  listPatientsController
} from "../controllers/patient-read.controller.js";

import {
  updatePatientController,
  updatePatientStatusController
} from "../controllers/patient-update.controller.js";

import {
  authenticate
} from "../middlewares/auth.middleware.js";

import {
  requireRole
} from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticate);
router.patch('/:id/account', requireRole('SUPER_ADMIN', 'ADMIN_SALITA'), async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const input = z.object({ email: personEmailSchema, identidad_verificada: z.literal(true) }).strict().parse(req.body);
  await linkPatientAccount(id, input.email.toLowerCase(), req.user!);
  res.json({ success: true, message: 'Cuenta propia vinculada sin modificar el historial del paciente.' });
});
router.get('/personas-a-cargo', requireRole('PACIENTE'), async (req, res) => {
  res.json({ data: await getManagedPatients(req.user!) });
});
router.get('/solicitudes-vinculacion', requireRole('PACIENTE'), listOwnTutorRequestsController);
router.post('/solicitudes-vinculacion', requireRole('PACIENTE'), createTutorRequestController);
router.get('/mis-responsables', requireRole('PACIENTE'), async (req, res, next) => {
  try {
    const patient = await getOwnPatient(req.user!);
    res.json({ success: true, data: { tutors: await getPatientTutors(patient.id_paciente) } });
  } catch (error) { next(error); }
});
router.get('/mi-historia-clinica', requireRole('PACIENTE'), getMiHistoriaClinicaController);

/**
 * Listar pacientes.
 */
router.get(
  "/",
  requireRole(
    "SUPER_ADMIN",
    "ADMIN_SALITA",
    "RECEPCION"
  ),
  patientScope,
  listPatientsController
);

/**
 * Buscar paciente por DNI.
 */
router.get(
  "/dni/:dni",
  requireRole(
    "SUPER_ADMIN",
    "ADMIN_SALITA",
    "RECEPCION"
  ),
  patientScope,
  getPatientByDniController
);

/**
 * Cambiar estado.
 */
router.patch(
  "/:id/status",
  requireRole(
    "SUPER_ADMIN",
    "ADMIN_SALITA",
    "RECEPCION"
  ),
  patientScope,
  updatePatientStatusController
);

/**
 * Buscar paciente por ID.
 */
router.get(
  "/:id",
  requireRole(
    "SUPER_ADMIN",
    "ADMIN_SALITA",
    "RECEPCION"
  ),
  patientScope,
  getPatientController
);

/**
 * Actualizar paciente.
 */
router.patch(
  "/:id",
  requireRole(
    "SUPER_ADMIN",
    "ADMIN_SALITA",
    "RECEPCION"
  ),
  patientScope,
  updatePatientController
);

/**
 * Crear paciente.
 */
router.post(
  "/",
  requireRole(
    "SUPER_ADMIN",
    "ADMIN_SALITA",
    "RECEPCION"
  ),
  patientScope,
  createPatientController
);

export default router;
