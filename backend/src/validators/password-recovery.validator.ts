import { z } from 'zod';

import { registerSchema } from './auth.validator.js';

// Valida el correo para solicitar la recuperación de contraseña.
export const forgotPasswordSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email('El correo electrónico no es válido')
      .max(254),
  })
  .strict();

// Reutiliza la política de contraseñas definida en el registro.
export const newPasswordSchema = registerSchema.shape.password;

// Valida la recuperación mediante token o correo y código.
export const resetPasswordSchema = z
  .object({
    token: z
      .string()
      .min(64, 'El token de recuperación no es válido')
      .optional(),

    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .optional(),

    code: z
      .string()
      .regex(/^\d{4}$/, 'El código debe tener 4 dígitos')
      .optional(),

    newPassword: newPasswordSchema,
  })
  .strict()
  .refine(
    ({ token, email, code }) =>
      (Boolean(token) && !email && !code) ||
      (!token && Boolean(email) && Boolean(code)),
    {
      message: 'Ingresá un token válido o el correo y código de recuperación.',
      path: ['code'],
    }
  );

// Define los datos para solicitar la recuperación de contraseña.
export type ForgotPasswordInput =
  z.infer<typeof forgotPasswordSchema>;

// Define los datos para restablecer la contraseña.
export type ResetPasswordInput =
  z.infer<typeof resetPasswordSchema>;