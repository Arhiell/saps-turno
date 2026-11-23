import { duplicateMessages } from "../utils/duplicate-error.js";
import {
  usernameUpdateSchema,
  passwordChangeSchema,
} from '../validators/account.validator.js';

import {
  updateUsername,
  replacePassword,
  findAccountCredentials,
} from '../repositories/account.repository.js';

import {
  registerFailedLogin,
} from '../repositories/user.repository.js';

import {
  revokeAllUserRefreshSessions,
} from '../repositories/sesion.repository.js';

import {
  invalidatePreviousRecoveryTokens,
} from '../repositories/password-recovery.repository.js';

import {
  validateLoginAccess,
} from './login-access.service.js';

import {
  hashPassword,
  verifyPassword,
} from './password.service.js';

import {
  hasDatabaseCode,
} from '../utils/profile-error.js';

import {
  AppError,
} from '../utils/app-error.js';

import {
  env,
} from '../config/env.js';

import type {
  AuthenticatedUser,
} from '../types/auth.types.js';


// CAMBIO DE NOMBRE DE USUARIO
// Actualiza el nombre de usuario de la cuenta autenticada.
export const changeOwnUsername = async (
  body: unknown,
  user: AuthenticatedUser
) => {
  // Valida el nuevo nombre de usuario.
  const {
    nombre_usuario,
  } = usernameUpdateSchema.parse(body);

  try {
    // El índice único de la base comprueba duplicados
    // sin distinguir mayúsculas.
    if (
      !await updateUsername(
        user.id_usuario,
        nombre_usuario
      )
    ) {
      throw new AppError(
        'Cuenta no disponible.',
        409
      );
    }
  } catch (error) {
    // Detecta un nombre de usuario duplicado.
    if (
      hasDatabaseCode(
        error,
        '23505'
      )
    ) {
      throw new AppError(
        duplicateMessages.username,
        409
      );
    }

    throw error;
  }
};

// CAMBIO DE CONTRASEÑA

// Cambia la contraseña de la cuenta autenticada.
export const changeOwnPassword = async (
  body: unknown,
  user: AuthenticatedUser
) => {
  // Valida las contraseñas recibidas.
  const input = passwordChangeSchema.parse(
    body
  );

  // Obtiene las credenciales actuales de la cuenta.
  const account = await findAccountCredentials(
    user.id_usuario
  );

  if (!account) {
    throw new AppError(
      'Cuenta no disponible.',
      403
    );
  }

  // Verifica que la cuenta pueda iniciar sesión.
  validateLoginAccess(account);

  // Las cuentas creadas con Google pueden no tener contraseña.
  if (!account.password_hash) {
    throw new AppError(
      'Tu cuenta utiliza Google. Usá Recuperar contraseña para establecer una contraseña mediante tu correo.',
      400
    );
  }

  // Comprueba que la contraseña actual sea correcta.
  if (
    !await verifyPassword(
      account.password_hash,
      input.currentPassword
    )
  ) {
    // Calcula la cantidad de intentos fallidos.
    const attempts =
      account.bloqueado_hasta &&
      Date.parse(account.bloqueado_hasta) <= Date.now()
        ? 1
        : (account.intentos_fallidos ?? 0) + 1;

    // Registra el intento y bloquea temporalmente
    // la cuenta si supera el límite permitido.
    await registerFailedLogin(
      user.id_usuario,
      attempts,
      attempts >= env.LOGIN_MAX_ATTEMPTS
        ? new Date(
            Date.now() +
              env.LOGIN_LOCK_MINUTES * 60000
          ).toISOString()
        : null
    );

    throw new AppError(
      'La contraseña actual es incorrecta.',
      400
    );
  }

  // Genera el hash de la nueva contraseña.
  const hash = await hashPassword(
    input.newPassword
  );

  // Invalida tokens anteriores de recuperación.
  await invalidatePreviousRecoveryTokens(
    user.id_usuario
  );

  // Cierra las sesiones activas del usuario.
  await revokeAllUserRefreshSessions(
    user.id_usuario
  );

  // Reemplaza la contraseña solo si no cambió concurrentemente.
  if (
    !await replacePassword(
      user.id_usuario,
      account.password_hash,
      hash
    )
  ) {
    throw new AppError(
      'La cuenta cambió. Volvé a ingresar antes de intentar nuevamente.',
      409
    );
  }
};
