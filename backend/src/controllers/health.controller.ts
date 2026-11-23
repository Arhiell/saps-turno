import type {
  Request,
  Response,
  NextFunction
} from "express";

import {
  checkDatabaseConnection
} from "../services/health.service.js";

/**
 * Verifica únicamente que la API esté funcionando.
 */
export const healthCheck = (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "SAPS Turno API funcionando correctamente",
    timestamp: new Date().toISOString(),
  });
};

/**
 * Verifica conexión real con Supabase/PostgreSQL.
 */
export const databaseHealthCheck = async (
  _req: Request, res: Response, next: NextFunction) => {
    try {
      const database = await checkDatabaseConnection();

      res.status(200).json({
        success: true,
        message: "Conexión con la base de datos correcta",
        data: database,
      });
    } catch (error) {
      next(error);
    }
};
