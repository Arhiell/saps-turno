import {
  canViewAccount,
} from '../repositories/account-display.select.js';

export { 
  publicSalitas as getPublicSalitas 
} from '../repositories/public-salitas.repository.js';

import {
  createSalita,
  deleteSalita,
  getAllSalitas,
  getSalitaById,
  getSalitasByIds,
  updateSalita,
} from '../repositories/salita.repository.js';

import type {
  AuthenticatedUser,
} from '../types/auth.types.js';

import {
  getTurnoScope,
} from './turno-access.service.js';

import {
  emitirCambioSalita,
} from './socket.service.js';

// Obtiene todas las salitas disponibles.
export const getSalitas = async () => {
  return await getAllSalitas();
};

// Obtiene las salitas administrativas según el alcance del usuario.
export const getSalitasAdministrativas = async (
  user: AuthenticatedUser
) => {
  const scope =
    await getTurnoScope(user);

  // El SUPER_ADMIN puede acceder a todas las salitas.
  if (scope === null) {
    return await getAllSalitas(
      canViewAccount(user)
    );
  }

  // Limita las salitas según el alcance asignado al usuario.
  return await getSalitasByIds(
    scope,
    canViewAccount(user)
  );
};

// Obtiene una salita por su identificador.
export const getSalita = async (
  id: string
) => {
  return await getSalitaById(
    id
  );
};

// Crea una nueva salita.
export const crearSalita = async (
  salita: {
    codigo: string;
    nombre: string;
    direccion: string;
    id_barrio: string;
    telefono?: string | null;
    email?: string | null;
    latitud?: number | null;
    longitud?: number | null;
    horario_apertura?: string | null;
    horario_cierre?: string | null;
    activo?: boolean;
  }
) => {
  const created = await createSalita(
    salita
  );

  try {
    emitirCambioSalita({
      tipo: 'SALITA_CREADA',
      mensaje: `Nueva salita creada: ${created.nombre}`,
      id_salita: created.id_salita,
      activo: created.activo,
    });
  } catch {
    // Notificación en tiempo real es complementaria
  }

  return created;
};

// Actualiza los datos de una salita.
export const actualizarSalita = async (
  id: string,
  salita: {
    codigo?: string;
    nombre?: string;
    direccion?: string;
    id_barrio?: string;
    telefono?: string | null;
    email?: string | null;
    latitud?: number | null;
    longitud?: number | null;
    horario_apertura?: string | null;
    horario_cierre?: string | null;
    activo?: boolean;
  }
) => {
  const updated = await updateSalita(
    id,
    salita
  );

  try {
    const esCambioEstado = typeof salita.activo === 'boolean';
    emitirCambioSalita({
      tipo: esCambioEstado ? 'SALITA_ESTADO_CAMBIADO' : 'SALITA_ACTUALIZADA',
      mensaje: esCambioEstado
        ? `Estado de salita ${salita.activo ? 'activado' : 'desactivado'}`
        : `Datos de salita actualizados`,
      id_salita: id,
      activo: updated?.activo,
    });
  } catch {
    // Notificación en tiempo real es complementaria
  }

  return updated;
};

// Realiza la baja lógica de una salita.
export const eliminarSalita = async (
  id: string
) => {
  const deleted = await deleteSalita(
    id
  );

  try {
    emitirCambioSalita({
      tipo: 'SALITA_ESTADO_CAMBIADO',
      mensaje: `Salita dada de baja (inactivada)`,
      id_salita: id,
      activo: false,
    });
  } catch {
    // Notificación en tiempo real es complementaria
  }

  return deleted;
};
