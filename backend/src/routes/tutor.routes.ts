import {
  Router
} from "express";

import {
  createTutorController
} from "../controllers/tutor.controller.js";

import {
  authenticate
} from "../middlewares/auth.middleware.js";

import {
  requireRole
} from "../middlewares/role.middleware.js";

import { 
  listTutorsController, 
  getTutorController, 
  getTutorByDniController 
} from "../controllers/tutor-read.controller.js";

import { 
  updateTutorController, 
  updateTutorStatusController 
} from "../controllers/tutor-update.controller.js";

const router = Router();

/**
 * Todas las rutas de tutores
 * requieren autenticación.
 */
router.use(authenticate);
router.use(requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"));
router.get("/", listTutorsController);
router.get("/dni/:dni", getTutorByDniController);
router.get("/:id", getTutorController);
router.patch("/:id/status", updateTutorStatusController);
router.patch("/:id", updateTutorController);

/**
 * Registrar tutor.
 */
router.post("/", createTutorController);

export default router;
