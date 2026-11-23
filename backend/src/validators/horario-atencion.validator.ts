import { z } from 'zod';

// Valida horas en formato HH:mm o HH:mm:ss.
export const horaSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
    'La hora debe tener formato HH:mm o HH:mm:ss'
  );

// Valida fechas en formato YYYY-MM-DD.
const fechaSchema = z
  .string()
  .date(
    'La fecha debe tener formato YYYY-MM-DD'
  );

// Valida la creación de un horario de atención.
export const createHorarioAtencionSchema = z
  .object({
    id_profesional: z
      .string()
      .uuid(),

    id_especialidad: z
      .string()
      .uuid(),

    id_salita: z
      .string()
      .uuid(),

    dia_semana: z
      .number()
      .int()
      .min(1)
      .max(7),

    hora_inicio:
      horaSchema,

    hora_fin:
      horaSchema,

    duracion_turno_minutos: z
      .number()
      .int()
      .min(5)
      .max(240)
      .optional(),

    cupo_maximo_diario: z
      .number()
      .int()
      .positive()
      .nullable()
      .optional(),

    vigencia_desde:
      fechaSchema
        .optional(),

    vigencia_hasta:
      fechaSchema
        .nullable()
        .optional(),

    activo: z
      .boolean()
      .optional(),
  })
  .strict();

// Valida la actualización de un horario de atención.
export const updateHorarioAtencionSchema = z
  .object({
    id_profesional: z
      .string()
      .uuid()
      .optional(),

    id_especialidad: z
      .string()
      .uuid()
      .optional(),

    id_salita: z
      .string()
      .uuid()
      .optional(),

    dia_semana: z
      .number()
      .int()
      .min(1)
      .max(7)
      .optional(),

    hora_inicio:
      horaSchema
        .optional(),

    hora_fin:
      horaSchema
        .optional(),

    duracion_turno_minutos: z
      .number()
      .int()
      .min(5)
      .max(240)
      .optional(),

    cupo_maximo_diario: z
      .number()
      .int()
      .positive()
      .nullable()
      .optional(),

    vigencia_desde:
      fechaSchema
        .optional(),

    vigencia_hasta:
      fechaSchema
        .nullable()
        .optional(),

    activo: z
      .boolean()
      .optional(),
  })
  .strict();

// Tipo utilizado para crear horarios de atención.
export type CreateHorarioAtencionInput =
  z.infer<
    typeof createHorarioAtencionSchema
  >;

// Tipo utilizado para actualizar horarios de atención.
export type UpdateHorarioAtencionInput =
  z.infer<
    typeof updateHorarioAtencionSchema
  >;