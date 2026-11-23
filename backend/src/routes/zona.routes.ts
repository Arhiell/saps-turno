import { authenticate } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { Router } from "express";

import {
  getAllZonas,
  getZonaById,
  createZona,
  updateZona,
  deleteZona
} from "../controllers/zona.controller.js";

const router = Router();

router.get("/", getAllZonas);
router.get("/:id", getZonaById);
router.post("/", authenticate, requireRole("SUPER_ADMIN"), createZona);
router.put("/:id", authenticate, requireRole("SUPER_ADMIN"), updateZona);
router.delete("/:id", authenticate, requireRole("SUPER_ADMIN"), deleteZona);

export default router;