import {
  env
} from "../config/env.js";
import { sendPasswordRecoveryCode } from "./email.service.js";

import {
  createPasswordRecoveryToken,
  consumePasswordRecoveryCode,
  findPasswordRecoveryToken,
  findRecoveryUserByEmail,
  invalidatePasswordRecoveryCode,
  invalidatePreviousRecoveryTokens,
  issuePasswordRecoveryCode,
  markRecoveryTokenAsUsed,
  updateRecoveredPassword
} from "../repositories/password-recovery.repository.js";

import {
  revokeAllUserRefreshSessions
} from "../repositories/sesion.repository.js";

import {
  generateRecoveryToken,
  hashRecoveryToken
} from "./recovery-token.service.js";

import {
  generateFourDigitCode,
  hashUserCode,
} from "./one-time-code.service.js";

import {
  hashPassword
} from "./password.service.js";

import {
  AppError
} from "../utils/app-error.js";

import type {
  ForgotPasswordInput,
  ResetPasswordInput
} from "../validators/password-recovery.validator.js";

interface RecoveryMetadata {
  ip: string | null;
}

// Genera una solicitud para recuperar una contraseña.
export const requestPasswordRecovery =
  async (
    input: ForgotPasswordInput,
    metadata: RecoveryMetadata
  ) => {
    const email =
      input.email.trim().toLowerCase();

    const user =
      await findRecoveryUserByEmail(email);

    /**
     * IMPORTANTE:
     * si el email no existe no devolvemos error.
     * Evita revelar qué correos existen
     * en nuestro sistema.
     */
    if (!user || !user.activo) {
      return null;
    }

    const recoveryCode = generateFourDigitCode();
    const codeHash = hashUserCode(
      user.id_usuario,
      recoveryCode
    );

    const expiration =
      new Date(
        Date.now() +
          env.PASSWORD_RECOVERY_MINUTES *
            60 *
            1000
      );

    const tokenId = await issuePasswordRecoveryCode(
      user.id_usuario,
      codeHash,
      expiration.toISOString(),
      metadata.ip
    );

    if (!tokenId) {
      return null;
    }

    await sendPasswordRecoveryCode(email, recoveryCode).catch(async () => {
      console.error("No se pudo enviar el correo de recuperación");
      await invalidatePasswordRecoveryCode(tokenId);
    });
    return null;
  };

/**
 * Cambia la contraseña utilizando
 * un recovery token válido.
 */
export const resetPassword = async (
  input: ResetPasswordInput
) => {
  if (input.email && input.code) {
    const email = input.email.trim().toLowerCase();
    const user = await findRecoveryUserByEmail(email);

    const passwordHash = await hashPassword(input.newPassword);
    const result = user
      ? await consumePasswordRecoveryCode(
          email,
          hashUserCode(user.id_usuario, input.code),
          passwordHash
        )
      : "INVALIDO";

    if (result === "INTENTOS") {
      throw new AppError(
        "Superaste los intentos. Solicitá un nuevo código.",
        429
      );
    }

    if (result === "EXPIRADO") {
      throw new AppError(
        "El código expiró. Solicitá uno nuevo.",
        400
      );
    }

    if (result !== "OK" || !user) {
      throw new AppError("Código incorrecto o utilizado.", 400);
    }

    await revokeAllUserRefreshSessions(user.id_usuario);
    return;
  }

  if (!input.token) {
    throw new AppError("Datos de recuperación inválidos.", 400);
  }

  const tokenHash =
    hashRecoveryToken(input.token);

  const recovery =
    await findPasswordRecoveryToken(
      tokenHash
    );

  if (!recovery) {
    throw new AppError(
      "Token de recuperación inválido o utilizado",
      400
    );
  }

  //Comprobamos que no haya vencido.
  if (
    new Date(recovery.fecha_expiracion) <=
    new Date()
  ) {
    throw new AppError(
      "El token de recuperación ha expirado",
      400
    );
  }

  // La nueva contraseña se transforma nuevamente mediante Argon2.
  const newPasswordHash =
    await hashPassword(
      input.newPassword
    );

  await updateRecoveredPassword(
    recovery.id_usuario,
    newPasswordHash
  );

  /**
   * El recovery token solamente puede
   * utilizarse una vez.
   */
  await markRecoveryTokenAsUsed(
    recovery.id_token
  );

  /**
   * Como medida de seguridad cerramos
   * todas las sesiones anteriores.
   */
  await revokeAllUserRefreshSessions(
    recovery.id_usuario
  );
};
