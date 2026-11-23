import { z } from 'zod';

// Crea un esquema para texto plano.
// Rechaza HTML y caracteres Unicode de control o formato.
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) =>
        !/[<>\p{Cc}\p{Cf}]/u.test(
          value.replace(/\r?\n/g, '')
        ),
      'Usá texto sin HTML ni caracteres de control.'
    );

// Identificador único de una noticia.
export const newsId =
  z.uuid();

// Filtros disponibles para consultar noticias.
export const newsQuery =
  z.object({
    page:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(10000)
        .default(1),

    limit:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(30)
        .default(9),

    destacada:
      z
        .enum([
          'true',
          'false',
        ])
        .optional(),

    avisos:
      z
        .enum([
          'true',
          'false',
        ])
        .optional(),
  });

// Valida los datos utilizados para crear o editar una noticia.
export const newsInput =
  z
    .object({
      titulo:
        text(160),

      resumen:
        text(300),

      contenido:
        text(20000),

      imagen_url:
        z
          .url()
          .max(2048)
          .refine(
            (value) => {
              const url =
                new URL(
                  value
                );

              return (
                url.protocol ===
                  'https:' &&
                !url.username &&
                !url.password
              );
            },
            'La imagen debe usar una URL HTTPS sin credenciales.'
          )
          .nullable(),

      id_salita:
        z
          .uuid()
          .nullable(),

      id_categoria:
        z.uuid(),

      destacada:
        z.boolean(),

      estado:
        z.enum([
          'BORRADOR',
          'PUBLICADA',
          'ARCHIVADA',
        ]),

      fecha_publicacion:
        z
          .iso
          .datetime({
            offset: true,
          })
          .nullable(),

      fecha_finalizacion:
        z
          .iso
          .datetime({
            offset: true,
          })
          .nullable(),
    })
    .strict()
    .refine(
      (value) =>
        !value.fecha_finalizacion ||
        Date.parse(
          value.fecha_finalizacion
        ) >
          Date.parse(
            value.fecha_publicacion ??
              new Date().toISOString()
          ),
      {
        message:
          'La finalización debe ser posterior a la publicación.',
        path: [
          'fecha_finalizacion',
        ],
      }
    );

// Tipos inferidos directamente desde los esquemas de validación.
export type NewsInput =
  z.infer<typeof newsInput>;

export type NewsQuery =
  z.infer<typeof newsQuery>;