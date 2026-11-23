import type {
  NextFunction,
  Request,
  Response,
} from 'express';

import {
  buscarDestinatariosSchema,
  crearEnvioSchema,
  editarEnvioSchema,
  historialEnviosSchema,
  previewNotificacionSchema,
} from '../validators/notificacion-admin.validator.js';

import {
  notificacionIdSchema,
} from '../validators/notificacion.validator.js';

import {
  resolverDestinatarios,
} from '../services/notificacion-audiencia.service.js';

import {
  cancelarProgramacion,
  crearEnvio,
  detalleEnvio,
  editarProgramacion,
  historialEnvios,
  opcionesEnvio,
} from '../services/notificacion-admin.service.js';

// Edita una notificación que se encuentra programada.
export const editarEnvioController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } =
        notificacionIdSchema.parse(
          req.params
        );

      const data =
        editarEnvioSchema.parse(
          req.body
        );

      const envio =
        await editarProgramacion(
          req.user!,
          id,
          data
        );

      res.json({
        ok: true,
        envio,
      });
    } catch (error) {
      next(error);
    }
  };

// Obtiene las opciones disponibles para crear un envío.
export const opcionesEnvioController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const opciones =
        await opcionesEnvio(
          req.user!
        );

      res.json({
        ok: true,
        ...opciones,
      });
    } catch (error) {
      next(error);
    }
  };

// Obtiene una vista previa de los destinatarios de una audiencia.
export const previewEnvioController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { audiencia } =
        previewNotificacionSchema.parse(
          req.body
        );

      const destinatarios =
        await resolverDestinatarios(
          req.user!,
          audiencia
        );

      res.json({
        ok: true,
        ...destinatarios,
      });
    } catch (error) {
      next(error);
    }
  };

// Busca destinatarios dentro de la audiencia seleccionada.
export const buscarDestinatariosController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const {
        audiencia,
        buscar,
      } =
        buscarDestinatariosSchema.parse(
          req.body
        );

      const destinatarios =
        await resolverDestinatarios(
          req.user!,
          audiencia,
          buscar
        );

      res.json({
        ok: true,
        ...destinatarios,
      });
    } catch (error) {
      next(error);
    }
  };

// Crea un nuevo envío de notificación.
export const crearEnvioController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data =
        crearEnvioSchema.parse(
          req.body
        );

      const envio =
        await crearEnvio(
          req.user!,
          data
        );

      res.status(201).json({
        ok: true,
        envio,
      });
    } catch (error) {
      next(error);
    }
  };

// Obtiene el historial paginado de envíos.
export const historialEnviosController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const query =
        historialEnviosSchema.parse(
          req.query
        );

      const historial =
        await historialEnvios(
          req.user!,
          query.page,
          query.limit,
          query.programadas ===
            'true'
        );

      res.json({
        ok: true,
        ...historial,
      });
    } catch (error) {
      next(error);
    }
  };

// Obtiene el detalle de un envío.
export const detalleEnvioController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } =
        notificacionIdSchema.parse(
          req.params
        );

      const envio =
        await detalleEnvio(
          req.user!,
          id
        );

      res.json({
        ok: true,
        envio,
      });
    } catch (error) {
      next(error);
    }
  };

// Cancela una notificación programada.
export const cancelarEnvioController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } =
        notificacionIdSchema.parse(
          req.params
        );

      const envio =
        await cancelarProgramacion(
          req.user!,
          id
        );

      res.json({
        ok: true,
        envio,
      });
    } catch (error) {
      next(error);
    }
  };