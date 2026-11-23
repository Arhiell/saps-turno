
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  actualizarHorario,
  crearHorario,
  eliminarHorario,
  getHorario,
  getHorarios,
} from "../services/horario-atencion.service.js";

// Obtiene los horarios de atención de las salitas autorizadas.
export const obtenerHorarios = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const horarios = await getHorarios(res.locals.salitaScope);

    return res.status(200).json(horarios);
  } catch (error) {
    next(error);
  }
};

// Obtiene un horario de atención por su identificador.
export const obtenerHorario = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = String(req.params.id);

    const horario = await getHorario(id);

    // Verifica que el horario exista.
    if (!horario) {
      return res.status(404).json({
        message: "Horario no encontrado",
      });
    }

    return res.status(200).json(horario);
  } catch (error) {
    next(error);
  }
};

// Crea un horario de atención asociado al usuario autenticado.
export const crearHorarioController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const horario = await crearHorario(
      req.body,
      req.user!.id_usuario
    );

    return res.status(201).json(horario);
  } catch (error) {
    next(error);
  }
};

// Actualiza un horario de atención existente.
export const actualizarHorarioController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = String(req.params.id);

    const horario = await actualizarHorario(
      id,
      req.body,
      req.user!.id_usuario
    );

    // Verifica que el horario exista.
    if (!horario) {
      return res.status(404).json({
        message: "Horario no encontrado",
      });
    }

    return res.status(200).json(horario);
  } catch (error) {
    next(error);
  }
};

// Desactiva un horario de atención existente.
export const eliminarHorarioController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = String(req.params.id);

    const horario = await eliminarHorario(
      id,
      req.user!.id_usuario
    );

    // Verifica que el horario exista.
    if (!horario) {
      return res.status(404).json({
        message: "Horario no encontrado",
      });
    }

    return res.status(200).json({
      message: "Horario desactivado correctamente",
      horario,
    });
  } catch (error) {
    next(error);
  }
};
