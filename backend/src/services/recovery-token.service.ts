import {
  createHash,
  randomBytes
} from "node:crypto";

// Genera el token original que recibirá
// el usuario para recuperar su contraseña.

export const generateRecoveryToken = (): string => {
  return randomBytes(32).toString("hex");
};

// Convierte el token original en SHA-256.
// Este hash será lo único que guardaremos en la base de datos.
export const hashRecoveryToken = (
  token: string
): string => {
  return createHash("sha256")
    .update(token)
    .digest("hex");
};