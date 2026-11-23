import {
  z,
} from 'zod';

import {
  registerSchema,
} from './auth.validator.js';

import {
  newPasswordSchema,
} from './password-recovery.validator.js';

// Comparte las reglas de validación
// de registro y recuperación existentes.

// Valida el cambio de nombre de usuario.
export const usernameUpdateSchema = z
  .object({
    // Reutiliza la validación definida en el registro.
    nombre_usuario:
      registerSchema.shape.nombre_usuario.unwrap(),
  })
  .strict();

// Valida el cambio de contraseña.
export const passwordChangeSchema = z
  .object({
    // Contraseña actual del usuario.
    currentPassword: z
      .string()
      .min(1)
      .max(128),

    // Reutiliza las reglas de la contraseña nueva
    // definidas para recuperación de contraseña.
    newPassword: newPasswordSchema,
  })
  .strict()
  .refine(
    (data) =>
      data.currentPassword !==
      data.newPassword,
    {
      // Impide reutilizar la contraseña actual.
      message:
        'La nueva contraseña debe ser diferente de la actual.',
    }
  );