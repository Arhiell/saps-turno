import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/permission.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { GENERAL_PERMISSIONS } from '../types/permission.types.js';

import {
  changeManagedAccess,
  correctManagedPerson,
  listManagedRecords,
} from '../services/access-management.service.js';

// Inicializa las rutas de gestión de cuentas y datos personales.
const router = Router();

// Restringe el acceso a usuarios autorizados de salita y administración general.
router.use(
  authenticate,
  requireRole('SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION')
);

// Obtiene las cuentas administrativas con filtros y paginación dentro del alcance de salitas.
router.get('/accounts', requirePermission(GENERAL_PERMISSIONS.GESTIONAR_USUARIOS), async (req, res, next) => {
  try {
    // Valida los parámetros de consulta.
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .default(1)
      .parse(req.query.page);

    const search = z
      .string()
      .trim()
      .max(100)
      .default('')
      .parse(req.query.search);

    const role = z
      .enum(['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'])
      .optional()
      .parse(req.query.role);

    const clinic = z
      .string()
      .uuid()
      .optional()
      .parse(req.query.clinic);

    // Consulta las cuentas según los filtros proporcionados.
    res.json({
      success: true,
      data: await listManagedRecords(req.user!, {
        page,
        search,
        ...(role ? { role } : {}),
        ...(clinic ? { clinic } : {}),
      }),
    });
  } catch (error) {
    next(error);
  }
});

// Activa o desactiva una cuenta administrativa (requiere permiso GESTIONAR_USUARIOS).
router.patch('/accounts/:id/status', requirePermission(GENERAL_PERMISSIONS.GESTIONAR_USUARIOS), async (req, res, next) => {
  try {
    // Valida el identificador y el nuevo estado de la cuenta.
    const id = z
      .string()
      .uuid()
      .parse(req.params.id);

    const { activo } = z
      .object({
        activo: z.boolean(),
      })
      .strict()
      .parse(req.body);

    // Actualiza el estado de acceso de la cuenta.
    await changeManagedAccess(req.user!, id, activo);

    res.json({
      success: true,
      message: activo
        ? 'Cuenta reactivada.'
        : 'Cuenta dada de baja.',
    });
  } catch (error) {
    next(error);
  }
});

// Permite corregir los datos personales de un usuario administrado (requiere permiso GESTIONAR_USUARIOS).
router.patch('/people/:id', requirePermission(GENERAL_PERMISSIONS.GESTIONAR_USUARIOS), async (req, res, next) => {
  try {
    // Valida el identificador de la persona.
    const id = z
      .string()
      .uuid()
      .parse(req.params.id);

    // Actualiza los datos personales autorizados.
    res.json({
      success: true,
      data: await correctManagedPerson(
        req.user!,
        id,
        req.body
      ),
      message: 'Datos personales corregidos.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
