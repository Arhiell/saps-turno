import { authenticate } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { Router } from "express";

import {
  getAllSalitas,
  getAdminSalitas,
  getSalitaById,
  createSalita,
  updateSalita,
  deleteSalita
} from "../controllers/salita.controller.js";

const router = Router();

router.get("/", getAllSalitas);
router.get(
  "/admin",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"),
  getAdminSalitas
);
router.get("/:id", getSalitaById);
router.post("/", authenticate, requireRole("SUPER_ADMIN"), createSalita);
router.put("/:id", authenticate, requireRole("SUPER_ADMIN"), updateSalita);
router.delete("/:id", authenticate, requireRole("SUPER_ADMIN"), deleteSalita);

export default router;
