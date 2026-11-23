import {
  AppError,
} from '../utils/app-error.js';

import {
  createNotificacion,
  findNotificacionById,
  findNotificacionesByUsuario,
  markAllNotificacionesAsRead,
  markNotificacionAsRead,
} from '../repositories/notificacion.repository.js';

import type {
  CreateNotificacionInput,
  NotificacionQuery,
} from '../validators/notificacion.validator.js';

// Crea una notificación interna del sistema.
export const sendSystemNotification =
  async (
    input: CreateNotificacionInput
  ) => {
    return createNotificacion(
      input
    );
  };

// Obtiene las notificaciones de un usuario aplicando los filtros indicados.
export const getNotificacionesUsuario =
  async (
    idUsuario: string,
    filters: NotificacionQuery
  ) => {
    return findNotificacionesByUsuario(
      idUsuario,
      filters
    );
  };

// Obtiene una notificación específica perteneciente al usuario.
export const getNotificacionUsuario =
  async (
    id: string,
    idUsuario: string
  ) => {
    const notificacion =
      await findNotificacionById(
        id,
        idUsuario
      );

    if (!notificacion) {
      throw new AppError(
        'La notificación no existe',
        404
      );
    }

    return notificacion;
  };

// Marca una notificación como leída.
export const readNotificacion =
  async (
    id: string,
    idUsuario: string
  ) => {
    // Actualiza directamente por ID y usuario en el repositorio.
    // Esto evita hacer una consulta previa para comprobar si existe
    // y otra consulta para marcarla como leída.
    const result =
      await markNotificacionAsRead(
        id,
        idUsuario
      );

    if (!result) {
      // Distingue entre una notificación inexistente y una ya leída
      // solo si el repositorio puede devolver ambas situaciones por separado.
      // Con el contrato actual, null se trata como conflicto para conservar
      // el comportamiento esperado del servicio.
      throw new AppError(
        'No fue posible actualizar la notificación',
        409
      );
    }

    return result;
  };

// Marca todas las notificaciones del usuario como leídas.
export const readAllNotificaciones =
  async (
    idUsuario: string
  ) => {
    const updated =
      await markAllNotificacionesAsRead(
        idUsuario
      );

    return {
      actualizadas:
        updated,
    };
  };
