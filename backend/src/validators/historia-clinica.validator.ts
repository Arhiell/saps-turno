import { z } from 'zod';

import { agendaDateTime } from '../utils/turno-time.js';

const uuidSchema = z.string().uuid('Identificador UUID inválido');
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD');

const dateTimeOrDateSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      dateSchema.safeParse(value).success || !Number.isNaN(Date.parse(value)),
    'Fecha u hora inválida'
  );

const nonEmptyTrimmed = (label: string, max = 5000) =>
  z
    .string()
    .trim()
    .min(1, `${label} es obligatorio`)
    .max(max, `${label} supera la longitud máxima permitida`);

const optionalTrimmed = (max = 5000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable();

const booleanQuerySchema = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

export const patientIdParamsSchema = z
  .object({
    idPaciente: uuidSchema,
  })
  .strict();

export const consultaIdParamsSchema = z
  .object({
    idConsulta: uuidSchema,
  })
  .strict();

export const evolucionIdParamsSchema = z
  .object({
    idEvolucion: uuidSchema,
  })
  .strict();

export const estudioIdParamsSchema = z
  .object({
    idEstudio: uuidSchema,
  })
  .strict();

export const derivacionIdParamsSchema = z
  .object({
    idDerivacion: uuidSchema,
  })
  .strict();

export const consultarHistoriaClinicaQuerySchema = z
  .object({
    id_salita: uuidSchema,
    id_especialidad: uuidSchema.optional(),
    motivo_acceso: z.string().trim().min(3).max(500).optional(),
    es_exportacion: booleanQuerySchema.optional().default(false),
  })
  .strict();

export const consultarAntecedentesQuerySchema = z
  .object({
    id_salita: uuidSchema,
    id_especialidad: uuidSchema.optional(),
    motivo_acceso: z.string().trim().min(3).max(500).optional(),
    tipo: z
      .enum([
        'PERSONAL',
        'FAMILIAR',
        'QUIRURGICO',
        'PATOLOGICO',
        'GINECOLOGICO',
        'OTRO',
      ])
      .optional(),
    estado: z.enum(['ACTIVO', 'RESUELTO', 'INACTIVO', 'ANULADO']).optional(),
  })
  .strict();

export const consultarAlergiasQuerySchema = z
  .object({
    id_salita: uuidSchema,
    id_especialidad: uuidSchema.optional(),
    motivo_acceso: z.string().trim().min(3).max(500).optional(),
    estado: z.enum(['ACTIVA', 'RESUELTA', 'DESCARTADA', 'ANULADA']).optional(),
  })
  .strict();

export const consultarConsultaQuerySchema = z
  .object({
    id_salita: uuidSchema,
    id_paciente: uuidSchema.optional(),
    motivo_acceso: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

const diagnosticoItemSchema = z
  .object({
    codigo: optionalTrimmed(30),
    descripcion: nonEmptyTrimmed('Descripción del diagnóstico', 300),
    tipo: z
      .enum([
        'PRESUNTIVO',
        'CONFIRMADO',
        'DIFERENCIAL',
        'PRINCIPAL',
        'SECUNDARIO',
        'DESCARTADO',
      ])
      .optional(),
    fecha_diagnostico: dateSchema.optional(),
    observaciones: optionalTrimmed(2000),
  })
  .strict();

const evolucionItemSchema = z
  .object({
    evolucion: nonEmptyTrimmed('Texto de evolución'),
    observaciones: optionalTrimmed(2000),
  })
  .strict();

const tratamientoItemSchema = z
  .object({
    medicacion: nonEmptyTrimmed('Medicación', 200),
    dosis: nonEmptyTrimmed('Dosis', 120),
    frecuencia: nonEmptyTrimmed('Frecuencia', 120),
    duracion: optionalTrimmed(120),
    indicaciones: optionalTrimmed(2000),
    fecha_inicio: dateSchema.optional(),
    fecha_fin: dateSchema.optional().nullable(),
  })
  .strict()
  .refine(
    (item) =>
      !item.fecha_inicio ||
      !item.fecha_fin ||
      item.fecha_fin >= item.fecha_inicio,
    {
      message: 'La fecha de fin del tratamiento no puede ser anterior al inicio',
      path: ['fecha_fin'],
    }
  );

const estudioItemSchema = z
  .object({
    tipo_estudio: nonEmptyTrimmed('Tipo de estudio', 120),
    descripcion: nonEmptyTrimmed('Descripción del estudio', 2000),
  })
  .strict();

const antecedenteItemSchema = z
  .object({
    tipo: z.enum([
      'PERSONAL',
      'FAMILIAR',
      'QUIRURGICO',
      'PATOLOGICO',
      'GINECOLOGICO',
      'OTRO',
    ]),
    categoria: optionalTrimmed(100),
    descripcion: nonEmptyTrimmed('Descripción del antecedente', 2000),
    fecha_antecedente: dateSchema.optional(),
  })
  .strict();

const alergiaItemSchema = z
  .object({
    alergeno: nonEmptyTrimmed('Alérgeno', 150),
    tipo_reaccion: nonEmptyTrimmed('Tipo de reacción', 150),
    gravedad: z.enum(['LEVE', 'MODERADA', 'GRAVE', 'DESCONOCIDA']),
    observaciones: optionalTrimmed(2000),
    fecha_deteccion: dateSchema.optional().nullable(),
  })
  .strict();

const validateConsultaFechaAtencion = (
  data: {
    fecha_atencion?: string | undefined;
    firmar?: boolean | undefined;
    hasTurnoRef?: boolean | undefined;
  },
  ctx: z.RefinementCtx
) => {
  if (!data.fecha_atencion) {
    return;
  }

  const trimmed = data.fecha_atencion.trim();
  const isDateOnly = dateSchema.safeParse(trimmed).success;
  const parsedMs = isDateOnly ? Number.NaN : Date.parse(trimmed);
  const fechaActo = isDateOnly
    ? trimmed
    : agendaDateTime(new Date(parsedMs)).date;
  const today = agendaDateTime(new Date()).date;
  const isFutureInstant =
    fechaActo > today ||
    (!Number.isNaN(parsedMs) && parsedMs > Date.now() + 60_000);

  if (isFutureInstant) {
    if (data.firmar) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'No podés firmar ni cerrar definitivamente una consulta con fecha u hora del acto clínico futura.',
        path: ['fecha_atencion'],
      });
    } else if (!data.hasTurnoRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Una fecha u hora futura solo puede prepararse como borrador vinculado a un turno programado.',
        path: ['fecha_atencion'],
      });
    }
  }
};

