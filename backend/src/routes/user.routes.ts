import { Router } from "express";

import {
  createAdmin,
  createPatient,
  createProfessional,
  userHealthCheck
} from "../controllers/user.controller.js";

import {
  authenticate
} from "../middlewares/auth.middleware.js";

import {
  requireRole
} from "../middlewares/role.middleware.js";

import {
  requirePermission
} from "../middlewares/permission.middleware.js";

import { GENERAL_PERMISSIONS } from "../types/permission.types.js";

const router = Router();

/**
 * Diagnóstico del módulo.
 */
router.get(
  "/health",
  userHealthCheck
);

/**
 * Solo SUPER_ADMIN puede crear
 * administradores de salita.
 */
router.post(
  "/admins",
  authenticate,
  requireRole("SUPER_ADMIN"),
  requirePermission(
    GENERAL_PERMISSIONS.GESTIONAR_USUARIOS,
    GENERAL_PERMISSIONS.GESTIONAR_ROLES
  ),
  createAdmin
);

/**
 * SUPER_ADMIN y ADMIN_SALITA
 * pueden crear pacientes.
 */
router.post(
  "/patients",
  authenticate,
  requireRole(
    "SUPER_ADMIN",
    "ADMIN_SALITA"
  ),
  requirePermission(
    GENERAL_PERMISSIONS.GESTIONAR_USUARIOS,
    GENERAL_PERMISSIONS.GESTIONAR_PACIENTES
  ),
  createPatient
);

/**
 * SUPER_ADMIN y ADMIN_SALITA
 * pueden crear profesionales.
 */
router.post(
  "/professionals",
  authenticate,
  requireRole(
    "SUPER_ADMIN",
    "ADMIN_SALITA"
  ),
  requirePermission(
    GENERAL_PERMISSIONS.GESTIONAR_USUARIOS,
    GENERAL_PERMISSIONS.GESTIONAR_PROFESIONALES
  ),
  createProfessional
);

export default router;
