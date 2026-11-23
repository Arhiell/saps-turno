import type {
  AuthenticatedUser,
} from '../types/auth.types.js';

import type {
  Audiencia,
} from '../validators/notificacion-admin.validator.js';

import {
  getTurnoScope,
} from './turno-access.service.js';

import {
  findActiveSalitaById,
} from '../repositories/user.repository.js';

import {
  previewAudiencia,
} from '../repositories/notificacion-admin.repository.js';

import {
  AppError,
} from '../utils/app-error.js';

// Obtiene el alcance de salitas permitido para administrar notificaciones.
export const alcanceNotificaciones =
  async (
    user: AuthenticatedUser
  ) => {
    if (
      ![
        'SUPER_ADMIN',
        'ADMIN_SALITA',
      ].includes(user.rol)
    ) {
      throw new AppError(
        'No tenés permisos para administrar notificaciones.',
        403
      );
    }

    return getTurnoScope(
      user
    );
  };

// Valida que la audiencia pertenezca al alcance permitido del usuario.
export const validarAudiencia =
  async (
    user: AuthenticatedUser,
    audiencia: Audiencia
  ) => {
    const scope =
      await alcanceNotificaciones(
        user
      );

    // Limita al administrador a una de sus salitas vigentes,
    // incluso para destinatarios individuales.
    if (
      scope !== null &&
      (
        !audiencia.id_salita ||
        !scope.includes(
          audiencia.id_salita
        ) ||
        audiencia.rol ===
          'SUPER_ADMIN'
      )
    ) {
      throw new AppError(
        'No tenés permisos para enviar notificaciones a esta salita o audiencia.',
        403
      );
    }

    // Verifica que la salita seleccionada continúe activa.
    if (
      audiencia.id_salita &&
      !await findActiveSalitaById(
        audiencia.id_salita
      )
    ) {
      throw new AppError(
        'La salita seleccionada no está disponible.',
        400
      );
    }

    return scope;
  };

// Resuelve los destinatarios autorizados para la audiencia seleccionada.
export const resolverDestinatarios =
  async (
    user: AuthenticatedUser,
    audiencia: Audiencia,
    buscar?: string
  ) => {
    await validarAudiencia(
      user,
      audiencia
    );

    return previewAudiencia(
      audiencia,
      user.rol !==
        'SUPER_ADMIN',
      buscar,
      user.id_usuario
    );
  };