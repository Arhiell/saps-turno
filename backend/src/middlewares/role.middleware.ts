import type {
  Request,
  Response,
  NextFunction
} from "express";

import {
  AppError
} from "../utils/app-error.js";

/**
 * Restringe una ruta a determinados roles.
 *
 * Ejemplo:
 * requireRole("SUPER_ADMIN", "ADMIN_SALITA")
 */
export const requireRole = (
  ...allowedRoles: string[]
) => {
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    /**
     * Primero verificamos que authenticate
     * haya colocado el usuario en req.user.
     */
    if (!req.user) {
      return next(
        new AppError(
          "Usuario no autenticado",
          401
        )
      );
    }

    /**
     * Verificamos que el rol del usuario
     * esté entre los permitidos.
     */
    if (
      !allowedRoles.includes(
        req.user.rol
      )
    ) {
      return next(
        new AppError(
          "No tiene permisos para realizar esta acción",
          403
        )
      );
    }

    /**
     * Usuario autenticado y autorizado.
     */
    next();
  };

};
