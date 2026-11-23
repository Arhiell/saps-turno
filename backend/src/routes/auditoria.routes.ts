import { Router } from "express";

import { authenticate } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";
import { GENERAL_PERMISSIONS } from "../types/permission.types.js";

import {
  getAuditoriasController,
  getAuditoriaByIdController,
} from "../controllers/auditoria.controller.js";

const router = Router();

// La auditoría es solo de consulta administrativa.
router.get(
  "/",
  authenticate,
  requireRole(
    "SUPER_ADMIN",
    "ADMIN_SALITA",
  ),
  requirePermission(GENERAL_PERMISSIONS.VER_AUDITORIA),
  getAuditoriasController,
);

router.get(
  "/:id",
  authenticate,
  requireRole(
    "SUPER_ADMIN",
    "ADMIN_SALITA",
  ),
  requirePermission(GENERAL_PERMISSIONS.VER_AUDITORIA),
  getAuditoriaByIdController,
);

export default router;
