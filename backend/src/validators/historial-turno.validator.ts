import { z } from "zod";

export const historialTurnoParamsSchema = z.object({
  idTurno: z
    .string()
    .uuid("El id del turno debe ser un UUID válido"),
});

export const historialTurnoQuerySchema = z.object({
  accion: z
    .string()
    .trim()
    .min(1)
    .optional(),

  id_usuario: z
    .string()
    .uuid("El id_usuario debe ser un UUID válido")
    .optional(),

  fecha_desde: z
    .string()
    .date("fecha_desde debe tener formato YYYY-MM-DD")
    .optional(),

  fecha_hasta: z
    .string()
    .date("fecha_hasta debe tener formato YYYY-MM-DD")
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
}).refine(
  ({ fecha_desde, fecha_hasta }) => !fecha_desde || !fecha_hasta || fecha_desde <= fecha_hasta,
  { message: "fecha_hasta debe ser mayor o igual a fecha_desde", path: ["fecha_hasta"] },
);

export type HistorialTurnoParams =
  z.infer<typeof historialTurnoParamsSchema>;

export type HistorialTurnoQuery =
  z.infer<typeof historialTurnoQuerySchema>;
