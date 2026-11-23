import type {
  Request,
  Response,
  NextFunction
} from "express";

import {
  getSalitasProfesional,
  agregarSalitaProfesional,
  actualizarSalitaProfesional,
  eliminarSalitaProfesional
} from "../services/profesional-salita.service.js";

export const getSalitas = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const salitas = await getSalitasProfesional(
      String(req.params.id), res.locals.salitaScope
    );

    return res.status(200).json({
      success: true,
      data: salitas
    });
  } catch (error) {
    next(error);
  }
};

export const createSalita = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const relacion =
      await agregarSalitaProfesional(
        String(req.params.id),
        req.body
      );

    return res.status(201).json({
      success: true,
      message:
        "Salita asignada al profesional correctamente",
      data: relacion
    });
  } catch (error) {
    next(error);
  }
};

export const updateSalita = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const relacion =
      await actualizarSalitaProfesional(
        String(req.params.id),
        String(req.params.idSalita),
        req.body
      );

    if (!relacion) {
      return res.status(404).json({
        success: false,
        message:
          "La relación profesional-salita no existe"
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Asignación de salita actualizada correctamente",
      data: relacion
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSalita = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const relacion =
      await eliminarSalitaProfesional(
        String(req.params.id),
        String(req.params.idSalita)
      );

    if (!relacion) {
      return res.status(404).json({
        success: false,
        message:
          "La relación profesional-salita no existe"
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Salita quitada del profesional correctamente",
      data: relacion
    });
  } catch (error) {
    next(error);
  }
};