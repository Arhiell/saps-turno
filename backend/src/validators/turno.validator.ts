import { z } from "zod";

// El cliente envía un instante con zona; duración y estado los decide el backend.
export const turnoFields = {
  id_paciente: z.string().uuid(),
  id_profesional: z.string().uuid(),
  id_especialidad: z.string().uuid(),
  id_salita: z.string().uuid(),
  id_horario: z.string().uuid().optional(),
  fecha_hora_inicio: z.iso.datetime({ offset: true, precision: 0 }),
  motivo_consulta: z.string().trim().min(1).max(2000).nullable().optional(),
  observaciones: z.string().trim().min(1).max(4000).nullable().optional()
};

export const createTurnoSchema = z.object(turnoFields).strict();
export type CreateTurnoInput = z.infer<typeof createTurnoSchema>;
