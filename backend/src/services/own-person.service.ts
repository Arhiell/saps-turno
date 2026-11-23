import type {
  AuthenticatedUser,
} from '../types/auth.types.js';

import { findUserById } from '../repositories/user.repository.js';
import { ownPersonUpdateSchema } from '../validators/person.validator.js';

import { editPerson } from './person.service.js';
import { editOwnPatient } from './patient-update.service.js';

import { AppError } from '../utils/app-error.js';

// Actualiza el perfil del usuario según su rol.
export const editOwnProfile = async (
  body: unknown,
  user: AuthenticatedUser
) => {
  // Delega la actualización al servicio correspondiente.
  if (user.rol === 'PACIENTE') {
    return editOwnPatient(body, user);
  }

  return editOwnPerson(body, user);
};

// Actualiza los datos personales de administradores y profesionales.
export const editOwnPerson = async (
  body: unknown,
  user: AuthenticatedUser
) => {
  // Verifica que el usuario tenga un rol autorizado.
  if (!['SUPER_ADMIN', 'ADMIN_SALITA', 'PROFESIONAL'].includes(user.rol)) {
    throw new AppError('Rol no autorizado', 403);
  }

  // Valida los datos personales permitidos.
  const input = ownPersonUpdateSchema.parse(body);

  // Obtiene la persona vinculada desde la cuenta autenticada.
  const account = await findUserById(user.id_usuario);

  if (!account?.activo) {
    throw new AppError('Usuario no autorizado', 401);
  }

  // Comprueba que la cuenta tenga una persona asociada.
  if (!account.id_persona) {
    throw new AppError(
      'Contactá a administración para vincular tu perfil.',
      409
    );
  }

  // Actualiza los datos de la persona vinculada.
  return editPerson(account.id_persona, input);
};