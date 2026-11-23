import {
  z,
} from 'zod';

// ========================================
// IDENTIFICADOR DEL TURNO
// ========================================

// Valida que el ID recibido corresponda a un UUID.
export const turnoIdSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

// ========================================
// ESTADO DEL TURNO
// ========================================

// Los códigos son configurables:
// el servicio verifica que existan en estados_turno.
export const turnoEstadoSchema = z
  .string()
  .regex(
    /^[A-Z][A-Z0-9_]*$/
  )
  .max(40);

// ========================================
// FILTROS DE TURNOS
// ========================================

// Valida los parámetros permitidos
// para consultar y filtrar turnos.
export const turnoQuerySchema = z
  .object({
    // Filtra los turnos por una fecha específica.
    fecha: z.iso
      .date()
      .optional(),
    fecha_desde: z.iso.date().optional(),
    fecha_hasta: z.iso.date().optional(),

    // Permite consultar turnos próximos o anteriores.
    periodo: z
      .enum([
        'proximos',
        'anteriores',
      ])
      .optional(),

    // Define el orden de los resultados.
    orden: z
      .enum([
        'asc',
        'desc',
      ])
      .optional(),

    // Permite filtrar los turnos reprogramados.
    reprogramados: z
      .enum([
        'true',
        'false',
      ])
      .optional(),

    // Filtros por entidades relacionadas.
    id_profesional: z
      .string()
      .uuid()
      .optional(),

    id_especialidad: z
      .string()
      .uuid()
      .optional(),

    id_paciente: z
      .string()
      .uuid()
      .optional(),

    id_salita: z
      .string()
      .uuid()
      .optional(),

    // Filtra por código de estado.
    estado:
      turnoEstadoSchema.optional(),

    // Configuración de paginación.
    search: z.string().trim().max(150).optional(),

    page: z.coerce
      .number()
      .int()
      .positive()
      .max(1000000)
      .default(1),

    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20),
  })
  .strict()
  .refine(data => !(data.fecha_desde || data.fecha_hasta) ||
    (!data.fecha && !!data.fecha_desde && !!data.fecha_hasta && data.fecha_desde <= data.fecha_hasta),
  { message: 'Indicá un rango desde/hasta válido, sin combinarlo con fecha.', path: ['fecha_hasta'] });

// Tipo generado a partir del esquema de consulta.
export type TurnoQuery = z.infer<
  typeof turnoQuerySchema
>;
