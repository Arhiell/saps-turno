import type {
  CreateAdminInput,
} from '../validators/user.validator.js';

import {
  createAdminAccount,
} from './user-management.service.js';

import {
  createVerificationCodeForNewUser,
} from './email-verification.service.js';

// Define los datos adicionales del registro administrativo.
interface AdminOnboardingMetadata {
  ip: string | null;
}

// Coordina la creación de la cuenta administrativa y la verificación del correo.
export const createAdminWithVerification = async (
  input: CreateAdminInput,
  metadata: AdminOnboardingMetadata
) => {
  // Valida los datos, crea la cuenta y asigna la salita si corresponde.
  const user = await createAdminAccount(input);

  // Genera y envía el código de verificación del correo electrónico.
  const verificationExpiresAt = await createVerificationCodeForNewUser(
    user.id_usuario,
    user.email,
    metadata.ip
  );

  // Devuelve la cuenta creada y el vencimiento del código.
  return {
    user,
    verificationExpiresAt,
  };
};