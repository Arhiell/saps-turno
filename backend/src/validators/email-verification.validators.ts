import { z } from "zod";

// ========================================
// SOLICITUD DE VERIFICACIÓN
// ========================================

export const requestEmailVerificationSchema =
  z.object({
    email: z
      .string()
      .trim()
      .email("El correo no es válido")
      .max(254),
  }).strict();

// ========================================
// VERIFICACIÓN
// ========================================

export const verifyEmailSchema =
  z.union([

    // Verificación mediante enlace/token.
    z.object({
      token: z
        .string()
        .length(
          64,
          "El token de verificación no es válido",
        ),
    }).strict(),

    // Verificación normal mediante email + código.
    z.object({
      email: z
        .string()
        .trim()
        .email()
        .max(254),

      code: z
        .string()
        .regex(
          /^\d{4}$/,
          "El código debe tener 4 dígitos",
        ),
    }).strict(),

    // Verificación para completar un login
    // que quedó pendiente por email no verificado.
    z.object({
      loginVerificationToken:
        z.string().min(1),

      code: z
        .string()
        .regex(
          /^\d{4}$/,
          "El código debe tener 4 dígitos",
        ),
    }).strict(),
  ]);

export const verifyEmailCodeSchema =
  z.object({
    email: z
      .string()
      .trim()
      .email()
      .max(254),

    code: z
      .string()
      .regex(/^\d{4}$/),
  }).strict();

export type RequestEmailVerificationInput =
  z.infer<
    typeof requestEmailVerificationSchema
  >;

export type VerifyEmailInput =
  z.infer<
    typeof verifyEmailSchema
  >;

export type VerifyEmailCodeInput =
  z.infer<
    typeof verifyEmailCodeSchema
  >;