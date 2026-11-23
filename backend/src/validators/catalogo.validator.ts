import { z } from 'zod';

import {
  personAddressSchema,
  personEmailSchema,
  personPhoneSchema,
} from './person.validator.js';

import {
  horaSchema,
} from './horario-atencion.validator.js';

// Valida nombres de lugares y catálogos.
const nombre = (max: number) =>
  z
    .string()
    .trim()
    .min(
      1,
      'El nombre es obligatorio'
    )
    .max(max);

// Valida códigos utilizados en los catálogos.
const codigo = (max: number) =>
  z
    .string()
    .trim()
    .min(
      1,
      'El código es obligatorio'
    )
    .max(max);

// Valida la creación de una zona.
export const createZonaSchema = z
  .object({
    nombre: nombre(100),

    descripcion: z
      .string()
      .trim()
      .nullable()
      .optional(),

    activo: z
      .boolean()
      .optional(),
  })
  .strict();

// Valida la creación de un barrio.
export const createBarrioSchema = z
  .object({
    nombre: nombre(120),

    id_zona: z
      .string()
      .uuid(
        'Seleccioná una zona válida'
      ),

    codigo_postal: z
      .string()
      .trim()
      .max(12)
      .nullable()
      .optional(),

    activo: z
      .boolean()
      .optional(),
  })
  .strict();

// Valida la creación de una especialidad.
export const createEspecialidadSchema = z
  .object({
    codigo: codigo(40),

    nombre: nombre(120),

    descripcion: z
      .string()
      .trim()
      .nullable()
      .optional(),

    requiere_profesional: z
      .boolean(),

    activo: z
      .boolean()
      .optional(),
  })
  .strict();

// Valida la creación de una salita.
export const createSalitaSchema = z
  .object({
    codigo: codigo(30),

    nombre: nombre(150),

    direccion:
      personAddressSchema,

    id_barrio: z
      .string()
      .uuid(
        'Seleccioná un barrio válido'
      ),

    telefono:
      personPhoneSchema
        .nullable()
        .optional(),

    email:
      personEmailSchema
        .nullable()
        .optional(),

    latitud: z
      .number()
      .min(-90)
      .max(90)
      .nullable()
      .optional(),

    longitud: z
      .number()
      .min(-180)
      .max(180)
      .nullable()
      .optional(),

    horario_apertura:
      horaSchema
        .nullable()
        .optional(),

    horario_cierre:
      horaSchema
        .nullable()
        .optional(),

    activo: z
      .boolean()
      .optional(),
  })
  .strict();

// Valida la cobertura entre una salita y un barrio.
export const createCoberturaSchema = z
  .object({
    id_salita: z
      .string()
      .uuid(),

    id_barrio: z
      .string()
      .uuid(),

    es_barrio_sede: z
      .boolean()
      .optional(),

    activo: z
      .boolean()
      .optional(),

    fecha_desde: z
      .string()
      .date(
        'La fecha desde no es válida'
      ),

    fecha_hasta: z
      .string()
      .date(
        'La fecha hasta no es válida'
      )
      .nullable()
      .optional(),
  })
  .strict();

// Permite actualizar parcialmente una zona.
export const updateZonaSchema =
  createZonaSchema.partial();

// Permite actualizar parcialmente un barrio.
export const updateBarrioSchema =
  createBarrioSchema.partial();

// Permite actualizar parcialmente una especialidad.
export const updateEspecialidadSchema =
  createEspecialidadSchema.partial();

// Permite actualizar parcialmente una salita.
export const updateSalitaSchema =
  createSalitaSchema.partial();

// Permite actualizar parcialmente una cobertura.
export const updateCoberturaSchema =
  createCoberturaSchema
    .omit({
      id_salita: true,
      id_barrio: true,
    })
    .partial();