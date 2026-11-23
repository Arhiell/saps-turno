import { authenticate } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { professionalScope } from "../middlewares/profile-scope.middleware.js";
import { Router } from "express";

import {
  getSalitas,
  createSalita,
  updateSalita,
  deleteSalita
} from "../controllers/profesional-salita.controller.js";

const router = Router();
router.use(authenticate);

router.get(
  "/:id/salitas",
  requireRole('SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'),
  professionalScope,
  getSalitas
);

router.post(
  "/:id/salitas",
  requireRole('SUPER_ADMIN', 'ADMIN_SALITA'),
  professionalScope,
  createSalita
);

router.put(
  "/:id/salitas/:idSalita",
  requireRole('SUPER_ADMIN', 'ADMIN_SALITA'),
  professionalScope,
  updateSalita
);

router.delete(
  "/:id/salitas/:idSalita",
  requireRole('SUPER_ADMIN', 'ADMIN_SALITA'),
  professionalScope,
  deleteSalita
);

export default router;
