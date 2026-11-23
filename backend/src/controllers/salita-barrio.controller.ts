import type {
  Request,
  Response,
  NextFunction,
} from 'express';

import {
  createCoberturaSchema,
  updateCoberturaSchema,
} from '../validators/catalogo.validator.js';

import {
  getSalitaBarrios,
  getBarriosDeSalita,
  getSalitasDeBarrio,
  crearSalitaBarrio,
  actualizarSalitaBarrio,
  eliminarSalitaBarrio,
} from '../services/salita-barrio.service.js';

// Obtiene todas las relaciones entre salitas y barrios.
export const getAllSalitaBarrios = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const relaciones = await getSalitaBarrios();

    return res.status(200).json({
      success: true,
      data: relaciones,
    });
  } catch (error) {
    next(error);
  }
};

// Obtiene los barrios asociados a una salita.
export const getBarriosBySalita = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const relaciones = await getBarriosDeSalita(
      String(req.params.id)
    );

    return res.status(200).json({
      success: true,
      data: relaciones,
    });
  } catch (error) {
    next(error);
  }
};

// Obtiene las salitas asociadas a un barrio.
export const getSalitasByBarrio = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const relaciones = await getSalitasDeBarrio(
      String(req.params.id)
    );

    return res.status(200).json({
      success: true,
      data: relaciones,
    });
  } catch (error) {
    next(error);
  }
};

// Crea una relación entre una salita y un barrio.
export const createSalitaBarrio = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = createCoberturaSchema.parse(
      req.body
    );

    const relacion = await crearSalitaBarrio(
      req.body
    );

    return res.status(201).json({
      success: true,
      data: relacion,
    });
  } catch (error) {
    next(error);
  }
};

// Actualiza una relación entre una salita y un barrio.
export const updateSalitaBarrio = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = updateCoberturaSchema.parse(
      req.body
    );

    const relacion = await actualizarSalitaBarrio(
      String(req.params.idSalita),
      String(req.params.idBarrio),
      req.body
    );

    if (!relacion) {
      return res.status(404).json({
        success: false,
        message: 'Relación salita-barrio no encontrada',
      });
    }

    return res.status(200).json({
      success: true,
      data: relacion,
    });
  } catch (error) {
    next(error);
  }
};

// Elimina una relación entre una salita y un barrio.
export const deleteSalitaBarrio = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const relacion = await eliminarSalitaBarrio(
      String(req.params.idSalita),
      String(req.params.idBarrio)
    );

    if (!relacion) {
      return res.status(404).json({
        success: false,
        message: 'Relación salita-barrio no encontrada',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Relación eliminada correctamente',
      data: relacion,
    });
  } catch (error) {
    next(error);
  }
};