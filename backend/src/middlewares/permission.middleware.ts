import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { assertRoleHasPermissions } from '../services/permission.service.js';
import type { PermissionInput } from '../types/permission.types.js';
import { AppError } from '../utils/app-error.js';

/**
 * Middleware de autorización por permisos basado en roles, rol_permisos y permisos.
 * Debe ejecutarse después de `authenticate`, usando exclusivamente `req.user`.
 *
 * Ejemplo:
 * `router.get('/...', authenticate, requirePermission('VER_HISTORIA_CLINICA'), clinicalScope(...), controller)`
 */
export const requirePermission = (
  ...requiredPermissions: PermissionInput[]
): RequestHandler => {
  if (requiredPermissions.length === 0) {
    throw new Error('requirePermission requiere al menos un permiso');
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id_usuario || !req.user.rol) {
        return next(new AppError('Usuario no autenticado', 401));
      }

      const roleData = await assertRoleHasPermissions(
        {
          ...(req.user.id_rol ? { idRol: req.user.id_rol } : {}),
          codigo: req.user.rol,
        },
        requiredPermissions
      );

      res.locals.userPermissions = Array.from(roleData.permissions);
      return next();
    } catch (error) {
      if (error instanceof AppError) {
        return next(error);
      }

      console.error('[requirePermission]', error);
      return next(new AppError('Error interno del servidor', 500));
    }
  };
};
