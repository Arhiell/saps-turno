import {
  env,
} from '../config/env.js';

import {
  sendEmailVerificationCode,
} from './email.service.js';

import {
  createEmailVerificationToken,
  findEmailVerificationToken,
  findLatestPendingEmailToken,
  findUserForEmailVerification,
  invalidatePreviousEmailTokens,
  markEmailAsVerified,
  markEmailTokenAsUsed,
  issueEmailCode,
  invalidateEmailCode,
} from '../repositories/email-verification.repository.js';

import {
  generateEmailVerificationToken,
  hashEmailVerificationToken,
  generateEmailVerificationCode,
  hashEmailVerificationCode,
} from './email-verification-token.service.js';

import {
  consumeVerificationCode,
} from './email-code.service.js';

import {
  AppError,
} from '../utils/app-error.js';

import type {
  RequestEmailVerificationInput,
  VerifyEmailInput,
  VerifyEmailCodeInput,
} from '../validators/email-verification.validators.js';

// Tiempo de validez del código: 10 minutos.
const EMAIL_CODE_TTL_SECONDS = 10 * 60;

// Tiempo mínimo antes de poder reenviar otro código: 1 minuto.
const EMAIL_CODE_RESEND_COOLDOWN_SECONDS = 60;

// ========================================
// CREACIÓN DE CÓDIGO DE VERIFICACIÓN
// ========================================

// Genera, almacena y envía un código de verificación por email.
export const createEmailCode = async (
  idUsuario: string,
  email: string,
  ip: string | null,
  change?: {
    nuevo_email: string;
    email_anterior: string;
  }
) => {
  // Genera el código y su hash.
  const code =
    generateEmailVerificationCode();

  const codeHash =
    hashEmailVerificationCode(
      idUsuario,
      code
    );

  // Calcula la fecha de expiración.
  const expiresAt = new Date(
    Date.now() +
      EMAIL_CODE_TTL_SECONDS * 1000
  );

  // Registra el código mediante la operación atómica.
  const tokenId = await issueEmailCode(
    idUsuario,
    codeHash,
    expiresAt.toISOString(),
    ip,
    change?.nuevo_email ?? null
  );

  // Impide generar códigos antes del tiempo permitido.
  if (!tokenId) {
    throw new AppError(
      'Esperá un minuto antes de solicitar otro código.',
      429
    );
  }

  try {
    // Envía el código al correo indicado.
    await sendEmailVerificationCode(
      email,
      code
    );
  } catch {
    // Si el envío falla, invalida el código generado.
    await invalidateEmailCode(
      tokenId
    );

    throw new AppError(
      'No pudimos enviar el código. Volvé a intentarlo.',
      503
    );
  }

  return expiresAt.toISOString();
};

// Genera un código de verificación para un usuario nuevo.
export const createVerificationCodeForNewUser = async (
  idUsuario: string,
  email: string,
  ip: string | null
) =>
  createEmailCode(
    idUsuario,
    email,
    ip
  );

// ========================================
// SOLICITUD DE VERIFICACIÓN DE EMAIL
// ========================================

// Solicita un código para verificar el correo del usuario.
export const requestEmailVerification = async (
  input: RequestEmailVerificationInput,
  ip: string | null
) => {
  // Normaliza el correo recibido.
  const email =
    input.email.trim().toLowerCase();

  // Busca la cuenta asociada al correo.
  const user =
    await findUserForEmailVerification(
      email
    );

  // No revelamos si el correo existe.
  if (
    !user ||
    !user.activo ||
    user.email_verificado
  ) {
    return null;
  }

  // Busca un código pendiente del usuario.
  const pending =
    await findLatestPendingEmailToken(
      user.id_usuario
    );

  const now = Date.now();

  // Si existe un código vigente, controla
  // el tiempo mínimo antes de permitir otro envío.
  if (
    pending &&
    new Date(
      pending.fecha_expiracion
    ).getTime() > now
  ) {
    const resendAvailableAt = new Date(
      new Date(
        pending.fecha_creacion
      ).getTime() +
        EMAIL_CODE_RESEND_COOLDOWN_SECONDS *
          1000
    );

    if (
      now < resendAvailableAt.getTime()
    ) {
      return {
        verificationExpiresAt:
          pending.fecha_expiracion,
        resendAvailableAt:
          resendAvailableAt.toISOString(),
      };
    }
  }

  // Genera y envía un nuevo código.
  const verificationExpiresAt =
    await createEmailCode(
      user.id_usuario,
      email,
      ip
    );

  return {
    verificationExpiresAt,

    // Calcula cuándo podrá solicitarse otro código.
    resendAvailableAt: new Date(
      Date.parse(
        verificationExpiresAt
      ) -
        EMAIL_CODE_TTL_SECONDS * 1000 +
        EMAIL_CODE_RESEND_COOLDOWN_SECONDS *
          1000
    ).toISOString(),
  };
};

