import { assertAccountAccess } from './account-access.service.js';
import {
  env
} from "../config/env.js";

import {
  createRefreshSession,
  findRefreshSession,
  revokeRefreshSession
} from "../repositories/sesion.repository.js";

import {
  generateRefreshToken,
  hashRefreshToken
} from "../services/resfresh-token.services.js";
import {
  findRoleById,
  findUserById
} from "../repositories/user.repository.js";

import {
  generateAccessToken
} from "./jwt.service.js";

import {
  AppError
} from "../utils/app-error.js";

/**
 * Información del dispositivo desde
 * donde se inició sesión.
 */
interface SessionMetadata {
  ip: string | null;
  userAgent: string | null;
}

// Crea una nueva sesión refresh.
export const createSession = async (
  idUsuario: string,
  metadata: SessionMetadata
) => {
  // Token que recibirá el cliente.
  const refreshToken =
    generateRefreshToken();

  // Hash que almacenaremos.
  const refreshTokenHash =
    hashRefreshToken(refreshToken);

  const expiration = new Date();

  expiration.setDate(
    expiration.getDate() +
      env.REFRESH_TOKEN_EXPIRES_DAYS
  );

  //Guardamos la sesión utilizando
await createRefreshSession({
  id_usuario: idUsuario,
  token_hash: refreshTokenHash,
  ip_origen: metadata.ip,
  user_agent: metadata.userAgent,
  fecha_expiracion: expiration.toISOString()
});

  return refreshToken;
};

// Renueva una sesión.  Implementamos rotación:  el refresh anterior se revoca y
// generamos uno completamente nuevo.
export const refreshSession = async (
  refreshToken: string,
  metadata: SessionMetadata
) => {
  const tokenHash =
    hashRefreshToken(refreshToken);

  const session =
    await findRefreshSession(tokenHash);

  if (!session) {
    throw new AppError(
      "Refresh token inválido",
      401
    );
  }

  // Una sesión revocada no puede volver a utilizarse.
  if (session.fecha_revocacion) {
    throw new AppError(
      "La sesión fue revocada",
      401
    );
  }

  // Comprobamos vencimiento.
  if (
    new Date(session.fecha_expiracion) <=
    new Date()
  ) {
    throw new AppError(
      "La sesión ha expirado",
      401
    );
  }

  // Confirmamos que el usuario todavía  exista y continúe activo.
   
  const user = await findUserById(
    session.id_usuario
  );

  if (!user) {
    throw new AppError(
      "Usuario no autorizado",
      401
    );
  }
  assertAccountAccess(user);

  const role =
    await findRoleById(user.id_rol);

  if (!role || !role.activo) {
    throw new AppError(
      "Rol no autorizado",
      403
    );
  }

  // ROTACIÓN: revocamos el token que acaba de utilizarse.
  await revokeRefreshSession(
    session.id_sesion
  );

  // Generamos una nueva sesión refresh.
  const newRefreshToken =
    await createSession(
      user.id_usuario,
      metadata
    );

  const authenticatedUser = {
    id_usuario: user.id_usuario,
    email: user.email,
    nombre_usuario:
      user.nombre_usuario,
    rol: role.codigo
  };

  //  También generamos un Access Token nuevo.
  const accessToken =
    await generateAccessToken(
      authenticatedUser
    );

  return {
    accessToken,
    refreshToken: newRefreshToken
  };
};

// Cierra una sesión concreta.
export const logoutSession = async (
  refreshToken: string
) => {
  const tokenHash =
    hashRefreshToken(refreshToken);

  const session =
    await findRefreshSession(tokenHash);

  /**
   * El logout es idempotente:
   * si la sesión no existe, no revelamos información adicional.
   */
  if (!session) {
    return;
  }

  if (!session.fecha_revocacion) {
    await revokeRefreshSession(
      session.id_sesion
    );
  }
};
