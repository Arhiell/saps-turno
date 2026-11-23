import { Router } from 'express';

import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

import {
  requestChange,
  confirmChange,
} from '../controllers/email-change.controller.js';

import {
  requestVerification,
  verifyEmail,
} from '../controllers/email-verification.controller.js';

// Crea el router para la gestión y verificación del correo electrónico.
const router = Router();

// Solicita el cambio de correo del usuario autenticado.
router.post(
  '/change/request',
  authenticate,
  requireRole('PACIENTE', 'SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION', 'PROFESIONAL'),
  requestChange
);

// Confirma el cambio de correo mediante el código de verificación.
router.post(
  '/change/verify',
  authenticate,
  requireRole('PACIENTE', 'SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION', 'PROFESIONAL'),
  confirmChange
);

// Solicita un token para verificar el correo electrónico.
router.post(
  '/request',
  requestVerification
);

// Verifica el correo electrónico mediante el token recibido.
router.post(
  '/verify',
  verifyEmail
);

export default router;