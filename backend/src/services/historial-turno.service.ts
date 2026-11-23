import {
  AppError,
} from '../utils/app-error.js';

import {
  findTurnoForHistorial,
  findHistorialByTurno,
  findHistorialGeneral,
} from '../repositories/historial-turno.repository.js';

import type {
  HistorialTurnoQuery,
} from '../validators/historial-turno.validator.js';

import type {
  AuthenticatedUser,
} from '../types/auth.types.js';

import {
  getTurnoScope,
  assertTurnoScope,
} from './turno-access.service.js';

import {
  getTurno,
} from './turno-read.service.js';

// ========================================
// HISTORIAL DE UN TURNO
// ========================================

// Consulta el historial solamente si el turno existe.
export const getHistorialByTurno = async (
  idTurno: string,
  user: AuthenticatedUser
) => {
  // Pacientes y profesionales solo pueden consultar sus propios turnos.
  if (user.rol === 'PACIENTE' || user.rol === 'PROFESIONAL') {
    await getTurno(
      idTurno,
      user
    );

    const rows = await findHistorialByTurno(
      idTurno
    );

    // No expone correos del personal
    // ni detalles administrativos libres.
    return rows.map(
      ({
        id_historial,
        accion,
        fecha,
        fecha_hora_anterior,
        fecha_hora_nueva,
        estado_nuevo,
      }) => {
        const state = Array.isArray(
          estado_nuevo
        )
          ? estado_nuevo[0]
          : estado_nuevo;

        return {
          id_historial,
          accion,
          fecha,
          fecha_hora_anterior,
          fecha_hora_nueva,
          estado_nombre:
            state?.nombre ?? null,
        };
      }
    );
  }

  // Obtiene las salitas permitidas para el usuario.
  const scope = await getTurnoScope(
    user
  );

  // Verifica que el turno exista.
  const turnoExiste =
    await findTurnoForHistorial(
      idTurno
    );

  if (!turnoExiste) {
    throw new AppError(
      'El turno solicitado no existe',
      404
    );
  }

  // Verifica que el turno pertenezca
  // a una salita dentro del alcance del usuario.
  assertTurnoScope(
    scope,
    turnoExiste.id_salita
  );

  // Devuelve el historial completo del turno.
  return findHistorialByTurno(
    idTurno
  );
};

// ========================================
// HISTORIAL GENERAL
// ========================================

// Consulta el historial administrativo aplicando filtros.
export const getHistorialGeneral = async (
  filters: HistorialTurnoQuery,
  user: AuthenticatedUser
) => {
  // Obtiene las salitas permitidas para el usuario.
  const scope = await getTurnoScope(
    user
  );

  // Si no tiene salitas asignadas, devuelve un resultado vacío.
  if (scope?.length === 0) {
    return {
      data: [],
      total: 0,
    };
  }

  // Busca el historial aplicando filtros y alcance.
  return findHistorialGeneral(
    filters,
    scope
  );
};
