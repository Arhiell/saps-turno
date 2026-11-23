import { z } from "zod";

/**
 * Google Identity Services entrega
 * el ID Token dentro de "credential".
 */
export const googleLoginSchema = z
  .object({
    credential: z
      .string()
      .min(
        20,
        "La credencial de Google no es válida"
      )
  })
  .strict();

export type GoogleLoginInput =
  z.infer<typeof googleLoginSchema>;