export const registrarConsultaBodySchema = z
  .object({
    id_paciente: uuidSchema,
    id_salita: uuidSchema,
    id_especialidad: uuidSchema,
    id_turno: uuidSchema.optional().nullable(),
    acompanante_tutor_id: uuidSchema.optional().nullable(),
    fecha_atencion: dateTimeOrDateSchema.optional(),
    fecha_preparacion: dateTimeOrDateSchema.optional(),
    motivo_consulta: nonEmptyTrimmed('Motivo de consulta', 2000),
    sintomas: optionalTrimmed(4000),
    examen_fisico: optionalTrimmed(4000),
    observaciones: optionalTrimmed(4000),
    firmar: z.boolean().optional().default(false),
    motivo_acceso: z.string().trim().min(3).max(500).optional(),
    diagnosticos: z.array(diagnosticoItemSchema).max(50).optional(),
    evoluciones: z.array(evolucionItemSchema).max(20).optional(),
    tratamientos: z.array(tratamientoItemSchema).max(50).optional(),
    estudios: z.array(estudioItemSchema).max(50).optional(),
    antecedentes: z.array(antecedenteItemSchema).max(50).optional(),
    alergias: z.array(alergiaItemSchema).max(50).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    validateConsultaFechaAtencion(
      {
        fecha_atencion: data.fecha_atencion,
        firmar: data.firmar,
        hasTurnoRef: Boolean(data.id_turno),
      },
      ctx
    );
  });

export const actualizarConsultaBorradorBodySchema = z
  .object({
    id_paciente: uuidSchema.optional(),
    id_salita: uuidSchema,
    id_especialidad: uuidSchema.optional(),
    id_turno: uuidSchema.optional().nullable(),
    acompanante_tutor_id: uuidSchema.optional().nullable(),
    fecha_atencion: dateTimeOrDateSchema.optional(),
    fecha_preparacion: dateTimeOrDateSchema.optional(),
    motivo_consulta: nonEmptyTrimmed('Motivo de consulta', 2000),
    sintomas: optionalTrimmed(4000),
    examen_fisico: optionalTrimmed(4000),
    observaciones: optionalTrimmed(4000),
    firmar: z.boolean().optional().default(false),
    motivo_acceso: z.string().trim().min(3).max(500).optional(),
    diagnosticos: z.array(diagnosticoItemSchema).max(50).optional(),
    evoluciones: z.array(evolucionItemSchema).max(20).optional(),
    tratamientos: z.array(tratamientoItemSchema).max(50).optional(),
    estudios: z.array(estudioItemSchema).max(50).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    validateConsultaFechaAtencion(
      {
        fecha_atencion: data.fecha_atencion,
        firmar: data.firmar,
        hasTurnoRef: Boolean(data.id_turno),
      },
      ctx
    );
  });