// ========================================
// VERIFICACIÓN MEDIANTE TOKEN
// ========================================

// Confirma la dirección de correo mediante un token.
export const verifyUserEmail = async (
  input: Extract<
    VerifyEmailInput,
    {
      token: string;
    }
  >
) => {
  // Genera el hash del token recibido.
  const tokenHash =
    hashEmailVerificationToken(
      input.token
    );

  // Busca un token pendiente con ese hash.
  const verification =
    await findEmailVerificationToken(
      tokenHash
    );

  if (!verification) {
    throw new AppError(
      'Token de verificación inválido o utilizado',
      400
    );
  }

  // Verifica que el token no haya expirado.
  if (
    new Date(
      verification.fecha_expiracion
    ) <= new Date()
  ) {
    throw new AppError(
      'El token de verificación ha expirado',
      400
    );
  }

  // Consume el token primero para impedir
  // su reutilización de manera concurrente.
  const consumed =
    await markEmailTokenAsUsed(
      verification.id_token
    );

  if (!consumed) {
    throw new AppError(
      'Token de verificación inválido o utilizado',
      400
    );
  }

  // Marca el correo del usuario como verificado.
  await markEmailAsVerified(
    verification.id_usuario
  );
};

// ========================================
// VERIFICACIÓN MEDIANTE CÓDIGO
// ========================================

// Confirma el correo utilizando el código recibido.
export const verifyEmailCode = async (
  input: VerifyEmailCodeInput
) => {
  // Normaliza el correo.
  const email =
    input.email.trim().toLowerCase();

  // Busca el usuario asociado.
  const user =
    await findUserForEmailVerification(
      email
    );

  // Rechaza cuentas inexistentes, inactivas
  // o que ya tienen el correo verificado.
  if (
    !user ||
    !user.activo ||
    user.email_verificado
  ) {
    throw new AppError(
      'Código incorrecto.',
      400
    );
  }

  // Consume el código de forma atómica.
  await consumeVerificationCode(
    user.id_usuario,
    input.code
  );
};

// ========================================
// TOKEN PARA USUARIO RECIÉN CREADO
// ========================================

/**
 * Genera un token de verificación directamente
 * para un usuario recién creado.
 *
 * Se utiliza durante el registro.
 */
export const createVerificationForUser = async (
  idUsuario: string,
  ip: string | null
) => {
  // Invalida cualquier token anterior
  // pendiente para ese mismo usuario.
  await invalidatePreviousEmailTokens(
    idUsuario
  );

  // Genera el token original.
  const token =
    generateEmailVerificationToken();

  // Solo se almacena el hash del token.
  const tokenHash =
    hashEmailVerificationToken(
      token
    );

  // Calcula la fecha de expiración.
  const expiration = new Date(
    Date.now() +
      env.EMAIL_VERIFICATION_HOURS *
        60 *
        60 *
        1000
  );

  // Guarda el hash del token en la base de datos.
  await createEmailVerificationToken(
    idUsuario,
    tokenHash,
    expiration.toISOString(),
    ip
  );

  // Devuelve el token original.
  // El valor original nunca se almacena en la DB.
  return token;
};

/**
 * Genera directamente un token de verificación
 * para un usuario que acaba de registrarse.
 *
 * En este caso ya conocemos el id_usuario,
 * por lo que no necesitamos volver a buscar
 * el usuario mediante email.
 */
export const createVerificationForNewUser = async (
  idUsuario: string,
  ip: string | null
) => {
  // Invalida cualquier token anterior.
  // Mantiene una única regla de seguridad.
  await invalidatePreviousEmailTokens(
    idUsuario
  );

  // Genera el token original.
  const token =
    generateEmailVerificationToken();

  // Genera el hash que será almacenado.
  const tokenHash =
    hashEmailVerificationToken(
      token
    );

  // Calcula la fecha de expiración.
  const expiration = new Date(
    Date.now() +
      env.EMAIL_VERIFICATION_HOURS *
        60 *
        60 *
        1000
  );

  // En PostgreSQL se almacena solamente
  // el hash del token original.
  await createEmailVerificationToken(
    idUsuario,
    tokenHash,
    expiration.toISOString(),
    ip
  );

  return token;
};