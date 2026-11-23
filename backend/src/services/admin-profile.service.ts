import { createPersonForAdmin } from '../repositories/person.repository.js';
import { findAccountByPersonId } from '../repositories/account.repository.js';
import { findPersonByDni } from '../repositories/person-read.repository.js';
import { findUserById } from '../repositories/user.repository.js';

import {
  completePersonSchema,
  type CompletePersonInput,
} from '../validators/person.validator.js';

import { AppError } from '../utils/app-error.js';
import { duplicateError } from '../utils/duplicate-error.js';

import type {
  AuthenticatedUser,
} from '../types/auth.types.js';

// Verifica si el rol corresponde a un usuario con funciones administrativas o de salita.
export const isAdministrativeRole = (role: string) =>
  role === 'SUPER_ADMIN' ||
  role === 'ADMIN_SALITA' ||
  role === 'RECEPCION';

// Completa los datos personales del usuario administrativo.
export const completeAdminProfile = async (
  input: CompletePersonInput,
  user: AuthenticatedUser,
  ip: string | null
) => {
  // Verifica que el usuario tenga un rol administrativo.
  if (!isAdministrativeRole(user.rol)) {
    throw new AppError('Rol no autorizado', 403);
  }

  // Comprueba que la cuenta exista y esté activa.
  const account = await findUserById(user.id_usuario);

  if (!account?.activo) {
    throw new AppError('Usuario no autorizado', 401);
  }

  // Exige que el correo electrónico esté verificado.
  if (!account.email_verificado) {
    throw new AppError('Verificá tu correo antes de continuar', 403);
  }

  // Evita completar un perfil que ya tiene una persona asociada.
  if (account.id_persona) {
    throw new AppError('El perfil ya está completo', 409);
  }

  // Comprueba si el DNI ya está registrado.
  const person = await findPersonByDni(input.dni);

  if (person) {
    // Verifica si la persona ya tiene una cuenta asociada.
    if (await findAccountByPersonId(person.id_persona)) {
      throw new AppError(
        'El DNI ingresado ya se encuentra asociado a otra cuenta.',
        409
      );
    }

    throw new AppError(
      'El DNI ya está registrado. Contactá a la administración para revisar el vínculo con tu cuenta.',
      409
    );
  }

  try {
    // Crea la persona y la vincula mediante una transacción segura.
    const result = await createPersonForAdmin(
      user.id_usuario,
      completePersonSchema.parse(input),
      ip
    );

    // Define los errores posibles de la operación.
    const errors: Record<string, [string, number]> = {
      NO_AUTORIZADO: [
        'La cuenta no está autorizada para completar este perfil.',
        403,
      ],
      COMPLETO: [
        'El perfil ya está completo.',
        409,
      ],
      DNI_CUENTA: [
        'El DNI ingresado ya se encuentra asociado a otra cuenta.',
        409,
      ],
      DNI_EXISTENTE: [
        'El DNI ya está registrado. Contactá a la administración para revisar el vínculo con tu cuenta.',
        409,
      ],
      EMAIL_EXISTENTE: [
        'Tu correo ya está asociado a una persona. Contactá a la administración.',
        409,
      ],
      DUPLICADO: [
        'El DNI o correo ya se encuentra registrado. Contactá a la administración.',
        409,
      ],
    };

    // Comprueba si la operación devolvió un error conocido.
    const failure = errors[result];

    if (failure) {
      throw new AppError(...failure);
    }

    // Verifica que el perfil se haya completado correctamente.
    if (result !== 'OK') {
      throw new AppError('No pudimos completar tu perfil.', 500);
    }
  } catch (error) {
    // Convierte los errores de duplicidad y propaga los demás.
    throw duplicateError(error) ?? error;
  }
};