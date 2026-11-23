import { Router } from "express";
import administrativas from "./notificacion-admin.routes.js";

import { authenticate } from
  "../middlewares/auth.middleware.js";

import {
  getNotificacionesController,
  getNotificacionController,
  leerNotificacionController,
  leerTodasController,
} from "../controllers/notificacion.controller.js";

const router = Router();
router.use("/administrativas", administrativas);

// Cada usuario consulta únicamente sus propias notificaciones.
router.get(
  "/",
  authenticate,
  getNotificacionesController,
);

router.patch(
  "/leer-todas",
  authenticate,
  leerTodasController,
);

router.get(
  "/:id",
  authenticate,
  getNotificacionController,
);

router.patch(
  "/:id/leer",
  authenticate,
  leerNotificacionController,
);

// Permite registrar estas rutas en el router principal de la API.
export default router;
