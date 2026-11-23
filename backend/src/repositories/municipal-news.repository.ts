import {
  XMLParser,
  XMLValidator,
} from 'fast-xml-parser';

import {
  z,
} from 'zod';

// Fuente RSS institucional del Municipio de Goya.
export const municipalSource =
  'https://www.goya.gob.ar/?q=rss.xml';

// Valida la estructura mínima de cada noticia obtenida del feed.
const itemSchema =
  z.object({
    title:
      z
        .string()
        .min(1)
        .max(500),

    link:
      z.url(),

    pubDate:
      z.string(),
  });

export interface MunicipalNews {
  titulo: string;
  enlace: string;
  fecha: string;
}

// Consume exclusivamente el RSS institucional,
// sin depender del HTML del portal.
export const fetchMunicipalNews =
  async (): Promise<
    MunicipalNews[]
  > => {
    const response =
      await fetch(
        municipalSource,
        {
          signal:
            AbortSignal.timeout(
              8000
            ),
          redirect:
            'error',
          headers: {
            Accept:
              'application/rss+xml',
          },
        }
      );

    // Verifica que la fuente responda correctamente.
    if (
      !response.ok ||
      !response.body
    ) {
      throw new Error(
        'Fuente municipal no disponible'
      );
    }

    const reader =
      response.body.getReader();

    const chunks:
      Uint8Array[] = [];

    let size = 0;

    try {
      // Lee el feed por bloques y limita su tamaño máximo.
      while (true) {
        const part =
          await reader.read();

        if (part.done) {
          break;
        }

        size +=
          part.value.length;

        if (
          size >
          1_000_000
        ) {
          throw new Error(
            'Feed demasiado grande'
          );
        }

        chunks.push(
          part.value
        );
      }
    } finally {
      await reader.cancel();
    }

    const xml =
      Buffer.concat(
        chunks
      ).toString(
        'utf8'
      );

    // Rechaza declaraciones potencialmente inseguras
    // y verifica que el XML sea válido.
    if (
      /<!DOCTYPE|<!ENTITY/i.test(
        xml
      ) ||
      XMLValidator.validate(
        xml
      ) !== true
    ) {
      throw new Error(
        'Feed inválido'
      );
    }

    // Convierte el XML a una estructura procesable.
    const parsed: unknown =
      new XMLParser({
        parseTagValue:
          false,
        isArray:
          (name) =>
            name ===
            'item',
      }).parse(
        xml
      );

    // Valida la estructura general esperada del RSS.
    const feed =
      z
        .object({
          rss:
            z.object({
              channel:
                z.object({
                  item:
                    z
                      .array(
                        z.unknown()
                      )
                      .optional(),
                }),
            }),
        })
        .parse(
          parsed
        );

    // Valida y normaliza individualmente las noticias.
    return (
      feed.rss.channel
        .item ?? []
    )
      .flatMap(
        (item) => {
          const result =
            itemSchema.safeParse(
              item
            );

          if (
            !result.success
          ) {
            return [];
          }

          const {
            title,
            link,
            pubDate,
          } =
            result.data;

          const url =
            new URL(
              link
            );

          const date =
            Date.parse(
              pubDate
            );

          // Solo acepta enlaces HTTPS pertenecientes al dominio municipal.
          if (
            url.protocol !==
              'https:' ||
            ![
              'www.goya.gob.ar',
              'goya.gob.ar',
            ].includes(
              url.hostname
            ) ||
            url.username ||
            url.password ||
            !Number.isFinite(
              date
            )
          ) {
            return [];
          }

          return [
            {
              titulo:
                title,
              enlace:
                url.href,
              fecha:
                new Date(
                  date
                ).toISOString(),
            },
          ];
        }
      )
      .slice(
        0,
        6
      );
  };