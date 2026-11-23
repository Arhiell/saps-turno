
import { z } from "zod";

import { turnoFields } from "./turno.validator.js";
import { turnoEstadoSchema } from "./turno-query.validator.js";

// Excluye el paciente para impedir cambios en su asignación histórica.
const {
  id_paciente: _patient,
  ...editable
} = turnoFields;

// Valida los campos permitidos para actualizar un turno.
export const updateTurnoSchema = z.object({
  ...editable,

  // Motivo requerido por el servicio cuando existe una reprogramación.
  motivo_reprogramacion: z.string()
    .trim()
    .min(3)
    .max(500),

  // Versión utilizada para controlar modificaciones concurrentes.
  version: z.number()
    .int()
    .positive(),
})
  .partial()
  .strict()
  // Exige al menos un campo editable, sin contar motivo ni versión.
  .refine(
    ({
      motivo_reprogramacion: _motivo,
      version: _version,
      ...value
    }) =>
      Object.values(value).some(
        (item) => item !== undefined
      ),
    {
      message: "Debe enviar al menos un campo para actualizar",
    }
  );

// Valida los cambios de estado y el motivo de cancelación.
export const turnoStatusSchema = z.object({
  estado: turnoEstadoSchema,

  motivo_cancelacion: z.string()
    .trim()
    .min(1)
    .max(2000)
    .optional(),
})
  .strict()
  // Permite el motivo de cancelación únicamente para el estado CANCELADO.
  .refine(
    (value) =>
      value.estado === "CANCELADO" ||
      !value.motivo_cancelacion,
    {
      message: "El motivo de cancelación solo corresponde al estado CANCELADO",
    }
  );

// Tipos inferidos a partir de los esquemas de validación.
export type UpdateTurnoInput = z.infer<typeof updateTurnoSchema>;
export type TurnoStatusInput = z.infer<typeof turnoStatusSchema>;
