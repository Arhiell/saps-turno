import type {
  Request,
  Response,
  NextFunction,
} from 'express';

import {
  createEspecialidadSchema,
  updateEspecialidadSchema,
} from '../validators/catalogo.validator.js';

import {
  getEspecialidades,
  getEspecialidad,
  crearEspecialidad,
  actualizarEspecialidad,
  eliminarEspecialidad,
} from '../services/especialidad.service.js';

// Obtiene todas las especialidades.
export const getAllEspecialidades = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const especialidades = await getEspecialidades();

    return res.status(200).json({
      success: true,
      data: especialidades,
    });
  } catch (error) {
    next(error);
  }
};

// Obtiene una especialidad por su identificador.
export const getEspecialidadById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const especialidad = await getEspecialidad(
      String(req.params.id)
    );

    if (!especialidad) {
      return res.status(404).json({
        success: false,
        message: 'Especialidad no encontrada',
      });
    }

    return res.status(200).json({
      success: true,
      data: especialidad,
    });
  } catch (error) {
    next(error);
  }
};

// Crea una nueva especialidad.
export const createEspecialidad = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = createEspecialidadSchema.parse(
      req.body
    );

    const especialidad = await crearEspecialidad(
      req.body
    );

    return res.status(201).json({
      success: true,
      data: especialidad,
    });
  } catch (error) {
    next(error);
  }
};

// Actualiza los datos de una especialidad.
export const updateEspecialidad = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = updateEspecialidadSchema.parse(
      req.body
    );

    const especialidad = await actualizarEspecialidad(
      String(req.params.id),
      req.body
    );

    if (!especialidad) {
      return res.status(404).json({
        success: false,
        message: 'Especialidad no encontrada',
      });
    }

    return res.status(200).json({
      success: true,
      data: especialidad,
    });
  } catch (error) {
    next(error);
  }
};

// Elimina una especialidad por su identificador.
export const deleteEspecialidad = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const especialidad = await eliminarEspecialidad(
      String(req.params.id)
    );

    if (!especialidad) {
      return res.status(404).json({
        success: false,
        message: 'Especialidad no encontrada',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Especialidad eliminada correctamente',
      data: especialidad,
    });
  } catch (error) {
    next(error);
  }
};