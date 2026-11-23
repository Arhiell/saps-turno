
import type { AuthenticatedUser } from '../types/auth.types.js';
import type { CierreInput } from '../validators/cierre-calendario.validator.js';

import {
  assertTurnoScope,
  getTurnoScope,
} from './turno-access.service.js';

import { findCierre } from '../repositories/cierre-calendario.repository.js';
import { getSalitaById } from '../repositories/salita.repository.js';
import { AppError } from '../utils/app-error.js';

// Obtiene el alcance autorizado para gestionar cierres institucionales.
export const cierreScope = async (
  user: AuthenticatedUser
) => {
  // Restringe el acceso a usuarios con roles administrativos o de salita.
  if (
    !['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'].includes(user.rol)
  ) {
    throw new AppError(
      'No tiene permisos para gestionar cierres institucionales',
      403
    );
  }

  return getTurnoScope(user);
};

// Verifica que el cierre pertenezca al alcance autorizado.
export const assertCierreScope = (
  scope: string[] | null,
  datos: Pick<CierreInput, 'alcance' | 'id_salita'>
) => {
  // El alcance nulo permite gestionar cierres globales y por salita.
  if (scope === null) {
    return;
  }

  // Impide que un administrador de salita gestione cierres globales.
  if (datos.alcance === 'GLOBAL') {
    throw new AppError(
      'Solo SUPER_ADMIN puede gestionar cierres globales',
      403
    );
  }

  // Comprueba que la salita esté dentro del alcance autorizado.
  assertTurnoScope(scope, datos.id_salita!);
};

// Autoriza la creación o modificación de un cierre institucional.
export const authorizeCierre = async (
  user: AuthenticatedUser,
  datos: CierreInput,
  id?: string
) => {
  // Obtiene las salitas autorizadas para el usuario.
  const scope = await cierreScope(user);

  // Recupera el cierre existente cuando se proporciona un identificador.
  const current = id
    ? await findCierre(id)
    : null;

  // Verifica que el cierre solicitado exista.
  if (id && !current) {
    throw new AppError(
      'Cierre no encontrado',
      404
    );
  }

  // Valida los permisos sobre el cierre existente.
  if (current) {
    assertCierreScope(scope, current);
  }

  // Valida los permisos sobre los nuevos datos del cierre.
  assertCierreScope(scope, datos);

  // Comprueba la existencia y el estado de la salita seleccionada.
  if (datos.id_salita) {
    const salita = await getSalitaById(
      datos.id_salita
    );

    // Exige una salita existente y activa cuando el cierre está activo.
    if (
      !salita ||
      (datos.activo && !salita.activo)
    ) {
      throw new AppError(
        'Seleccioná una salita existente y activa para registrar el cierre',
        400
      );
    }
  }

  // Devuelve el alcance autorizado y el cierre actual.
  return {
    scope,
    current,
  };
};
