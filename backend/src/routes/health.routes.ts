import { Router } from "express";

import {
  healthCheck,
  databaseHealthCheck,
} from "../controllers/health.controller.js";

const router = Router();

// GET /api/health
router.get("/", healthCheck);

// GET /api/health/database
router.get("/database", databaseHealthCheck);

export default router;