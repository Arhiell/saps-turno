
import { z } from "zod";

/**
 * UUID recibido por parámetro.
 */
export const patientIdSchema = z.object({
  id: z
    .string()
    .uuid("El ID del paciente no es válido")
});

/**
 * DNI recibido por parámetro.
 */
export const patientDniSchema = z.object({
  dni: z
    .string()
    .regex(
      /^[0-9]{7,15}$/,
      "El DNI debe contener entre 7 y 15 números"
    )
});

/**
 * Paginación y filtros del listado de pacientes.
 */
export const patientListQuerySchema = z.object({
  search: z.string().trim().max(150).optional(),

  estado: z
    .enum(["activo", "inactivo", "todos"])
    .default("activo"),

  id_salita: z
    .string()
    .uuid("El ID de la salita no es válido")
    .optional(),

  page: z.coerce
    .number()
    .int()
    .positive()
    .default(1),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
});

export type PatientListQuery =
  z.infer<typeof patientListQuerySchema>;
