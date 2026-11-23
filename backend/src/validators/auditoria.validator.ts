import { z } from "zod";

const uuidSchema = z.string().uuid("Debe ser un UUID válido");

export const auditoriaIdSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive("El id debe ser válido"),
});

export const auditoriaQuerySchema = z.object({
  entidad: z.string().trim().min(1).optional(),

  accion: z
    .enum(["INSERT", "UPDATE", "DELETE"])
    .optional(),

  id_usuario: uuidSchema.optional(),

  id_salita: uuidSchema.optional(),

  id_entidad: z.string().trim().optional(),

  fecha_desde: z.string().date().optional(),

  fecha_hasta: z.string().date().optional(),

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

export type AuditoriaQuery =
  z.infer<typeof auditoriaQuerySchema>;
