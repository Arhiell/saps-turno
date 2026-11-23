import type {
  Request,
  Response,
  NextFunction
} from "express";

import {
  getEspecialidadesProfesional,
  agregarEspecialidadProfesional,
  actualizarEspecialidadProfesional,
  eliminarEspecialidadProfesional
} from "../services/profesional-especialidad.service.js";

export const getEspecialidades = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const especialidades =
      await getEspecialidadesProfesional(
        String(req.params.id)
      );

    return res.status(200).json({
      success: true,
      data: especialidades
    });
  } catch (error) {
    next(error);
  }
};

export const createEspecialidad = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const relacion =
      await agregarEspecialidadProfesional(
        String(req.params.id),
        req.body
      );

    return res.status(201).json({
      success: true,
      message:
        "Especialidad asignada al profesional correctamente",
      data: relacion
    });
  } catch (error) {
    next(error);
  }
};

export const updateEspecialidad = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const relacion =
      await actualizarEspecialidadProfesional(
        String(req.params.id),
        String(req.params.idEspecialidad),
        req.body
      );

    if (!relacion) {
      return res.status(404).json({
        success: false,
        message:
          "La relación profesional-especialidad no existe"
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Especialidad del profesional actualizada correctamente",
      data: relacion
    });
  } catch (error) {
    next(error);
  }
};

export const deleteEspecialidad = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const relacion =
      await eliminarEspecialidadProfesional(
        String(req.params.id),
        String(req.params.idEspecialidad)
      );

    if (!relacion) {
      return res.status(404).json({
        success: false,
        message:
          "La relación profesional-especialidad no existe"
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Especialidad quitada del profesional correctamente",
      data: relacion
    });
  } catch (error) {
    next(error);
  }
};