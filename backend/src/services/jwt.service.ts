import {
  SignJWT,
  jwtVerify,
} from "jose";

import { env } from "../config/env.js";

import type {
  AuthenticatedUser,
} from "../types/auth.types.js";

const secret = new TextEncoder().encode(
  env.JWT_ACCESS_SECRET,
);

const LOGIN_VERIFICATION_PURPOSE = "email_verification_login";
const ACCESS_TOKEN_PURPOSE = "access";
const LOGIN_VERIFICATION_EXPIRES = "10m";

export const generateAccessToken = async (
  user: AuthenticatedUser,
): Promise<string> => {
  return new SignJWT({
    email: user.email,
    username: user.nombre_usuario,
    role: user.rol,
    purpose: ACCESS_TOKEN_PURPOSE,
  })
    .setProtectedHeader({
      alg: "HS256",
    })
    .setSubject(user.id_usuario)
    .setIssuedAt()
    .setExpirationTime(
      `${env.JWT_ACCESS_EXPIRES_MINUTES}m`,
    )
    .sign(secret);
};

export const verifyAccessToken = async (
  token: string,
) => {
  const { payload } = await jwtVerify(
    token,
    secret,
  );

  // Impide utilizar un token temporal de verificación
  // como si fuera un Access Token normal.
  if (
    payload.purpose &&
    payload.purpose !== ACCESS_TOKEN_PURPOSE
  ) {
    throw new Error(
      "Token de acceso inválido",
    );
  }

  return payload;
};

/**
 * Token temporal generado solamente después de que
 * el usuario haya demostrado conocer sus credenciales.
 *
 * NO es un Access Token.
 */
export const generateLoginVerificationToken = async (
  userId: string,
): Promise<string> => {
  return new SignJWT({
    purpose: LOGIN_VERIFICATION_PURPOSE,
  })
    .setProtectedHeader({
      alg: "HS256",
    })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(
      LOGIN_VERIFICATION_EXPIRES,
    )
    .sign(secret);
};

/**
 * Valida el token temporal utilizado para completar
 * el login mediante código de correo.
 */
export const verifyLoginVerificationToken = async (
  token: string,
): Promise<string> => {
  const { payload } = await jwtVerify(
    token,
    secret,
  );

  if (
    payload.purpose !== LOGIN_VERIFICATION_PURPOSE ||
    !payload.sub
  ) {
    throw new Error(
      "Token de verificación de inicio de sesión inválido",
    );
  }

  return payload.sub;
};