import {
  Router
} from "express";

import {
  googleLogin
} from "../controllers/google-auth.controller.js";

const router = Router();

/**
 * Login / registro mediante Google.
 */
router.post(
  "/",
  googleLogin
);

export default router;