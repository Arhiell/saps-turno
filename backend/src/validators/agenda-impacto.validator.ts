
import { z } from 'zod';

import { cierreSchema } from './cierre-calendario.validator.js';
import { updateHorarioAtencionSchema } from './horario-atencion.validator.js';
import { createBloqueoAgendaSchema } from './bloqueo-agenda.validator.js';

// Valida los cambios de agenda según el tipo de configuración.
export const agendaChangeSchema = z.discriminatedUnion('tipo', [
  // Creación o modificación de un cierre institucional.
  z.object({
    tipo: z.literal('cierre'),
    id: z.string().uuid().optional(),
    datos: cierreSchema,
  }).strict(),

  // Modificación de un horario de atención existente.
  z.object({
    tipo: z.literal('horario'),
    id: z.string().uuid(),
    datos: updateHorarioAtencionSchema,
  }).strict(),

  // Creación o modificación de un bloqueo de agenda.
  z.object({
    tipo: z.literal('bloqueo'),
    id: z.string().uuid().optional(),
    datos: createBloqueoAgendaSchema,
  }).strict(),
]);

// Valida la solicitud para generar propuestas de reprogramación.
export const agendaProposalSchema = z.object({
  cambio: agendaChangeSchema,

  // Limita la búsqueda a un período de entre 1 y 90 días.
  dias: z.number()
    .int()
    .min(1)
    .max(90)
    .default(30),
}).strict();

// Valida la confirmación de los cambios y turnos reprogramados.
export const agendaConfirmSchema = z.object({
  cambio: agendaChangeSchema,

  // Exige un motivo para confirmar la reprogramación.
  motivo: z.string()
    .trim()
    .min(3)
    .max(500),

  // Valida los turnos seleccionados y sus nuevos destinos.
  turnos: z.array(
    z.object({
      id_turno: z.string().uuid(),
      version: z.number().int().positive(),
      id_horario: z.string().uuid(),
      fecha_hora_inicio: z.string().datetime({
        offset: true,
      }),
    }).strict()
  )
    .min(1)
    .max(100),
})
  .strict()

  // Impide incluir el mismo turno más de una vez.
  .refine(
    (v) =>
      new Set(
        v.turnos.map((t) => t.id_turno)
      ).size === v.turnos.length,
    {
      message: 'No se puede repetir un turno',
    }
  );

// Tipos inferidos a partir de los esquemas de validación.
export type AgendaChange = z.infer<typeof agendaChangeSchema>;
export type AgendaConfirmation = z.infer<typeof agendaConfirmSchema>;

// Valida la consulta de disponibilidad para reprogramar un turno.
export const agendaAvailabilitySchema = z.object({
  cambio: agendaChangeSchema,
  id_turno: z.string().uuid(),
  fecha: z.string().date(),
}).strict();
