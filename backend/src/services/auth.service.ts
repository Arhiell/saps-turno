import { duplicateMessages } from "../utils/duplicate-error.js";
import { env } from "../config/env.js";

import {
  generateUsernameFromEmail,
} from "../utils/username-generator.js";

import type {
  RegisterInput,
  LoginInput,
} from "../validators/auth.validator.js";

import {
  createUser,
  findRoleByCode,
  findUserByEmail,
  findUserByUsername,
  clearExpiredLoginLock,
  findRoleById,
  findUserForLogin,
  registerFailedLogin,
  registerSuccessfulLogin,
} from "../repositories/user.repository.js";

import {
  hashPassword,
  verifyPassword,
} from "./password.service.js";

import {
  AppError,
} from "../utils/app-error.js";

import {
  createSession,
} from "../services/session.service.js";

import {
  generateAccessToken,
  generateLoginVerificationToken,
} from "./jwt.service.js";

import {
  validateLoginAccess,
} from "./login-access.service.js";

import {
  createVerificationCodeForNewUser,
  createEmailCode,
} from "./email-verification.service.js";

import {
  findLatestPendingEmailToken,
} from "../repositories/email-verification.repository.js";

import type {
  RequestMetadata,
} from "../types/request-metadata.types.js";

// ========================================
// REGISTRO PÚBLICO
// ========================================

export const registerUser = async (
  input: RegisterInput,
  metadata: RequestMetadata,
) => {
  const email =
    input.email.trim().toLowerCase();

  const username =
    input.nombre_usuario?.trim() ??
    generateUsernameFromEmail(email);

  const existingEmail =
    await findUserByEmail(email);

  if (existingEmail) {
    throw new AppError(
      duplicateMessages.email,
      409,
    );
  }

  const existingUsername =
    await findUserByUsername(username);

  if (existingUsername) {
    throw new AppError(
      duplicateMessages.username,
      409,
    );
  }

  const patientRole =
    await findRoleByCode("PACIENTE");

  if (!patientRole) {
    throw new AppError(
      "El rol PACIENTE no está configurado",
      500,
    );
  }

  const passwordHash =
    await hashPassword(
      input.password,
    );

  const user =
    await createUser({
      id_rol: patientRole.id_rol,
      nombre_usuario: username,
      email,
      password_hash: passwordHash,
    });

  const verificationExpiresAt =
    await createVerificationCodeForNewUser(
      user.id_usuario,
      email,
      metadata.ip,
    );

  return {
    user: {
      ...user,
      rol: {
        codigo: patientRole.codigo,
        nombre: patientRole.nombre,
      },
    },
    verificationExpiresAt,
  };
};

// LOGIN
export const loginUser = async (
  input: LoginInput,
  metadata: {
    ip: string | null;
    userAgent: string | null;
  },
) => {
  const identifier =
    input.identifier
      .trim()
      .toLowerCase();

  const user =
    await findUserForLogin(identifier);

  if (!user) {
    throw new AppError(
      "Credenciales incorrectas",
      401,
    );
  }

  /*
   * Permitimos que el usuario llegue hasta la
   * comprobación de contraseña aunque su correo
   * todavía no esté verificado.
   *
   * La sesión NO se crea hasta completar el código.
   */
  validateLoginAccess(
    user,
    {
      allowUnverifiedEmail: true,
    },
  );

  const now =
    new Date();

  let failedAttempts =
    user.intentos_fallidos ?? 0;

  // BLOQUEO ACTIVO
  if (
    user.bloqueado_hasta &&
    new Date(user.bloqueado_hasta) > now
  ) {
    throw new AppError(
      "La cuenta se encuentra temporalmente bloqueada",
      423,
    );
  }

  // BLOQUEO VENCIDO
  if (
    user.bloqueado_hasta &&
    new Date(user.bloqueado_hasta) <= now
  ) {
    await clearExpiredLoginLock(
      user.id_usuario,
    );

    failedAttempts = 0;
  }

  // COMPROBAR CONTRASEÑA
  const passwordIsValid =
    await verifyPassword(
      user.password_hash,
      input.password,
    );

  if (!passwordIsValid) {
    const newAttempts =
      failedAttempts + 1;

    if (
      newAttempts >=
      env.LOGIN_MAX_ATTEMPTS
    ) {
      const blockedUntil =
        new Date(
          now.getTime() +
          env.LOGIN_LOCK_MINUTES *
          60 *
          1000,
        );

      await registerFailedLogin(
        user.id_usuario,
        newAttempts,
        blockedUntil.toISOString(),
      );

      throw new AppError(
        "Demasiados intentos fallidos. La cuenta fue bloqueada temporalmente",
        423,
        'ACCOUNT_BLOCKED',
        { fecha_fin: blockedUntil.toISOString() },
      );
    }

    await registerFailedLogin(
      user.id_usuario,
      newAttempts,
      null,
    );

    throw new AppError(
      "Credenciales incorrectas",
      401,
    );
  }

  // COMPROBAR ROL
  const role =
    await findRoleById(
      user.id_rol,
    );

  if (
    !role ||
    !role.activo
  ) {
    throw new AppError(
      "El usuario no posee un rol válido",
      403,
    );
  }

  /*
   * Las credenciales fueron correctas.
   * Reiniciamos los intentos fallidos.
   */
  await registerSuccessfulLogin(
    user.id_usuario,
  );

  const authenticatedUser = {
    id_usuario: user.id_usuario,
    email: user.email,
    nombre_usuario:
      user.nombre_usuario,
    rol: role.codigo,
  };

  // CORREO NO VERIFICADO
  if (!user.email_verificado) {

    /*
     * IMPORTANTE:
     *
     * Acá NO llamamos a createEmailCode().
     *
     * Por lo tanto, iniciar sesión NO genera
     * un segundo código.
     */

    const loginVerificationToken =
      await generateLoginVerificationToken(
        user.id_usuario,
      );

    /*
     * Buscamos el código que ya fue generado
     * cuando se creó la cuenta.
     */
    const pending =
      await findLatestPendingEmailToken(
        user.id_usuario,
      );

    let verificationExpiresAt =
      pending?.fecha_expiracion ??
      null;

    let resendAvailableAt =
      pending
        ? new Date(
            new Date(
              pending.fecha_creacion,
            ).getTime() +
            60 * 1000,
          ).toISOString()
        : null;

    if (!pending || new Date(pending.fecha_expiracion).getTime() <= Date.now()) {
      try {
        verificationExpiresAt = await createEmailCode(
          user.id_usuario,
          user.email,
          metadata.ip
        );
        resendAvailableAt = new Date(
          Date.now() + 60 * 1000
        ).toISOString();
      } catch {
        // Si el envío falla transitoriamente, permite continuar a la vista de verificación.
      }
    }

    return {
      requiresEmailVerification: true as const,
      email: user.email,
      loginVerificationToken,
      verificationExpiresAt,
      resendAvailableAt,
    };
  }

  // LOGIN NORMAL
  const accessToken =
    await generateAccessToken(
      authenticatedUser,
    );

  const refreshToken =
    await createSession(
      user.id_usuario,
      metadata,
    );

  return {
    requiresEmailVerification: false as const,
    user: authenticatedUser,
    accessToken,
    refreshToken,
  };
};
