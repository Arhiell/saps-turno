import {
  randomBytes
} from "node:crypto";

/**
 * Genera un username inicial a partir
 * del email recibido.
 *
 * Ejemplo:
 *
 * ariel@gmail.com
 *        ↓
 * ariel_a31f
 */
export const generateUsernameFromEmail = (
  email: string
): string => {
  const base =
    email
      .split("@")[0]
      ?.toLowerCase()
      .replace(
        /[^a-z0-9._-]/g,
        ""
      )
      .slice(0, 45) ||
    "usuario";

  const suffix =
    randomBytes(2).toString("hex");

  return `${base}_${suffix}`;
};