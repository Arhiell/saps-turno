import { z } from 'zod';

import {
  createPersonSchema,
  personAddressSchema,
  personBirthDateSchema,
  personSexSchema,
  contactNameSchema,
  personPhoneSchema,
} from './person.validator.js';

// Valida los datos específicos del perfil de un paciente.
export const patientProfileSchema = z
  .object({
    id_barrio: z
      .string()
      .uuid(
        'id_barrio no es válido'
      ),

    id_salita_asignada: z
      .string()
      .uuid(
        'id_salita_asignada no es válido'
      ),

    obra_social: z
      .string()
      .trim()
      .max(150)
      .nullable()
      .optional(),

    numero_afiliado: z
      .string()
      .trim()
      .max(80)
      .nullable()
      .optional(),

    contacto_emergencia_nombre:
      contactNameSchema
        .nullable()
        .optional(),

    contacto_emergencia_telefono:
      personPhoneSchema
        .nullable()
        .optional(),
  })
  .strict();

// Valida la creación completa de un paciente.
export const createPatientSchema =
  createPersonSchema
    .extend({
      ...patientProfileSchema.shape,

      fecha_nacimiento:
        personBirthDateSchema,

      sexo:
        personSexSchema,

      direccion:
        personAddressSchema,
    })
    .strict();

// Tipo utilizado para completar el perfil del paciente.
export type PatientProfileInput =
  z.infer<
    typeof patientProfileSchema
  >;

// Tipo utilizado para crear un paciente.
export type CreatePatientInput =
  z.infer<
    typeof createPatientSchema
  >;

// Permite actualizar parcialmente el perfil del paciente.
export const updatePatientProfileSchema =
  patientProfileSchema.partial();

// Tipo utilizado para actualizar el perfil del paciente.
export type UpdatePatientProfileInput =
  z.infer<
    typeof updatePatientProfileSchema
  >;