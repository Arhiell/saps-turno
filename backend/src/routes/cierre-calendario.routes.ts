
import { Router } from 'express';

import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

import {
  listar,
  guardar,
  desactivar,
  sincronizar,
  estadoSync,
} from '../controllers/cierre-calendario.controller.js';

// Inicializa el enrutador de cierres de calendario.
const router = Router();

// Restringe el acceso a usuarios autenticados con roles de gestión de salita o administración general.
router.use(
  authenticate,
  requireRole('SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION')
);

// Obtiene los cierres de calendario.
router.get('/', listar);

// Consulta el estado de sincronización de feriados.
router.get('/sincronizacion', estadoSync);

// Permite sincronizar feriados únicamente al superadministrador.
router.post(
  '/sincronizacion',
  requireRole('SUPER_ADMIN'),
  sincronizar
);

// Crea un nuevo cierre de calendario.
router.post('/', guardar);

// Actualiza un cierre de calendario existente.
router.put('/:id', guardar);

// Desactiva un cierre de calendario.
router.delete('/:id', desactivar);

export default router;
