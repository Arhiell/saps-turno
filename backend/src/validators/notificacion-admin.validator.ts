import {
  z,
} from 'zod';

// Valida identificadores UUID.
const uuid =
  z.string().uuid();

// Define los criterios permitidos para seleccionar una audiencia.
export const audienciaSchema =
  z
    .object({
      tipo: z.enum([
        'USUARIOS',
        'PACIENTES',
        'PROFESIONALES',
        'ADMINISTRADORES',
        'ROL',
      ]),

      id_salita:
        uuid.optional(),

      id_especialidad:
        uuid.optional(),

      id_usuario:
        uuid.optional(),

      rol: z
        .enum([
          'SUPER_ADMIN',
          'ADMIN_SALITA',
          'RECEPCION',
          'PROFESIONAL',
          'PACIENTE',
        ])
        .optional(),
    })
    .strict()
    .superRefine(
      (
        value,
        ctx
      ) => {
        // El rol solo puede utilizarse con una audiencia de tipo ROL.
        if (
          (
            value.tipo ===
            'ROL'
          ) !==
          !!value.rol
        ) {
          ctx.addIssue({
            code: 'custom',
            message:
              'Seleccioná un rol únicamente para la audiencia por rol.',
          });
        }

        // La especialidad solo puede aplicarse a profesionales.
        if (
          value.id_especialidad &&
          value.tipo !==
            'PROFESIONALES'
        ) {
          ctx.addIssue({
            code: 'custom',
            message:
              'La especialidad corresponde solamente a profesionales.',
          });
        }
      }
    );

// Acepta texto español y puntuación común;
// rechaza HTML, emojis y caracteres de control.
const titulo =
  z
    .string()
    .trim()
    .min(3)
    .max(160)
    .regex(
      /^[\p{L}\p{N} .,;:¿?¡!()'"\-]+$/u,
      'El asunto contiene caracteres no permitidos.'
    );

// Normaliza los saltos de línea y valida el contenido del mensaje.
const mensaje =
  z
    .string()
    .transform(
      (value) =>
        value
          .replace(
            /\r\n/g,
            '\n'
          )
          .trim()
    )
    .pipe(
      z
        .string()
        .min(3)
        .max(2000)
        .regex(
          /^[\p{L}\p{N} .,;:¿?¡!()'"\-\n/@%+ºª°€$&=]+$/u,
          'El mensaje contiene caracteres no permitidos.'
        )
    );

// Valida la solicitud de vista previa de una audiencia.
export const previewNotificacionSchema =
  z
    .object({
      audiencia:
        audienciaSchema,
    })
    .strict();

// Valida la búsqueda de destinatarios.
export const buscarDestinatariosSchema =
  z
    .object({
      audiencia:
        audienciaSchema,

      buscar: z
        .string()
        .trim()
        .min(2)
        .max(100),
    })
    .strict();

// Valida la creación de un envío de notificación.
export const crearEnvioSchema =
  z
    .object({
      audiencia:
        audienciaSchema,

      titulo,

      mensaje,

      email:
        z.boolean(),

      fecha_programada:
        z
          .string()
          .datetime({
            offset: true,
          })
          .nullable(),

      confirmacion:
        z
          .string()
          .regex(
            /^[a-f0-9]{32}$/
          ),

      clave:
        uuid,
    })
    .strict();

// Valida los parámetros utilizados para consultar el historial.
export const historialEnviosSchema =
  z.object({
    page: z
      .coerce
      .number()
      .int()
      .min(1)
      .default(1),

    limit: z
      .coerce
      .number()
      .int()
      .min(1)
      .max(5)
      .default(5),

    programadas:
      z
        .enum([
          'true',
          'false',
        ])
        .default(
          'false'
        ),
  });

// Valida la edición de una notificación programada.
export const editarEnvioSchema =
  crearEnvioSchema
    .extend({
      fecha_programada:
        z
          .string()
          .datetime({
            offset: true,
          }),

      // Conserva los datos originales para detectar modificaciones concurrentes.
      original:
        crearEnvioSchema.pick({
          audiencia: true,
          titulo: true,
          mensaje: true,
          email: true,
          fecha_programada:
            true,
        }),
    })
    .strict();

// Tipo utilizado para editar una programación.
export type EditarEnvio =
  z.infer<
    typeof editarEnvioSchema
  >;

// Tipo utilizado para definir una audiencia.
export type Audiencia =
  z.infer<
    typeof audienciaSchema
  >;

// Tipo utilizado para crear un envío.
export type CrearEnvio =
  z.infer<
    typeof crearEnvioSchema
  >;