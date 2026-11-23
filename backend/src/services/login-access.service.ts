import {
  AppError
} from "../utils/app-error.js";
import { assertAccountAccess } from './account-access.service.js';

interface LoginAccessUser {
  activo: boolean;
  email_verificado: boolean;
  bloqueado_hasta: string | null;
}

interface LoginAccessOptions {
  allowUnverifiedEmail?: boolean;
}

/**
 * Comprueba las reglas generales que determinan si una cuenta puede
 * continuar con el proceso de autenticación.
 *
 * Cuando allowUnverifiedEmail=true se permite continuar hasta la
 * verificación mediante código, pero nunca se emite una sesión desde
 * esta función.
 */
export const validateLoginAccess = (
  user: LoginAccessUser,
  options: LoginAccessOptions = {},
) => {
  assertAccountAccess(user);

  if (!options.allowUnverifiedEmail && !user.email_verificado) {
    throw new AppError(
      "Debe verificar su correo electrónico antes de iniciar sesión",
      403,
    );
  }

};
