import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  generateFourDigitCode,
  hashUserCode,
} from './one-time-code.service.js';

// Genera el token que recibirá el usuario.
export const generateEmailVerificationToken =
  (): string => {
    return randomBytes(32).toString("hex");
  };

// Solo almacenamos SHA-256 del token.
export const hashEmailVerificationToken = (
  token: string
): string => {
  return createHash("sha256")
    .update(token)
    .digest("hex");
};

// Genera un código seguro de 4 dígitos, incluidos ceros iniciales.
export const generateEmailVerificationCode = (): string =>
  generateFourDigitCode();

export const hashEmailVerificationCode = (
  userId: string,
  code: string
): string =>
  hashUserCode(userId, code);