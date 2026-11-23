
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  actualizarBloqueo,
  crearBloqueo,
  eliminarBloqueo,
  getBloqueo,
  getBloqueos,
} from "../services/bloqueo-agenda.service.js";

// Obtiene los bloqueos de agenda según las salitas autorizadas.
export const obtenerBloqueos = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const bloqueos = await getBloqueos(res.locals.salitaScope);

    return res.status(200).json(bloqueos);
  } catch (error) {
    next(error);
  }
};

// Obtiene un bloqueo de agenda por su identificador.
export const obtenerBloqueo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = String(req.params.id);

    const bloqueo = await getBloqueo(id);

    // Verifica que el bloqueo exista.
    if (!bloqueo) {
      return res.status(404).json({
        message: "Bloqueo no encontrado",
      });
    }

    return res.status(200).json(bloqueo);
  } catch (error) {
    next(error);
  }
};

// Crea un bloqueo de agenda asociado al usuario autenticado.
export const crearBloqueoController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const bloqueo = await crearBloqueo(
      req.body,
      req.user!.id_usuario
    );

    return res.status(201).json(bloqueo);
  } catch (error) {
    next(error);
  }
};

// Actualiza un bloqueo de agenda existente.
export const actualizarBloqueoController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = String(req.params.id);

    const bloqueo = await actualizarBloqueo(
      id,
      req.body,
      req.user!.id_usuario
    );

    // Verifica que el bloqueo exista antes de responder.
    if (!bloqueo) {
      return res.status(404).json({
        message: "Bloqueo no encontrado",
      });
    }

    return res.status(200).json(bloqueo);
  } catch (error) {
    next(error);
  }
};

// Desactiva un bloqueo de agenda existente.
export const eliminarBloqueoController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = String(req.params.id);

    const bloqueo = await eliminarBloqueo(
      id,
      req.user!.id_usuario
    );

    // Verifica que el bloqueo exista.
    if (!bloqueo) {
      return res.status(404).json({
        message: "Bloqueo no encontrado",
      });
    }

    return res.status(200).json({
      message: "Bloqueo desactivado correctamente",
      bloqueo,
    });
  } catch (error) {
    next(error);
  }
};