export const borradorTemporalQuerySchema = z
  .object({
    id_paciente: uuidSchema,
    id_salita: uuidSchema,
    id_turno: uuidSchema.optional(),
  })
  .strict();

export const guardarBorradorTemporalBodySchema = z
  .object({
    id_paciente: uuidSchema,
    id_salita: uuidSchema,
    id_especialidad: uuidSchema.optional().nullable(),
    id_turno: uuidSchema.optional().nullable(),
    version_esperada: z.number().int().min(0).optional().nullable(),
    datos_formulario: z.record(z.string(), z.unknown()),
  })
  .strict()
  .superRefine((data, ctx) => {
    const serialized = JSON.stringify(data.datos_formulario);
    if (serialized.length > 120000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El borrador temporal supera el tamaño máximo permitido.',
        path: ['datos_formulario'],
      });
    }
  });

export const firmarConsultaBodySchema = z
  .object({
    id_salita: uuidSchema,
    id_paciente: uuidSchema.optional(),
    motivo_acceso: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export const anularConsultaBodySchema = z
  .object({
    id_salita: uuidSchema,
    motivo_anulacion: nonEmptyTrimmed('Motivo de anulación', 1000),
    id_paciente: uuidSchema.optional(),
  })
  .strict();

export const registrarEvolucionBodySchema = z
  .object({
    id_salita: uuidSchema,
    evolucion: nonEmptyTrimmed('Evolución clínica'),
    observaciones: optionalTrimmed(2000),
    id_paciente: uuidSchema.optional(),
    motivo_acceso: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export const rectificarEvolucionBodySchema = z
  .object({
    id_salita: uuidSchema,
    nueva_evolucion: nonEmptyTrimmed('Nueva evolución clínica'),
    observaciones: optionalTrimmed(2000),
    motivo_correccion: nonEmptyTrimmed('Motivo de corrección', 1000),
    id_paciente: uuidSchema.optional(),
  })
  .strict();

export const actualizarEstadoEstudioBodySchema = z
  .object({
    id_salita: uuidSchema,
    nuevo_estado: z.enum(['EN_PROCESO', 'CANCELADO']),
    motivo: z.string().trim().min(3).max(500).optional(),
    id_paciente: uuidSchema.optional(),
  })
  .strict();

export const informarEstudioBodySchema = z
  .object({
    id_salita: uuidSchema,
    resultado: nonEmptyTrimmed('Resultado del estudio'),
    id_paciente: uuidSchema.optional(),
    motivo_acceso: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export const listarDerivacionesQuerySchema = z
  .object({
    id_salita: uuidSchema,
    id_paciente: uuidSchema.optional(),
    estado: z
      .enum(['PENDIENTE', 'AUTORIZADA', 'RECHAZADA', 'REVOCADA', 'VENCIDA'])
      .optional(),
  })
  .strict();

export const solicitarDerivacionBodySchema = z
  .object({
    id_salita: uuidSchema,
    id_paciente: uuidSchema,
    id_salita_destino: uuidSchema,
    tipo: z.enum(['DERIVACION', 'AUTORIZACION_ACCESO']).optional().default('DERIVACION'),
    alcance: z.enum(['PROFESIONAL', 'ESPECIALIDAD', 'LONGITUDINAL']).optional(),
    id_profesional_destino: uuidSchema.optional().nullable(),
    id_especialidad_destino: uuidSchema.optional().nullable(),
    motivo: z.string().trim().min(5, 'El motivo debe tener al menos 5 caracteres').max(2000),
    fecha_desde: dateSchema.optional(),
    fecha_hasta: dateSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.id_salita === data.id_salita_destino) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La salita de destino debe ser distinta a la salita de origen',
        path: ['id_salita_destino'],
      });
    }

    if (data.fecha_desde && data.fecha_hasta < data.fecha_desde) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La fecha_hasta debe ser mayor o igual a fecha_desde',
        path: ['fecha_hasta'],
      });
    }

    const alcanceEfectivo =
      data.alcance ??
      (data.tipo === 'AUTORIZACION_ACCESO' ? 'LONGITUDINAL' : 'ESPECIALIDAD');

    if (alcanceEfectivo === 'PROFESIONAL' && !data.id_profesional_destino) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe indicar id_profesional_destino para alcance PROFESIONAL',
        path: ['id_profesional_destino'],
      });
    }

    if (alcanceEfectivo === 'ESPECIALIDAD' && !data.id_especialidad_destino) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe indicar id_especialidad_destino para alcance ESPECIALIDAD',
        path: ['id_especialidad_destino'],
      });
    }

    if (alcanceEfectivo === 'LONGITUDINAL') {
      if (data.tipo !== 'AUTORIZACION_ACCESO') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'El alcance LONGITUDINAL solo aplica a AUTORIZACION_ACCESO',
          path: ['alcance'],
        });
      }
      if (!data.id_profesional_destino || data.id_especialidad_destino) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'El alcance LONGITUDINAL requiere id_profesional_destino y no admite id_especialidad_destino',
          path: ['id_profesional_destino'],
        });
      }
    }
  });

