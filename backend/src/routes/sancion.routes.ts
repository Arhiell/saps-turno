import { Router } from "express";

import { authenticate } from
  "../middlewares/auth.middleware.js";

import { requireRole } from
  "../middlewares/role.middleware.js";

import {
  createSancionController,
  getSancionesController,
  getSancionByIdController,
  anularSancionController,
} from "../controllers/sancion.controller.js";

const router = Router();

const rolesGestion = [
  "SUPER_ADMIN",
  "ADMIN_SALITA",
  "RECEPCION",
];

// Lista sanciones.
router.get(
  "/",
  authenticate,
  requireRole(...rolesGestion),
  getSancionesController,
);

// Consulta una sanción.
router.get(
  "/:id",
  authenticate,
  requireRole(...rolesGestion),
  getSancionByIdController,
);

// Registra una sanción por inasistencia.
router.post(
  "/",
  authenticate,
  requireRole(...rolesGestion),
  createSancionController,
);

// La sanción se conserva y solamente se marca como anulada.
router.patch(
  "/:id/anular",
  authenticate,
  requireRole(...rolesGestion),
  anularSancionController,
);

export default router;
