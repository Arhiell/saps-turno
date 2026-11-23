
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import {
  listCierres,
  guardarCierre,
  desactivarCierre,
} from '../services/cierre-calendario.service.js';

import {
  sincronizarFeriados,
  estadoSincronizacion,
} from '../services/calendario-sync.service.js';

// Sincroniza los feriados del calendario.
export const sincronizar = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Valida que la solicitud no contenga campos adicionales.
    z.object({}).strict().parse(req.body ?? {});

    res.json(
      await sincronizarFeriados(req.user!)
    );
  } catch (error) {
    next(error);
  }
};

// Consulta el estado de sincronización del calendario.
export const estadoSync = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    res.json(
      await estadoSincronizacion(req.user!)
    );
  } catch (error) {
    next(error);
  }
};

// Obtiene los cierres de calendario disponibles para el usuario.
export const listar = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    res.json(
      await listCierres(req.user!)
    );
  } catch (error) {
    next(error);
  }
};

// Crea o actualiza un cierre de calendario.
export const guardar = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Valida el identificador cuando se actualiza un cierre.
    const id = req.params.id
      ? z.string().uuid().parse(req.params.id)
      : undefined;

    // Devuelve 200 al actualizar y 201 al crear.
    res.status(id ? 200 : 201).json(
      await guardarCierre(
        req.body,
        req.user!,
        id
      )
    );
  } catch (error) {
    next(error);
  }
};

// Desactiva un cierre de calendario existente.
export const desactivar = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Valida el identificador antes de desactivar el cierre.
    res.json(
      await desactivarCierre(
        z.string().uuid().parse(req.params.id),
        req.user!
      )
    );
  } catch (error) {
    next(error);
  }
};