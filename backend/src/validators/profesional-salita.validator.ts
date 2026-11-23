import { z } from "zod";

export const createProfesionalSalitaSchema = z.object({
  id_salita: z.string().uuid(),
  fecha_desde: z.string().date().optional(),
  fecha_hasta: z.string().date().nullable().optional()
}).strict();

export const updateProfesionalSalitaSchema = z.object({
  fecha_desde: z.string().date().optional(),
  fecha_hasta: z.string().date().nullable().optional(),
  activo: z.boolean().optional()
}).strict();

export type CreateProfesionalSalitaInput =
  z.infer<typeof createProfesionalSalitaSchema>;

export type UpdateProfesionalSalitaInput =
  z.infer<typeof updateProfesionalSalitaSchema>;