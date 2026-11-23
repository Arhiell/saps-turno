import {
  createHash,
  randomBytes
} from "node:crypto";

//Genera un token aleatorio de 64 bytes.
// Este es el token que recibirá el cliente.
export const generateRefreshToken = (): string => {
  return randomBytes(64).toString("hex");
};

// Convierte el refresh token en SHA-256.
//  Solo este hash será almacenado en PostgreSQL.
export const hashRefreshToken = (
  token: string
): string => {
  return createHash("sha256")
    .update(token)
    .digest("hex");
};