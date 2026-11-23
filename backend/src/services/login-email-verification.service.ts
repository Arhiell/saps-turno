import { assertAccountAccess } from './account-access.service.js';
import {
  verifyLoginVerificationToken,
  generateAccessToken,
} from "./jwt.service.js";

import {
  consumeVerificationCode,
} from "./email-code.service.js";

import {
  createSession,
} from "./session.service.js";

import {
  findUserById,
  findRoleById,
} from "../repositories/user.repository.js";

import {
  AppError,
} from "../utils/app-error.js";

interface LoginVerificationInput {
  loginVerificationToken: string;
  code: string;
}

interface SessionMetadata {
  ip: string | null;
  userAgent: string | null;
}

/**
 * Completa un inicio de sesión que quedó pendiente
 * únicamente porque el correo todavía no estaba verificado.
 *
 * El token demuestra que las credenciales fueron
 * validadas previamente por /auth/login.
 *
 * La contraseña nunca se almacena ni se vuelve
 * a enviar desde el frontend.
 */
export const verifyLoginEmailCode = async (
  input: LoginVerificationInput,
  metadata: SessionMetadata,
) => {

  let idUsuario: string;

  // ========================================
  // VALIDAR TOKEN TEMPORAL
  // ========================================

  try {
    idUsuario =
      await verifyLoginVerificationToken(
        input.loginVerificationToken,
      );
  } catch {
    throw new AppError(
      "La verificación de inicio de sesión expiró. Volvé a iniciar sesión.",
      401,
    );
  }

  // ========================================
  // BUSCAR USUARIO
  // ========================================

  const user =
    await findUserById(
      idUsuario,
    );

  if (
    !user
  ) {
    throw new AppError(
      "La cuenta no está disponible.",
      401,
    );
  }
  assertAccountAccess(user);

  // ========================================
  // CONSUMIR CÓDIGO
  // ========================================

  /*
   * El RPC:
   *
   * - valida el código
   * - controla expiración
   * - controla intentos
   * - invalida el código
   * - marca email_verificado = TRUE
   *
   * todo de forma atómica.
   */
  await consumeVerificationCode(
    user.id_usuario,
    input.code,
  );

  // ========================================
  // VOLVER A OBTENER USUARIO
  // ========================================

  const verifiedUser =
    await findUserById(
      user.id_usuario,
    );

  if (!verifiedUser) {
    throw new AppError(
      "No se pudo completar la verificación del correo.",
      500,
    );
  }

  // ========================================
  // COMPROBAR ROL
  // ========================================

  const role =
    await findRoleById(
      verifiedUser.id_rol,
    );

  if (
    !role ||
    !role.activo
  ) {
    throw new AppError(
      "El usuario no posee un rol válido.",
      403,
    );
  }

  const authenticatedUser = {
    id_usuario:
      verifiedUser.id_usuario,

    email:
      verifiedUser.email,

    nombre_usuario:
      verifiedUser.nombre_usuario,

    rol:
      role.codigo,
  };

  // ========================================
  // GENERAR SESIÓN
  // ========================================

  const accessToken =
    await generateAccessToken(
      authenticatedUser,
    );

  const refreshToken =
    await createSession(
      verifiedUser.id_usuario,
      metadata,
    );

  /*
   * ESTE es el punto importante:
   *
   * no devolvemos al login.
   *
   * devolvemos directamente la sesión
   * ya autenticada.
   */
  return {
    user: authenticatedUser,
    accessToken,
    refreshToken,
  };
};
