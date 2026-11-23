import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  createSancionSchema,
  sancionIdSchema,
  anularSancionSchema,
  sancionQuerySchema,
} from "../validators/sancion.validator.js";

import {
  registerSancion,
  getSancionById,
  getSanciones,
  cancelSancion,
} from "../services/sancion.service.js";

export const createSancionController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input = createSancionSchema.parse(req.body);

    // Guarda quién aplicó la sanción cuando el usuario está autenticado.
    const sancion = await registerSancion(
      input,
      req.user?.id_usuario,
    );

    res.status(201).json({
      ok: true,
      message: "Sanción registrada correctamente",
      sancion,
    });
  } catch (error) {
    next(error);
  }
};

export const getSancionesController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filters =
      sancionQuerySchema.parse(req.query);

    const result = await getSanciones(filters);

    res.status(200).json({
      ok: true,
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: Math.ceil(
        result.total / filters.limit,
      ),
      sanciones: result.data,
    });
  } catch (error) {
    next(error);
  }
};

export const getSancionByIdController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = sancionIdSchema.parse(req.params);

    const sancion = await getSancionById(id);

    res.status(200).json({
      ok: true,
      sancion,
    });
  } catch (error) {
    next(error);
  }
};

export const anularSancionController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = sancionIdSchema.parse(req.params);
    const { motivo_anulacion } =
      anularSancionSchema.parse(req.body);

    const sancion = await cancelSancion(
      id,
      motivo_anulacion,
      req.user?.id_usuario,
    );

    res.status(200).json({
      ok: true,
      message: "Sanción anulada correctamente",
      sancion,
    });
  } catch (error) {
    next(error);
  }
};