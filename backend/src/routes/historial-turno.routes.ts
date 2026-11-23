import {
    Router
} from "express";

import {
  getHistorialTurnoController,
  getHistorialGeneralController,
} from "../controllers/historial-turno.controller.js";

import {
    authenticate
} from "../middlewares/auth.middleware.js";

import {
    requireRole
} from "../middlewares/role.middleware.js";

const router = Router();

// Historial completo para administración.
router.get(
  "/historial-turnos",
  authenticate,
  requireRole(
    "SUPER_ADMIN",
    "ADMIN_SALITA",
    "RECEPCION",
  ),
  getHistorialGeneralController,
);

// Historial específico de un turno.
router.get(
  "/turnos/:idTurno/historial",
  authenticate,
  requireRole(
    "PACIENTE",
    "PROFESIONAL",
    "SUPER_ADMIN",
    "ADMIN_SALITA",
    "RECEPCION",
  ),
  getHistorialTurnoController,
);


export default router;
