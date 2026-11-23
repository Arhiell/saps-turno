import { z } from 'zod';

import {
  dniPattern,
  namePattern,
  phonePattern,
  fieldMessages,
} from './field-rules.js';

// Valida los nombres y apellidos de una persona.
export const personNameSchema = z
  .string()
  .trim()
  .min(2, 'El nombre o apellido debe tener al menos 2 letras')
  .max(100)
  .regex(namePattern, fieldMessages.name);

// Valida el nombre de contacto, permitiendo valores vacíos.
export const contactNameSchema = z
  .string()
  .trim()
  .max(200)
  .refine(
    (value) =>
      value === '' || namePattern.test(value),
    fieldMessages.name
  );

// Valida el número de teléfono, permitiendo valores vacíos.
export const personPhoneSchema = z
  .string()
  .trim()
  .max(30)
  .refine(
    (value) =>
      value === '' || phonePattern.test(value),
    fieldMessages.phone
  );

// Valida el formato del correo electrónico.
export const personEmailSchema = z
  .string()
  .trim()
  .email('El correo electrónico no es válido')
  .max(254);

// Valida el formato del DNI.
export const personDniSchema = z
  .string()
  .regex(dniPattern, fieldMessages.dni);

// Define los valores permitidos para el sexo.
export const personSexSchema = z.enum([
  'FEMENINO',
  'MASCULINO',
  'X',
  'NO_INFORMA',
]);

// Valida la fecha de nacimiento y evita fechas futuras.
export const personBirthDateSchema = z
  .string()
  .date('Ingresá una fecha de nacimiento válida (AAAA-MM-DD)')
  .refine(
    (date) =>
      date <= new Date().toISOString().slice(0, 10),
    'La fecha de nacimiento no puede ser futura'
  );

// Valida la dirección de una persona.
export const personAddressSchema = z
  .string()
  .trim()
  .min(3, 'La dirección debe tener al menos 3 caracteres')
  .max(250, 'La dirección no puede superar 250 caracteres');

// Define los datos necesarios para registrar una persona.
export const createPersonSchema = z
  .object({
    dni: personDniSchema,

    nombres: personNameSchema,

    apellidos: personNameSchema,

    fecha_nacimiento: personBirthDateSchema
      .nullable()
      .optional(),

    sexo: personSexSchema
      .nullable()
      .optional(),

    telefono: personPhoneSchema
      .nullable()
      .optional(),

    email: personEmailSchema
      .nullable()
      .optional(),

    direccion: personAddressSchema
      .nullable()
      .optional(),

    localidad: z
      .string()
      .trim()
      .max(120)
      .optional(),

    provincia: z
      .string()
      .trim()
      .max(120)
      .optional(),

    codigo_postal: z
      .string()
      .trim()
      .max(12)
      .nullable()
      .optional(),
  })
  .strict();

// Permite actualizar parcialmente los datos de una persona.
export const updatePersonSchema = createPersonSchema.partial();

// Limita la autogestión a los datos personales permitidos.
export const ownPersonUpdateSchema = updatePersonSchema
  .pick({
    nombres: true,
    apellidos: true,
    telefono: true,
    direccion: true,
    localidad: true,
    provincia: true,
    codigo_postal: true,
  })
  .strict();

// Valida los datos para completar un perfil sin modificar el correo.
export const completePersonSchema = createPersonSchema.omit({
  email: true,
});

// Define el tipo de datos para completar un perfil.
export type CompletePersonInput =
  z.infer<typeof completePersonSchema>;

// Define el tipo de datos para registrar una persona.
export type CreatePersonInput =
  z.infer<typeof createPersonSchema>;

// Define el tipo de datos para actualizar una persona.
export type UpdatePersonInput =
  z.infer<typeof updatePersonSchema>;