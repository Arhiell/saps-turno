import { Router } from 'express';

import {
  changeUsername,
  changePassword,
} from '../controllers/account.controller.js';

import {
  authenticate,
  authenticateForProfile,
} from '../middlewares/auth.middleware.js';

import { requireRole } from '../middlewares/role.middleware.js';

import {
  ownProfile,
  completeProfile,
  updateOwnProfile,
} from '../controllers/auth-profile.controller.js';

import {
  login,
  logout,
  refresh,
  register,
} from '../controllers/auth.controller.js';

// Crea el router de autenticación y gestión de cuentas.
const router = Router();

// Actualiza el nombre de usuario de la cuenta autenticada.
router.patch(
  '/username',
  authenticate,
  requireRole('PACIENTE', 'SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION', 'PROFESIONAL'),
  changeUsername
);

// Cambia la contraseña y revoca las sesiones correspondientes.
router.patch(
  '/password',
  authenticate,
  requireRole('PACIENTE', 'SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION', 'PROFESIONAL'),
  changePassword
);

// Obtiene el perfil del usuario autenticado.
router.get(
  '/me',
  authenticateForProfile,
  ownProfile
);

// Obtiene el perfil del usuario autenticado (alias estándar /profile).
router.get(
  '/profile',
  authenticateForProfile,
  ownProfile
);

// Actualiza los datos personales permitidos según el rol.
router.patch(
  '/profile',
  authenticate,
  requireRole('PACIENTE', 'SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION', 'PROFESIONAL'),
  updateOwnProfile
);

// Completa el perfil del usuario autenticado.
router.post(
  '/profile',
  authenticateForProfile,
  requireRole('PACIENTE', 'SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'),
  completeProfile
);

// Registra una nueva cuenta de usuario.
router.post(
  '/register',
  register
);

// Inicia sesión con las credenciales del usuario.
router.post(
  '/login',
  login
);

// Renueva los tokens de autenticación.
router.post(
  '/refresh',
  refresh
);

// Cierra la sesión del usuario.
router.post(
  '/logout',
  logout
);

export default router;