import { scheduleScope } from "../middlewares/profile-scope.middleware.js";
import { Router } from "express";

import {
  actualizarHorarioController,
  crearHorarioController,
  eliminarHorarioController,
  obtenerHorario,
  obtenerHorarios,
} from "../controllers/horario-atencion.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticate);
router.use(requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"));

router.get("/", scheduleScope("horarios_atencion"), obtenerHorarios);
router.get("/:id", scheduleScope("horarios_atencion"), obtenerHorario);
router.post("/", scheduleScope("horarios_atencion"), crearHorarioController);
router.put("/:id", scheduleScope("horarios_atencion"), actualizarHorarioController);
router.delete("/:id", scheduleScope("horarios_atencion"), eliminarHorarioController);

export default router;