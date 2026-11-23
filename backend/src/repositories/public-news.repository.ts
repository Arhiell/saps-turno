import {
  supabase,
} from '../config/supabase.js';

import type {
  NewsInput,
  NewsQuery,
} from '../validators/public-news.validator.js';

import type {
  AdminNews,
  PublicNews,
} from '../types/public-news.types.js';

// Selección pública explícita.
// Nunca incluye cuentas ni datos de auditoría.
const publicSelect = `
  id_noticia,
  titulo,
  resumen,
  contenido,
  imagen_url,
  fecha_publicacion,
  fecha_finalizacion,
  destacada,
  categoria:categorias_publicas!inner(
    id_categoria,
    nombre,
    es_aviso
  ),
  salita:salitas(
    id_salita,
    nombre
  )
`;

// La vista administrativa agrega los datos necesarios para la gestión.
const adminSelect = `
  ${publicSelect},
  id_autor,
  id_salita,
  id_categoria,
  estado,
  fecha_actualizacion
`;

// Obtiene las categorías públicas activas.
export const categories =
  async () => {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          'categorias_publicas'
        )
        .select(
          'id_categoria,nombre,es_aviso'
        )
        .eq(
          'activo',
          true
        )
        .order(
          'nombre'
        );

    if (error) {
      throw error;
    }

    return data ?? [];
  };

// Obtiene noticias públicas o administrativas según el alcance recibido.
export const listNews =
  async (
    filters: NewsQuery,
    scope?: string[] | null,
    author?: string
  ) => {
    let query =
      supabase
        .from(
          'noticias_publicas'
        )
        .select(
          scope === undefined
            ? publicSelect
            : adminSelect,
          {
            count:
              'exact',
          }
        );

    if (
      scope === undefined
    ) {
      const now =
        new Date().toISOString();

      // Oculta borradores, publicaciones futuras y noticias vencidas.
      query =
        query
          .eq(
            'estado',
            'PUBLICADA'
          )
          .lte(
            'fecha_publicacion',
            now
          )
          .or(
            `fecha_finalizacion.is.null,fecha_finalizacion.gt.${now}`
          );
    } else if (
      scope !== null
    ) {
      // Sin salitas autorizadas no existen resultados administrativos.
      if (!scope.length) {
        return {
          items: [],
          total: 0,
        };
      }

      query =
        query
          .in(
            'id_salita',
            scope
          )
          .eq(
            'id_autor',
            author!
          );
    }

    // Aplica los filtros opcionales.
    if (
      filters.destacada
    ) {
      query =
        query.eq(
          'destacada',
          filters.destacada ===
            'true'
        );
    }

    if (
      filters.avisos
    ) {
      query =
        query.eq(
          'categoria.es_aviso',
          filters.avisos ===
            'true'
        );
    }

    const start =
      (
        filters.page -
        1
      ) *
      filters.limit;

    const {
      data,
      count,
      error,
    } =
      await query
        .order(
          'destacada',
          {
            ascending:
              false,
          }
        )
        .order(
          'fecha_publicacion',
          {
            ascending:
              false,
            nullsFirst:
              false,
          }
        )
        .order(
          'id_noticia'
        )
        .range(
          start,
          start +
            filters.limit -
            1
        )
        .returns<
          (
            | PublicNews
            | AdminNews
          )[]
        >();

    if (error) {
      throw error;
    }

    return {
      items:
        data ?? [],
      total:
        count ?? 0,
    };
  };

// Obtiene el detalle administrativo de una noticia.
export async function findNews(
  id: string,
  admin: true
): Promise<AdminNews | null>;

// Obtiene el detalle público de una noticia.
export async function findNews(
  id: string,
  admin?: false
): Promise<PublicNews | null>;

// Busca una noticia aplicando las restricciones públicas cuando corresponde.
export async function findNews(
  id: string,
  admin = false
): Promise<
  | PublicNews
  | AdminNews
  | null
> {
  let query =
    supabase
      .from(
        'noticias_publicas'
      )
      .select(
        admin
          ? adminSelect
          : publicSelect
      )
      .eq(
        'id_noticia',
        id
      );

  if (!admin) {
    const now =
      new Date().toISOString();

    // La consulta pública solo permite publicaciones vigentes.
    query =
      query
        .eq(
          'estado',
          'PUBLICADA'
        )
        .lte(
          'fecha_publicacion',
          now
        )
        .or(
          `fecha_finalizacion.is.null,fecha_finalizacion.gt.${now}`
        );
  }

  const {
    data,
    error,
  } =
    await query
      .returns<
        (
          | PublicNews
          | AdminNews
        )[]
      >()
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

// La RPC guarda la noticia y su auditoría
// dentro de una única transacción.
export const saveNews =
  async (
    actor: string,
    id: string | null,
    input: NewsInput
  ) => {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'guardar_noticia_publica',
        {
          actor,
          noticia_id:
            id,
          datos:
            input,
        }
      );

    if (error) {
      throw error;
    }

    return data as string;
  };