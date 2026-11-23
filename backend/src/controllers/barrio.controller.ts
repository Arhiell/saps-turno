import type {
  Request,
  Response,
  NextFunction,
} from 'express';

import {
  createBarrioSchema,
  updateBarrioSchema,
} from '../validators/catalogo.validator.js';

import {
  getBarrios,
  getBarrio,
  crearBarrio,
  actualizarBarrio,
  eliminarBarrio,
} from '../services/barrio.service.js';

// Obtiene todos los barrios.
export const getAllBarrios = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const barrios = await getBarrios();

    return res.status(200).json({
      success: true,
      data: barrios,
    });
  } catch (error) {
    next(error);
  }
};

// Obtiene un barrio por su identificador.
export const getBarrioById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const barrio = await getBarrio(
      String(req.params.id)
    );

    if (!barrio) {
      return res.status(404).json({
        success: false,
        message: 'Barrio no encontrado',
      });
    }

    return res.status(200).json({
      success: true,
      data: barrio,
    });
  } catch (error) {
    next(error);
  }
};

// Crea un nuevo barrio.
export const createBarrio = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = createBarrioSchema.parse(
      req.body
    );

    const barrio = await crearBarrio(
      req.body
    );

    return res.status(201).json({
      success: true,
      data: barrio,
    });
  } catch (error) {
    next(error);
  }
};

// Actualiza los datos de un barrio.
export const updateBarrio = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = updateBarrioSchema.parse(
      req.body
    );

    const barrio = await actualizarBarrio(
      String(req.params.id),
      req.body
    );

    if (!barrio) {
      return res.status(404).json({
        success: false,
        message: 'Barrio no encontrado',
      });
    }

    return res.status(200).json({
      success: true,
      data: barrio,
    });
  } catch (error) {
    next(error);
  }
};

// Elimina un barrio por su identificador.
export const deleteBarrio = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const barrio = await eliminarBarrio(
      String(req.params.id)
    );

    if (!barrio) {
      return res.status(404).json({
        success: false,
        message: 'Barrio no encontrado',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Barrio eliminado correctamente',
      data: barrio,
    });
  } catch (error) {
    next(error);
  }
};