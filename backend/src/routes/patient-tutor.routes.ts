import {
  Router
} from "express";

import {
  authenticate
} from "../middlewares/auth.middleware.js";

import {
  requireRole
} from "../middlewares/role.middleware.js";

import {
  listPatientTutorsController,
  listTutorPatientsController,
  updatePatientTutorController,
  finishPatientTutorController
} from "../controllers/patient-tutor.controller.js";

import type { RequestHandler } from 'express';
import { z } from 'zod';
import { getTurnoScope, assertTurnoScope } from '../services/turno-access.service.js';
import { getPatientById } from '../services/patient-read.service.js';
import {
  listAdminTutorRequestsController,
  resolveTutorRequestController,
} from '../controllers/tutor-request.controller.js';

const router = Router();

const relationScope: RequestHandler = async (req, _res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.patientId);
    const patient = await getPatientById(id);
    assertTurnoScope(await getTurnoScope(req.user!), patient.id_salita_asignada);
    next();
  } catch (error) { next(error); }
};

const authorize = [
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION")
];

router.get(
  '/tutor-requests',
  authenticate,
  requireRole('SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'),
  listAdminTutorRequestsController
);
router.patch(
  '/tutor-requests/:requestId',
  authenticate,
  requireRole('SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'),
  resolveTutorRequestController
);

router.use('/patients/:patientId/tutors', ...authorize, relationScope);
const requireTutorRequest: RequestHandler = (_req, res) => {
  res.status(403).json({
    success: false,
    message: 'Las autorizaciones deben tramitarse mediante una solicitud y aprobación administrativa.',
  });
};

router.post('/patients/:patientId/tutors/by-dni', ...authorize, relationScope, requireTutorRequest);
router.post('/patients/:patientId/tutors', ...authorize, relationScope, requireTutorRequest);

router.get(
  "/patients/:patientId/tutors",
  ...authorize,
  listPatientTutorsController
);

router.patch(
  "/patients/:patientId/tutors/:tutorId",
  ...authorize,
  updatePatientTutorController
);

router.patch(
  "/patients/:patientId/tutors/:tutorId/end",
  ...authorize,
  finishPatientTutorController
);

/**
 * Relaciones desde tutor.
 */
router.get(
  "/tutors/:tutorId/patients",
  ...authorize,
  listTutorPatientsController
);

export default router;
