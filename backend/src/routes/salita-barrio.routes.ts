import { authenticate } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { Router } from "express";

import {
  getAllSalitaBarrios,
  getBarriosBySalita,
  getSalitasByBarrio,
  createSalitaBarrio,
  updateSalitaBarrio,
  deleteSalitaBarrio
} from "../controllers/salita-barrio.controller.js";

const router = Router();

router.get("/", getAllSalitaBarrios);
router.get("/salita/:id", getBarriosBySalita);
router.get("/barrio/:id", getSalitasByBarrio);
router.post("/", authenticate, requireRole("SUPER_ADMIN"), createSalitaBarrio);
router.put("/:idSalita/:idBarrio", authenticate, requireRole("SUPER_ADMIN"), updateSalitaBarrio);
router.delete("/:idSalita/:idBarrio", authenticate, requireRole("SUPER_ADMIN"), deleteSalitaBarrio);

export default router;