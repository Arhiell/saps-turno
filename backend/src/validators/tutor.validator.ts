import { z } from 'zod';

import {
  createPersonSchema,
  personPhoneSchema,
} from './person.validator.js';

// Valida la creación de un tutor.
export const createTutorSchema =
  createPersonSchema
    .extend({
      telefono:
        personPhoneSchema.min(
          6,
          'El teléfono es demasiado corto'
        ),
    })
    .strict();

// Tipo utilizado para crear un tutor.
export type CreateTutorInput =
  z.infer<
    typeof createTutorSchema
  >;