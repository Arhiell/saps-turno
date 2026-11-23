import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  historialTurnoParamsSchema,
  historialTurnoQuerySchema,
} from "../validators/historial-turno.validator.js";

import {
  getHistorialByTurno,
  getHistorialGeneral,
} from "../services/historial-turno.service.js";

export const getHistorialTurnoController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Valida el UUID antes de consultar la base.
    const { idTurno } =
      historialTurnoParamsSchema.parse(req.params);

    const historial =
      await getHistorialByTurno(idTurno, req.user!);

    res.status(200).json({
      ok: true,
      idTurno,
      total: historial.length,
      historial,
    });
  } catch (error) {
    next(error);
  }
};

export const getHistorialGeneralController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Convierte y valida filtros provenientes de query params.
    const filters =
      historialTurnoQuerySchema.parse(req.query);

    const result =
      await getHistorialGeneral(filters, req.user!);

    const totalPages =
      Math.ceil(result.total / filters.limit);

    res.status(200).json({
      ok: true,
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages,
      historial: result.data,
    });
  } catch (error) {
    next(error);
  }
};
