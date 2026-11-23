import { z } from "zod";

export const disponibilidadQuerySchema = z
  .object({
    fecha: z.string().date("La fecha debe tener formato YYYY-MM-DD"),
    id_profesional: z.string().uuid(),
    id_especialidad: z.string().uuid(),
    id_salita: z.string().uuid(),
    id_paciente: z.string().uuid().optional(),
  })
  .strict();

export type DisponibilidadQuery = z.infer<
  typeof disponibilidadQuerySchema
>;

// Solo la consulta administrativa permite excluir el turno que se reprograma.
export const disponibilidadAdminQuerySchema = disponibilidadQuerySchema.extend({
  id_turno: z.string().uuid().optional(),
});
