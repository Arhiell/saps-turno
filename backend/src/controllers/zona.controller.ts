import type {
  Request,
  Response,
  NextFunction,
} from 'express';

import {
  createZonaSchema,
  updateZonaSchema,
} from '../validators/catalogo.validator.js';

import {
  getZonas,
  getZona,
  crearZona,
  actualizarZona,
  eliminarZona,
} from '../services/zona.service.js';

// Obtiene todas las zonas.
export const getAllZonas = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const zonas = await getZonas();

    return res.status(200).json({
      success: true,
      data: zonas,
    });
  } catch (error) {
    next(error);
  }
};

// Obtiene una zona por su identificador.
export const getZonaById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const zona = await getZona(
      String(req.params.id)
    );

    if (!zona) {
      return res.status(404).json({
        success: false,
        message: 'Zona no encontrada',
      });
    }

    return res.status(200).json({
      success: true,
      data: zona,
    });
  } catch (error) {
    next(error);
  }
};

// Crea una nueva zona.
export const createZona = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = createZonaSchema.parse(
      req.body
    );

    const zona = await crearZona(
      req.body
    );

    return res.status(201).json({
      success: true,
      data: zona,
    });
  } catch (error) {
    next(error);
  }
};

// Actualiza los datos de una zona.
export const updateZona = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = updateZonaSchema.parse(
      req.body
    );

    const zona = await actualizarZona(
      String(req.params.id),
      req.body
    );

    if (!zona) {
      return res.status(404).json({
        success: false,
        message: 'Zona no encontrada',
      });
    }

    return res.status(200).json({
      success: true,
      data: zona,
    });
  } catch (error) {
    next(error);
  }
};

// Elimina una zona por su identificador.
export const deleteZona = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const zona = await eliminarZona(
      String(req.params.id)
    );

    if (!zona) {
      return res.status(404).json({
        success: false,
        message: 'Zona no encontrada',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Zona eliminada correctamente',
      data: zona,
    });
  } catch (error) {
    next(error);
  }
};