import { timeToSeconds } from "../utils/time.js";
import { z } from "zod";

const horaSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
    "La hora debe tener formato HH:mm o HH:mm:ss"
  );

const fechaSchema = z
  .string()
  .date("La fecha debe tener formato YYYY-MM-DD");

export const createBloqueoAgendaSchema = z
  .object({
    id_profesional: z.string().uuid().nullable().optional(),
    id_salita: z.string().uuid(),
    id_especialidad: z.string().uuid().nullable().optional(),
    fecha: fechaSchema,
    hora_inicio: horaSchema.nullable().optional(),
    hora_fin: horaSchema.nullable().optional(),
    dia_completo: z.boolean().optional(),
    motivo: z.string().trim().min(1).max(500),
    activo: z.boolean().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const diaCompleto = data.dia_completo ?? false;

    if (diaCompleto) {
      if (data.hora_inicio !== undefined && data.hora_inicio !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["hora_inicio"],
          message: "Un bloqueo de día completo no debe tener hora de inicio",
        });
      }

      if (data.hora_fin !== undefined && data.hora_fin !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["hora_fin"],
          message: "Un bloqueo de día completo no debe tener hora de fin",
        });
      }

      return;
    }

    if (data.hora_inicio === undefined || data.hora_inicio === null) {
      ctx.addIssue({
        code: "custom",
        path: ["hora_inicio"],
        message: "Debe indicar la hora de inicio",
      });
    }

    if (data.hora_fin === undefined || data.hora_fin === null) {
      ctx.addIssue({
        code: "custom",
        path: ["hora_fin"],
        message: "Debe indicar la hora de fin",
      });
    }

    if (
      data.hora_inicio &&
      data.hora_fin &&
      timeToSeconds(data.hora_inicio) >= timeToSeconds(data.hora_fin)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["hora_fin"],
        message: "La hora de inicio debe ser menor que la hora de fin",
      });
    }
  });

export const updateBloqueoAgendaSchema = z
  .object({
    id_profesional: z.string().uuid().nullable().optional(),
    id_salita: z.string().uuid().optional(),
    id_especialidad: z.string().uuid().nullable().optional(),
    fecha: fechaSchema.optional(),
    hora_inicio: horaSchema.nullable().optional(),
    hora_fin: horaSchema.nullable().optional(),
    dia_completo: z.boolean().optional(),
    motivo: z.string().trim().min(1).max(500).optional(),
    activo: z.boolean().optional(),
  })
  .strict();

export type CreateBloqueoAgendaInput = z.infer<
  typeof createBloqueoAgendaSchema
>;

export type UpdateBloqueoAgendaInput = z.infer<
  typeof updateBloqueoAgendaSchema
>;