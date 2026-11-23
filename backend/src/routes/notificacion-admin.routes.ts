import {
  Router,
} from 'express';

import {
  authenticate,
} from '../middlewares/auth.middleware.js';

import {
  requireRole,
} from '../middlewares/role.middleware.js';

import * as controller
  from '../controllers/notificacion-admin.controller.js';

const router = Router();

// Requiere autenticación y permisos administrativos.
router.use(
  authenticate,
  requireRole(
    'SUPER_ADMIN',
    'ADMIN_SALITA',
    'RECEPCION'
  )
);

// Obtiene las opciones disponibles para crear notificaciones.
router.get(
  '/opciones',
  controller.opcionesEnvioController
);

// Busca los destinatarios de una audiencia.
router.post(
  '/destinatarios',
  controller.buscarDestinatariosController
);

// Obtiene una vista previa de los destinatarios.
router.post(
  '/preview',
  controller.previewEnvioController
);

// Obtiene el historial de envíos.
router.get(
  '/',
  controller.historialEnviosController
);

// Crea un nuevo envío de notificación.
router.post(
  '/',
  controller.crearEnvioController
);

// Obtiene el detalle de un envío.
router.get(
  '/:id',
  controller.detalleEnvioController
);

// Edita una notificación programada.
router.patch(
  '/:id',
  controller.editarEnvioController
);

// Cancela una notificación programada.
router.patch(
  '/:id/cancelar',
  controller.cancelarEnvioController
);

export default router;