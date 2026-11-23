import { scheduleScope } from "../middlewares/profile-scope.middleware.js";
import { Router } from "express";

import {
  actualizarBloqueoController,
  crearBloqueoController,
  eliminarBloqueoController,
  obtenerBloqueo,
  obtenerBloqueos,
} from "../controllers/bloqueo-agenda.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticate);
router.use(requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"));

router.get("/", scheduleScope("bloqueos_agenda"), obtenerBloqueos);
router.get("/:id", scheduleScope("bloqueos_agenda"), obtenerBloqueo);
router.post("/", scheduleScope("bloqueos_agenda"), crearBloqueoController);
router.put("/:id", scheduleScope("bloqueos_agenda"), actualizarBloqueoController);
router.delete("/:id", scheduleScope("bloqueos_agenda"), eliminarBloqueoController);

export default router;