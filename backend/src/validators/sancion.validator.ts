import { z } from "zod";

const uuidSchema = z.string().uuid("Debe ser un UUID válido");

// La fecha_fin es obligatoria porque la tabla exige 
// que sea posterior a fecha_inicio. 
// La BBDD además guarda si fue anulada, 
// motivo, quién anuló y quién la creó. 

export const createSancionSchema = z.object({
  id_paciente: uuidSchema,
  id_especialidad: uuidSchema,
  id_turno: uuidSchema,

  motivo: z
    .string()
    .trim()
    .min(5, "El motivo debe tener al menos 5 caracteres")
    .max(500, "El motivo es demasiado largo"),

  fecha_fin: z
    .string()
    .datetime({ offset: true })
    .refine(
      (value) => new Date(value) > new Date(),
      "La fecha de finalización debe ser futura",
    ),
});

export const sancionIdSchema = z.object({
  id: uuidSchema,
});

export const anularSancionSchema = z.object({
  motivo_anulacion: z
    .string()
    .trim()
    .min(5, "Debe indicar el motivo de anulación")
    .max(500),
});

export const sancionQuerySchema = z.object({
  id_paciente: uuidSchema.optional(),
  id_especialidad: uuidSchema.optional(),

  vigente: z
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

export type CreateSancionInput =
  z.infer<typeof createSancionSchema>;

export type SancionQuery =
  z.infer<typeof sancionQuerySchema>;