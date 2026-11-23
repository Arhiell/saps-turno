import * as argon2 from "argon2";

/**
 * Convierte una contraseña en un hash seguro.
 *
 * Nunca guardaremos la contraseña original.
 */
export const hashPassword = async (
  password: string
): Promise<string> => {
  return argon2.hash(password);
};

/**
 * Más adelante será utilizado durante el login
 * para comparar contraseña contra hash.
 */
export const verifyPassword = async (
  hash: string | null,
  password: string
): Promise<boolean> => {
  return hash ? argon2.verify(hash, password) : false;
};