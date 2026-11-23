import { Router } from "express";

import {
  forgotPassword,
  resetUserPassword
} from "../controllers/password-recovery.controller.js";

const router = Router();

// Solicita recuperación.
router.post(
  "/forgot",
  forgotPassword
);

// Cambia contraseña utilizando el recovery token.
router.post(
  "/reset",
  resetUserPassword
);

export default router;