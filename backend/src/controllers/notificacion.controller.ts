import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  notificacionIdSchema,
  notificacionQuerySchema,
} from "../validators/notificacion.validator.js";

import {
  getNotificacionesUsuario,
  getNotificacionUsuario,
  readNotificacion,
  readAllNotificaciones,
} from "../services/notificacion.service.js";

const getUserId = (req: Request) => {
  return req.user!.id_usuario;
};

export const getNotificacionesController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filters =
      notificacionQuerySchema.parse(req.query);

    const result =
      await getNotificacionesUsuario(
        getUserId(req),
        filters,
      );

    res.status(200).json({
      ok: true,
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: Math.ceil(
        result.total / filters.limit,
      ),
      notificaciones: result.data,
    });
  } catch (error) {
    next(error);
  }
};

export const getNotificacionController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } =
      notificacionIdSchema.parse(req.params);

    const notificacion =
      await getNotificacionUsuario(
        id,
        getUserId(req),
      );

    res.status(200).json({
      ok: true,
      notificacion,
    });
  } catch (error) {
    next(error);
  }
};

export const leerNotificacionController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } =
      notificacionIdSchema.parse(req.params);

    const notificacion =
      await readNotificacion(
        id,
        getUserId(req),
      );

    res.status(200).json({
      ok: true,
      message: "Notificación marcada como leída",
      notificacion,
    });
  } catch (error) {
    next(error);
  }
};

export const leerTodasController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result =
      await readAllNotificaciones(
        getUserId(req),
      );

    res.status(200).json({
      ok: true,
      message: "Notificaciones actualizadas",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
