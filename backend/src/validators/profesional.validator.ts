import { z } from 'zod';

import {
  licensePattern,
  fieldMessages,
} from './field-rules.js';

import {
  createPersonSchema,
  updatePersonSchema,
} from './person.validator.js';

// Valida la matrícula del profesional.
const matriculaSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(
    licensePattern,
    fieldMessages.license
  );

// Valida la creación de un profesional.
export const createProfesionalSchema =
  createPersonSchema
    .extend({
      matricula:
        matriculaSchema,
    })
    .strict();

// Valida la actualización de un profesional.
export const updateProfesionalSchema =
  updatePersonSchema
    .extend({
      matricula:
        matriculaSchema
          .optional(),

      activo: z
        .boolean()
        .optional(),

      fecha_alta: z
        .string()
        .date()
        .optional(),

      fecha_baja: z
        .string()
        .date()
        .nullable()
        .optional(),
    })
    .strict();

// Tipo utilizado para crear un profesional.
export type CreateProfesionalInput =
  z.infer<
    typeof createProfesionalSchema
  >;

// Tipo utilizado para actualizar un profesional.
export type UpdateProfesionalInput =
  z.infer<
    typeof updateProfesionalSchema
  >;