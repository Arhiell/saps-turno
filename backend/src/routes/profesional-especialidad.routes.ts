import { authenticate } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { professionalScope } from "../middlewares/profile-scope.middleware.js";
import { Router } from "express";

import {
  getEspecialidades,
  createEspecialidad,
  updateEspecialidad,
  deleteEspecialidad
} from "../controllers/profesional-especialidad.controller.js";

const router = Router();
router.use(authenticate);

router.get(
  "/:id/especialidades",
  requireRole('SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'),
  professionalScope,
  getEspecialidades
);

router.post(
  "/:id/especialidades",
  requireRole('SUPER_ADMIN', 'ADMIN_SALITA'),
  professionalScope,
  createEspecialidad
);

router.put(
  "/:id/especialidades/:idEspecialidad",
  requireRole('SUPER_ADMIN', 'ADMIN_SALITA'),
  professionalScope,
  updateEspecialidad
);

router.delete(
  "/:id/especialidades/:idEspecialidad",
  requireRole('SUPER_ADMIN', 'ADMIN_SALITA'),
  professionalScope,
  deleteEspecialidad
);

export default router;
