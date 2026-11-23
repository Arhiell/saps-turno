import type {
  Request,
  Response,
  NextFunction,
} from 'express';

import {
  createSalitaSchema,
  updateSalitaSchema,
} from '../validators/catalogo.validator.js';

import {
  getSalitas,
  getPublicSalitas,
  getSalitasAdministrativas,
  getSalita,
  crearSalita,
  actualizarSalita,
  eliminarSalita,
} from '../services/salita.service.js';

// Obtiene todas las salitas.
export const getAllSalitas = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const salitas = req.query.vista === 'publica' ? await getPublicSalitas() : await getSalitas();

    return res.status(200).json({
      success: true,
      data: salitas,
    });
  } catch (error) {
    next(error);
  }
};

// Obtiene las salitas disponibles para el usuario administrador.
export const getAdminSalitas = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const salitas = await getSalitasAdministrativas(
      req.user!
    );

    return res.status(200).json({
      success: true,
      data: salitas,
    });
  } catch (error) {
    next(error);
  }
};

// Obtiene una salita por su identificador.
export const getSalitaById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const salita = await getSalita(
      String(req.params.id)
    );

    if (!salita) {
      return res.status(404).json({
        success: false,
        message: 'Salita no encontrada',
      });
    }

    return res.status(200).json({
      success: true,
      data: salita,
    });
  } catch (error) {
    next(error);
  }
};

// Crea una nueva salita.
export const createSalita = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = createSalitaSchema.parse(
      req.body
    );

    const salita = await crearSalita(
      req.body
    );

    return res.status(201).json({
      success: true,
      data: salita,
    });
  } catch (error) {
    next(error);
  }
};

// Actualiza los datos de una salita.
export const updateSalita = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = updateSalitaSchema.parse(
      req.body
    );

    const salita = await actualizarSalita(
      String(req.params.id),
      req.body
    );

    if (!salita) {
      return res.status(404).json({
        success: false,
        message: 'Salita no encontrada',
      });
    }

    return res.status(200).json({
      success: true,
      data: salita,
    });
  } catch (error) {
    next(error);
  }
};

// Elimina una salita por su identificador.
export const deleteSalita = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const salita = await eliminarSalita(
      String(req.params.id)
    );

    if (!salita) {
      return res.status(404).json({
        success: false,
        message: 'Salita no encontrada',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Salita eliminada correctamente',
      data: salita,
    });
  } catch (error) {
    next(error);
  }
};
