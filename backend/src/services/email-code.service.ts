import { duplicateMessages } from "../utils/duplicate-error.js";
import {
  hashEmailVerificationCode,
} from './email-verification-token.service.js';

import {
  consumeEmailCode,
} from '../repositories/email-verification.repository.js';

import {
  AppError,
} from '../utils/app-error.js';

// Un único consumo atómico para
// verificación inicial y cambio de correo.
export const consumeVerificationCode = async (
  userId: string,
  code: string,
  newEmail: string | null = null
) => {
  // Genera el hash del código y solicita su consumo.
  const result = await consumeEmailCode(
    userId,
    hashEmailVerificationCode(
      userId,
      code
    ),
    newEmail
  );

  // Código válido y consumido correctamente.
  if (result === 'OK') {
    return;
  }

  // El código superó su fecha de expiración.
  if (result === 'EXPIRADO') {
    throw new AppError(
      'El código expiró. Solicitá uno nuevo.',
      400
    );
  }

  // Se superó la cantidad de intentos permitidos.
  if (result === 'INTENTOS') {
    throw new AppError(
      'Superaste los intentos. Solicitá un nuevo código.',
      429
    );
  }

  // El nuevo correo ya se encuentra ocupado.
  if (result === 'OCUPADO') {
    throw new AppError(
      duplicateMessages.email,
      409
    );
  }

  // El código es incorrecto o ya fue utilizado.
  throw new AppError(
    'Código incorrecto o utilizado.',
    400
  );
};