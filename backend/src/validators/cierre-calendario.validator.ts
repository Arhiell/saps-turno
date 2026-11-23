
import { z } from 'zod';

// Define los tipos de cierres institucionales permitidos.
export const tiposCierre = [
  'FERIADO_NACIONAL',
  'FERIADO_PROVINCIAL',
  'FERIADO_MUNICIPAL',
  'DIA_NO_LABORABLE',
  'ASUETO',
  'DUELO',
  'FUMIGACION',
  'MANTENIMIENTO',
  'EMERGENCIA',
  'CIERRE_ADMINISTRATIVO',
  'OTRO',
] as const;

// Valida las horas y normaliza su formato a HH:mm.
const hora = z.string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/)
  .transform((value) => value.slice(0, 5));

// Valida los datos de creación y modificación de cierres.
export const cierreSchema = z.object({
  titulo: z.string()
    .trim()
    .min(3)
    .max(150),

  observaciones: z.string()
    .trim()
    .max(2000)
    .nullable()
    .default(null),

  tipo: z.enum(tiposCierre),

  alcance: z.enum([
    'GLOBAL',
    'SALITA',
  ]),

  id_salita: z.string()
    .uuid()
    .nullable(),

  fecha_inicio: z.string().date(),
  fecha_fin: z.string().date(),

  dia_completo: z.boolean(),

  hora_inicio: hora.nullable(),
  hora_fin: hora.nullable(),

  origen: z.string()
    .trim()
    .min(3)
    .max(200)
    .default('Carga administrativa'),

  activo: z.boolean().default(true),
})
  .strict()
  .superRefine((v, ctx) => {
    // Registra errores de validación en el campo correspondiente.
    const error = (
      path: string,
      message: string
    ) =>
      ctx.addIssue({
        code: 'custom',
        path: [path],
        message,
      });

    // Verifica que el período tenga fechas válidas.
    if (v.fecha_fin < v.fecha_inicio) {
      error(
        'fecha_fin',
        'La fecha final debe ser igual o posterior a la inicial'
      );
    }

    // Exige una salita únicamente cuando el alcance es SALITA.
    if (
      (v.alcance === 'GLOBAL') !==
      (v.id_salita === null)
    ) {
      error(
        'id_salita',
        'Seleccioná una salita únicamente para el alcance SALITA'
      );
    }

    // Valida las horas según el cierre sea completo o parcial.
    if (
      v.dia_completo
        ? v.hora_inicio !== null ||
          v.hora_fin !== null
        : !v.hora_inicio ||
          !v.hora_fin ||
          v.hora_inicio >= v.hora_fin
    ) {
      error(
        'hora_inicio',
        'Día completo no lleva horas; una franja requiere inicio anterior al fin'
      );
    }
  });

// Tipo inferido de los datos validados del cierre.
export type CierreInput = z.infer<typeof cierreSchema>;

// Representa un cierre almacenado en la base de datos.
export type Cierre = CierreInput & {
  id_cierre: string;
  creado_por: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
  fuente_externa: 'ARGENTINADATOS' | null;
  clave_externa: string | null;
  datos_externos: unknown;
};

// Extrae y valida los campos editables de un cierre almacenado.
export const datosCierre = (
  row: Cierre
): CierreInput =>
  cierreSchema.parse(
    Object.fromEntries(
      [
        'titulo',
        'observaciones',
        'tipo',
        'alcance',
        'id_salita',
        'fecha_inicio',
        'fecha_fin',
        'dia_completo',
        'hora_inicio',
        'hora_fin',
        'origen',
        'activo',
      ].map((key) => [
        key,
        row[key as keyof Cierre],
      ])
    )
  );
