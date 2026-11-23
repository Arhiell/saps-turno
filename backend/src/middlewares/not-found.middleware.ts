// Para las rutas inexistentes, se lanza un error 404
// y se pasa al siguiente middleware de manejo de errores.

import type {
  Request,
  Response,
  NextFunction
} from "express";

import {
  AppError
} from "../utils/app-error.js";

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  next(
    new AppError(
      `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
      404
    )
  );
};
