import { duplicateMessages } from "../utils/duplicate-error.js";
import {
  createEmailCode,
} from './email-verification.service.js';

import {
  consumeVerificationCode,
} from './email-code.service.js';

import {
  findLatestPendingEmailToken,
} from '../repositories/email-verification.repository.js';

import {
  findUserByEmail,
  findUserById,
} from '../repositories/user.repository.js';

import {
  findPersonsByEmail,
} from '../repositories/person-read.repository.js';

import type {
  AuthenticatedUser,
} from '../types/auth.types.js';

import {
  AppError,
} from '../utils/app-error.js';


// SOLICITUD DE CAMBIO DE CORREO

// Solicita el cambio de correo del usuario autenticado.
export const requestEmailChange = async (
  email: string,
  user: AuthenticatedUser,
  ip: string | null
) => {
  // Normaliza el nuevo correo.
  const normalized = email.toLowerCase();

  // Evita solicitar el mismo correo que ya posee la cuenta.
  if (
    normalized === user.email.toLowerCase()
  ) {
    throw new AppError(
      'Ingresá un correo diferente al actual.',
      400
    );
  }

  // Busca el último código pendiente del usuario.
  const pending = await findLatestPendingEmailToken(
    user.id_usuario
  );

  // Evita solicitar códigos repetidamente
  // dentro de un período menor a un minuto.
  if (
    pending &&
    Date.now() -
      Date.parse(pending.fecha_creacion) <
      60000
  ) {
    throw new AppError(
      'Esperá un minuto antes de solicitar otro código.',
      429
    );
  }

  // Obtiene la cuenta actual del usuario.
  const account = await findUserById(
    user.id_usuario
  );

  if (!account) {
    throw new AppError(
      'Cuenta no encontrada',
      401
    );
  }

  // Verifica si el nuevo correo ya está asociado
  // a otra cuenta o persona.
  const [
    existing,
    persons,
  ] = await Promise.all([
    findUserByEmail(normalized),
    findPersonsByEmail(normalized),
  ]);

  if (
    existing ||
    persons.some(
      (p) =>
        p.id_persona !== account.id_persona
    )
  ) {
    throw new AppError(
      duplicateMessages.email,
      409
    );
  }

  // Genera el código de verificación para el nuevo correo.
  const verificationExpiresAt =
    await createEmailCode(
      user.id_usuario,
      normalized,
      ip,
      {
        nuevo_email: normalized,
        email_anterior: account.email,
      }
    );

  // Devuelve la fecha de expiración del código.
  return {
    verificationExpiresAt,
  };
};

// CONFIRMACIÓN DEL CAMBIO DE CORREO

// Confirma el nuevo correo mediante el código recibido.
export const confirmEmailChange = async (
  email: string,
  code: string,
  user: AuthenticatedUser
) => {
  await consumeVerificationCode(
    user.id_usuario,
    code,
    email.toLowerCase()
  );
};