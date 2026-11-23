import { authenticate } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { Router } from "express";

import {
  getAllBarrios,
  getBarrioById,
  createBarrio,
  updateBarrio,
  deleteBarrio
} from "../controllers/barrio.controller.js";

const router = Router();

router.get("/", getAllBarrios);
router.get("/:id", getBarrioById);
router.post("/", authenticate, requireRole("SUPER_ADMIN"), createBarrio);
router.put("/:id", authenticate, requireRole("SUPER_ADMIN"), updateBarrio);
router.delete("/:id", authenticate, requireRole("SUPER_ADMIN"), deleteBarrio);

export default router;