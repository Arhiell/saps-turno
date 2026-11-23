import { z } from 'zod';

import {
  usernamePattern,
  fieldMessages,
} from './field-rules.js';

// Política única de contraseñas de CORA:
// - Longitud entre 8 y 20 caracteres.
// - Al menos una mayúscula.
// - Al menos una minúscula.
// - Al menos un número.
// - Símbolos especiales opcionales.
export const passwordPolicySchema = z
  .string()
  .min(
    8,
    'La contraseña debe tener al menos 8 caracteres'
  )
  .max(
    20,
    'La contraseña no puede superar los 20 caracteres'
  )
  .regex(
    /[A-Z]/,
    'La contraseña debe contener al menos una mayúscula'
  )
  .regex(
    /[a-z]/,
    'La contraseña debe contener al menos una minúscula'
  )
  .regex(
    /[0-9]/,
    'La contraseña debe contener al menos un número'
  );

// Valida los datos necesarios para registrar una cuenta nueva.
export const registerSchema = z.object({
  nombre_usuario: z
    .string()
    .trim()
    .min(
      3,
      'El nombre de usuario debe tener al menos 3 caracteres'
    )
    .max(
      60,
      'El nombre de usuario no puede superar 60 caracteres'
    )
    .regex(
      usernamePattern,
      fieldMessages.username
    )
    .optional(),

  email: z
    .string()
    .trim()
    .email(
      'El correo electrónico no es válido'
    )
    .max(
      254,
      'El correo electrónico es demasiado largo'
    ),

  password: passwordPolicySchema,
});

// Obtiene el tipo a partir del esquema de registro.
export type RegisterInput =
  z.infer<typeof registerSchema>;

// Valida el inicio de sesión mediante email o nombre de usuario.
export const loginSchema = z
  .object({
    identifier: z
      .string()
      .trim()
      .min(3),

    password: z
      .string()
      .min(1),
  })
  .strict();

export type LoginInput =
  z.infer<typeof loginSchema>;

// Valida el refresh token utilizado para renovar o cerrar sesión.
export const refreshTokenSchema = z
  .object({
    refreshToken: z
      .string()
      .min(
        64,
        'Refresh token inválido'
      ),
  })
  .strict();