export const resolverDerivacionBodySchema = z
  .object({
    id_salita: uuidSchema,
    nuevo_estado: z.enum(['AUTORIZADA', 'RECHAZADA', 'REVOCADA']),
    motivo: z.string().trim().max(2000).optional().nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      (data.nuevo_estado === 'RECHAZADA' || data.nuevo_estado === 'REVOCADA') &&
      (!data.motivo || data.motivo.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Debe indicar el motivo para ${data.nuevo_estado.toLowerCase()}`,
        path: ['motivo'],
      });
    }
  });

export const consultarAuditoriaClinicaQuerySchema = z
  .object({
    id_salita: uuidSchema.optional(),
    id_paciente: uuidSchema.optional(),
    fecha_desde: dateTimeOrDateSchema.optional(),
    fecha_hasta: dateTimeOrDateSchema.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.fecha_desde && data.fecha_hasta) {
      const desdeRaw = dateSchema.safeParse(data.fecha_desde).success
        ? `${data.fecha_desde}T00:00:00.000-03:00`
        : data.fecha_desde;
      const hastaRaw = dateSchema.safeParse(data.fecha_hasta).success
        ? `${data.fecha_hasta}T23:59:59.999-03:00`
        : data.fecha_hasta;
      const desdeMs = Date.parse(desdeRaw);
      const hastaMs = Date.parse(hastaRaw);
      if (!Number.isNaN(desdeMs) && !Number.isNaN(hastaMs) && desdeMs > hastaMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'fecha_desde no puede ser posterior a fecha_hasta',
          path: ['fecha_desde'],
        });
      }
    }
  });

export type ConsultarHistoriaClinicaQuery = z.infer<
  typeof consultarHistoriaClinicaQuerySchema
>;
export type ConsultarAntecedentesQuery = z.infer<
  typeof consultarAntecedentesQuerySchema
>;
export type ConsultarAlergiasQuery = z.infer<typeof consultarAlergiasQuerySchema>;
export type ConsultarConsultaQuery = z.infer<typeof consultarConsultaQuerySchema>;
export type RegistrarConsultaBody = z.infer<typeof registrarConsultaBodySchema>;
export type ActualizarConsultaBorradorBody = z.infer<
  typeof actualizarConsultaBorradorBodySchema
>;
export type FirmarConsultaBody = z.infer<typeof firmarConsultaBodySchema>;
export type AnularConsultaBody = z.infer<typeof anularConsultaBodySchema>;
export type RegistrarEvolucionBody = z.infer<typeof registrarEvolucionBodySchema>;
export type RectificarEvolucionBody = z.infer<
  typeof rectificarEvolucionBodySchema
>;
export type ActualizarEstadoEstudioBody = z.infer<
  typeof actualizarEstadoEstudioBodySchema
>;
export type InformarEstudioBody = z.infer<typeof informarEstudioBodySchema>;
export type ListarDerivacionesQuery = z.infer<
  typeof listarDerivacionesQuerySchema
>;
export type SolicitarDerivacionBody = z.infer<
  typeof solicitarDerivacionBodySchema
>;
export type ResolverDerivacionBody = z.infer<typeof resolverDerivacionBodySchema>;
export type BorradorTemporalQuery = z.infer<typeof borradorTemporalQuerySchema>;
export type GuardarBorradorTemporalBody = z.infer<
  typeof guardarBorradorTemporalBodySchema
>;
export type ConsultarAuditoriaClinicaQuery = z.infer<
  typeof consultarAuditoriaClinicaQuerySchema
>;
