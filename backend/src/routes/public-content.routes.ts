import { Router } from 'express';

import * as controller from '../controllers/public-content.controller.js';

import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

// Rutas públicas de contenido.
export const publicContentRoutes = Router();

// Noticias públicas del sistema.
publicContentRoutes.get(
  '/noticias',
  controller.list
);

// Detalle de una noticia pública.
publicContentRoutes.get(
  '/noticias/:id',
  controller.detail
);

// Noticias obtenidas desde la fuente municipal.
publicContentRoutes.get(
  '/noticias-municipales',
  controller.municipal
);

// Rutas administrativas de contenido.
export const adminContentRoutes = Router();

// Requiere autenticación y permisos administrativos.
adminContentRoutes.use(
  authenticate,
  requireRole(
    'SUPER_ADMIN',
    'ADMIN_SALITA',
    'RECEPCION'
  )
);

// Opciones y categorías disponibles.
adminContentRoutes.get(
  '/categorias',
  controller.options
);

// Listado administrativo de noticias.
adminContentRoutes.get(
  '/noticias',
  controller.adminList
);

// Crea una nueva noticia.
adminContentRoutes.post(
  '/noticias',
  controller.save
);

// Obtiene el detalle administrativo de una noticia.
adminContentRoutes.get(
  '/noticias/:id',
  controller.adminDetail
);

// Actualiza una noticia existente.
adminContentRoutes.put(
  '/noticias/:id',
  controller.save
);