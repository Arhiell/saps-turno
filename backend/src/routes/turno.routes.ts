
import { Router } from "express";

import { authenticate } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

import { createTurnoController } from "../controllers/turno.controller.js";

import {
  listTurnosController,
  getTurnoController,
} from "../controllers/turno-read.controller.js";

import {
  updateTurnoController,
  changeTurnoStatusController,
} from "../controllers/turno-update.controller.js";

import {
  agendaImpactController,
  agendaProposalController,
  agendaConfirmController,
  agendaAvailabilityController,
} from "../controllers/agenda-impacto.controller.js";

const router = Router();

// Requiere autenticación y restringe el acceso según el rol.
router.use(authenticate);

router.use(
  requireRole(
    "SUPER_ADMIN",
    "ADMIN_SALITA",
    "RECEPCION",
    "PROFESIONAL",
    "PACIENTE"
  )
);

// Gestiona el impacto, la propuesta y la confirmación de reprogramaciones.
router.post(
  "/reprogramacion/impacto",
  requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"),
  agendaImpactController
);

router.post(
  "/reprogramacion/propuesta",
  requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"),
  agendaProposalController
);

router.post(
  "/reprogramacion/confirmar",
  requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"),
  agendaConfirmController
);

router.post('/reprogramacion/disponibilidad',
  requireRole('SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'), agendaAvailabilityController);

// Permite crear turnos según los roles autorizados.
router.post(
  "/",
  requireRole(
    "SUPER_ADMIN",
    "ADMIN_SALITA",
    "RECEPCION",
    "PACIENTE"
  ),
  createTurnoController
);

// Consulta los turnos aplicando las restricciones del servicio.
router.get(
  "/",
  listTurnosController
);

// Obtiene un turno por su identificador.
router.get(
  "/:id",
  getTurnoController
);

// Actualiza los datos de un turno existente.
router.patch(
  "/:id",
  requireRole(
    "SUPER_ADMIN",
    "ADMIN_SALITA",
    "RECEPCION"
  ),
  updateTurnoController
);

// Permite modificar el estado de un turno según el rol.
router.patch(
  "/:id/status",
  requireRole(
    "SUPER_ADMIN",
    "ADMIN_SALITA",
    "RECEPCION",
    "PROFESIONAL",
    "PACIENTE"
  ),
  changeTurnoStatusController
);

export default router;
