import { Router } from "express";

import { authenticate } from
  "../middlewares/auth.middleware.js";

import { requireRole } from
  "../middlewares/role.middleware.js";
import { getDashboardController } from '../controllers/dashboard.controller.js';

import {
  getReporteResumenController,
  getReporteEspecialidadesController,
  getReporteProfesionalesController,
  exportReporteController,
} from "../controllers/reporte.controller.js";

const router = Router();

router.get('/dashboard', authenticate, requireRole('SUPER_ADMIN'), getDashboardController);

import { getAgendaDiariaController, exportAgendaDiariaController, printAgendaDiariaController }
  from "../controllers/reporte-agenda.controller.js";

// La agenda nominal se restringe a administración y recepción, a diferencia de las estadísticas.
router.get("/agenda-diaria", authenticate, requireRole("SUPER_ADMIN", "ADMIN_SALITA", "PROFESIONAL", "RECEPCION"), getAgendaDiariaController);
router.get("/agenda-diaria/exportar", authenticate, requireRole("SUPER_ADMIN", "ADMIN_SALITA", "PROFESIONAL", "RECEPCION"), exportAgendaDiariaController);
router.get("/agenda-diaria/imprimir", authenticate, requireRole("SUPER_ADMIN", "ADMIN_SALITA", "PROFESIONAL", "RECEPCION"), printAgendaDiariaController);

const rolesReporte = [
  "SUPER_ADMIN",
  "ADMIN_SALITA",
  "RECEPCION",
];

// Resumen general del período.
router.get(
  "/resumen",
  authenticate,
  requireRole(...rolesReporte),
  getReporteResumenController,
);

// Demanda por especialidad.
router.get(
  "/especialidades",
  authenticate,
  requireRole(...rolesReporte),
  getReporteEspecialidadesController,
);

// Actividad por profesional.
router.get(
  "/profesionales",
  authenticate,
  requireRole(...rolesReporte),
  getReporteProfesionalesController,
);

// Exporta PDF, Excel o Word.
router.get(
  "/exportar",
  authenticate,
  requireRole(...rolesReporte),
  exportReporteController,
);

export default router;
