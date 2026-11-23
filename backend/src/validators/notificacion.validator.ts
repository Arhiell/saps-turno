import { z } from "zod";

const uuidSchema = z.string().uuid("Debe ser un UUID válido");

export const notificacionIdSchema = z.object({
  id: uuidSchema,
});

export const notificacionQuerySchema = z.object({
  leida: z
    .enum(["true", "false"])
    .optional(),

  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
});

export const createNotificacionSchema = z.object({
  id_usuario: uuidSchema,
  id_turno: uuidSchema.optional().nullable(),

  tipo: z
    .string()
    .trim()
    .min(2)
    .max(50),

  titulo: z
    .string()
    .trim()
    .min(3)
    .max(160),

  mensaje: z
    .string()
    .trim()
    .min(3),
});

export type NotificacionQuery =
  z.infer<typeof notificacionQuerySchema>;

export type CreateNotificacionInput =
  z.infer<typeof createNotificacionSchema>;