import { authenticate } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { Router } from "express";

import {
  getAllEspecialidades,
  getEspecialidadById,
  createEspecialidad,
  updateEspecialidad,
  deleteEspecialidad
} from "../controllers/especialidad.controller.js";

const router = Router();

router.get("/", getAllEspecialidades);
router.get("/:id", getEspecialidadById);
router.post("/", authenticate, requireRole("SUPER_ADMIN"), createEspecialidad);
router.put("/:id", authenticate, requireRole("SUPER_ADMIN"), updateEspecialidad);
router.delete("/:id", authenticate, requireRole("SUPER_ADMIN"), deleteEspecialidad);

export default router;