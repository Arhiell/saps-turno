import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  auditoriaIdSchema,
  auditoriaQuerySchema,
} from "../validators/auditoria.validator.js";

import {
  getAuditorias,
  getAuditoriaById,
} from "../services/auditoria.service.js";

export const getAuditoriasController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filters =
      auditoriaQuerySchema.parse(req.query);

    const result =
      await getAuditorias(filters);

    res.status(200).json({
      ok: true,
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: Math.ceil(
        result.total / filters.limit,
      ),
      auditorias: result.data,
    });
  } catch (error) {
    next(error);
  }
};

export const getAuditoriaByIdController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } =
      auditoriaIdSchema.parse(req.params);

    const auditoria =
      await getAuditoriaById(id);

    res.status(200).json({
      ok: true,
      auditoria,
    });
  } catch (error) {
    next(error);
  }
};