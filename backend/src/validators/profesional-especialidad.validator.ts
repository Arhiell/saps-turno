import { z } from "zod";

export const createProfesionalEspecialidadSchema = z.object({
  id_especialidad: z.string().uuid(),
  fecha_desde: z.string().date().optional(),
  fecha_hasta: z.string().date().nullable().optional()
}).strict();

export const updateProfesionalEspecialidadSchema = z.object({
  fecha_desde: z.string().date().optional(),
  fecha_hasta: z.string().date().nullable().optional(),
  activo: z.boolean().optional()
}).strict();

export type CreateProfesionalEspecialidadInput =
  z.infer<typeof createProfesionalEspecialidadSchema>;

export type UpdateProfesionalEspecialidadInput =
  z.infer<typeof updateProfesionalEspecialidadSchema>;