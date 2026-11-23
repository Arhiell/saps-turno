// Errores Globales

import type {
  Request,
  Response,
  NextFunction
} from "express";

import { ZodError } from "zod";
import { AppError } from "../utils/app-error.js";
import { duplicateError } from "../utils/duplicate-error.js";

type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error(error);
  error = duplicateError(error) ?? error;

  // Errores controlados de la aplicación
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.code
        ? {
            code: error.code,
          }
        : {}),
      ...(error.data
        ? {
            data: error.data,
          }
        : {}),
    });
  }

  // Errores de validación de Zod
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Error de validación",
      errors: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  // Errores provenientes de PostgreSQL / Supabase
  const databaseError = error as DatabaseError;

  // Horarios profesionales superpuestos
  if (databaseError.code === "23P01") {
    return res.status(409).json({
      success: false,
      message: "El horario se superpone con otro horario existente"
    });
  }

  // Violación de clave foránea
  if (databaseError.code === "23503") {
    return res.status(400).json({
      success: false,
      message: "La relación indicada no existe o no es válida"
    });
  }

  // Violación de constraint CHECK
  if (databaseError.code === "23514") {
    return res.status(400).json({
      success: false,
      message: "Los datos enviados no cumplen las reglas de la base de datos"
    });
  }

  // Errores de validación de los servicios
  if (error instanceof Error) {
    const mensajesValidacion = [
      "La hora de inicio debe ser menor que la hora de fin",
      "La fecha de vigencia hasta debe ser mayor o igual a la fecha de vigencia desde",
      "Un bloqueo de día completo no puede tener horario",
      "Debe indicar la hora de inicio para un bloqueo parcial",
      "Debe indicar la hora de fin para un bloqueo parcial"
    ];

    if (mensajesValidacion.includes(error.message)) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Error no contemplado
  return res.status(500).json({
    success: false,
    message: "Error interno del servidor"
  });
};
