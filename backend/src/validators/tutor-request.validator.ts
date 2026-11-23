import { z } from 'zod';
import { personDniSchema } from './person.validator.js';

export const createTutorRequestSchema = z.object({
  direccion: z.enum(['GESTIONAR_A_OTRO', 'DELEGAR_MI_GESTION']),
  dni_persona_destino: personDniSchema,
  parentesco: z.string().trim().min(1).max(50),
}).strict();

export const resolveTutorRequestSchema = z.discriminatedUnion('accion', [
  z.object({
    accion: z.literal('APROBAR'),
    identidad_verificada: z.literal(true),
    documentacion_verificada: z.literal(true),
    autorizacion_verificada: z.literal(true),
  }).strict(),
  z.object({
    accion: z.literal('RECHAZAR'),
    motivo_rechazo: z.string().trim().min(3).max(500),
  }).strict(),
]);

export type CreateTutorRequestInput = z.infer<typeof createTutorRequestSchema>;
export type ResolveTutorRequestInput = z.infer<typeof resolveTutorRequestSchema>;
