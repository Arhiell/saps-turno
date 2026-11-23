import { 
  Router 
} from "express";

import { 
  authenticate 
} from "../middlewares/auth.middleware.js";

import { 
  requireRole 
} from "../middlewares/role.middleware.js";

import { 
  listConfiguracionesController, 
  publicConfiguracionesController, 
  getConfiguracionController,
  createConfiguracionController, 
  updateConfiguracionController 
} from "../controllers/configuracion.controller.js";

const router = Router();

router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

// La ruta pública precede a la búsqueda por clave.
router.get("/publica", publicConfiguracionesController);

router.get("/", authenticate, listConfiguracionesController);

router.get("/:clave", authenticate, getConfiguracionController);

router.post("/", authenticate, requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"), createConfiguracionController);

router.patch("/:id", authenticate, requireRole("SUPER_ADMIN", "ADMIN_SALITA", "RECEPCION"), updateConfiguracionController);

export default router;
