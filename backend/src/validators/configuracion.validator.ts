import { z } from "zod";

export const configuracionClaveSchema = z.string().max(100).regex(/^[a-z][a-z0-9_.-]*$/);

const valorSchema = z.json().refine(value => value !== null, "valor no puede ser null");

export const configuracionQuerySchema = z.object({
  scope: z.literal("global").optional(),
  id_salita: z.string().uuid().optional(),
}).strict().refine(data => !(data.scope && data.id_salita), "No combinar scope=global con id_salita");

export const configuracionClaveParamsSchema = z.object({ clave: configuracionClaveSchema });

export const configuracionIdParamsSchema = z.object({ id: z.string().uuid() });

export const createConfiguracionSchema = z.object({
  id_salita: z.string().uuid().nullable().optional(),
  clave: configuracionClaveSchema,
  valor: valorSchema,
  descripcion: z.string().trim().max(2000).nullable().optional(),
  es_publica: z.boolean().default(false),
}).strict();

// Rechaza cambios de clave, scope, identificadores y auditoría.
export const updateConfiguracionSchema = createConfiguracionSchema
  .pick({ valor: true, descripcion: true, es_publica: true }).partial()
  .extend({ es_publica: z.boolean().optional() })
  .refine(data => Object.keys(data).length > 0, "Debe indicar un campo para actualizar");

export type ConfiguracionQuery = z.infer<typeof configuracionQuerySchema>;

export type CreateConfiguracionInput = z.infer<typeof createConfiguracionSchema>;

export type UpdateConfiguracionInput = z.infer<typeof updateConfiguracionSchema>;

export type ConfiguracionValor = z.infer<typeof valorSchema>;
