import { authenticate } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { professionalScope } from "../middlewares/profile-scope.middleware.js";
import { Router } from "express";
import { patientProfessionals } from '../controllers/patient-agenda.controller.js';
import { obtenerMisHorariosController } from '../controllers/profesional-horarios.controller.js';

import {
  getAllProfesionales,
  getProfesionalById,
  createProfesional,
  updateProfesional,
  deleteProfesional
} from "../controllers/profesional.controller.js";

const router = Router();
router.get('/', authenticate, patientProfessionals);
router.get('/me/horarios-disponibilidad', authenticate, requireRole('PROFESIONAL'), obtenerMisHorariosController);
router.get('/', authenticate, requireRole('SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'), professionalScope, getAllProfesionales);
router.use(authenticate);

router.get("/:id", requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"), professionalScope, getProfesionalById);
router.post("/", requireRole("SUPER_ADMIN", "ADMIN_SALITA"), professionalScope, createProfesional);
router.put("/:id", requireRole("SUPER_ADMIN", "ADMIN_SALITA"), professionalScope, updateProfesional);
router.delete("/:id", requireRole("SUPER_ADMIN", "ADMIN_SALITA"), professionalScope, deleteProfesional);

export default router;
