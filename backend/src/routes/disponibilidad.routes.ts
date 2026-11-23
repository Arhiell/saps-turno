import { 
  scheduleScope 
} from "../middlewares/profile-scope.middleware.js";

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
  obtenerDisponibilidadController,
  obtenerFechasPaciente,
} from "../controllers/disponibilidad.controller.js";

const router = Router();
router.use(authenticate, requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION", "PACIENTE"));
router.get('/fechas', requireRole('PACIENTE'), obtenerFechasPaciente);

router.get(
  "/", scheduleScope("disponibilidad"), obtenerDisponibilidadController
);

export default router;
