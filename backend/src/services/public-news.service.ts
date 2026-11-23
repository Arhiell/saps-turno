import type {
  AuthenticatedUser,
} from '../types/auth.types.js';

import type {
  NewsInput,
  NewsQuery,
} from '../validators/public-news.validator.js';

import * as repo from '../repositories/public-news.repository.js';

import {
  findActiveSalitaById,
} from '../repositories/user.repository.js';

import {
  getTurnoScope,
} from './turno-access.service.js';

import {
  newsScheduleError,
} from '../validators/news-schedule.js';

import {
  AppError,
} from '../utils/app-error.js';

// Obtiene el listado de noticias públicas.
export const publicNews = (
  filters: NewsQuery
) =>
  repo.listNews(
    filters
  );

// Obtiene el detalle de una noticia pública.
export const publicNewsDetail =
  async (
    id: string
  ) => {
    const news =
      await repo.findNews(
        id
      );

    if (!news) {
      throw new AppError(
        'La noticia no está disponible.',
        404
      );
    }

    return news;
  };

// Obtiene las categorías disponibles para las noticias.
export const newsOptions = () =>
  repo.categories();

// Obtiene las noticias disponibles para administración.
export const adminNews =
  async (
    user: AuthenticatedUser,
    filters: NewsQuery
  ) => {
    const scope =
      await getTurnoScope(
        user
      );

    return repo.listNews(
      filters,
      scope,
      user.id_usuario
    );
  };

// Obtiene el detalle administrativo de una noticia.
export const adminNewsDetail =
  async (
    user: AuthenticatedUser,
    id: string
  ) => {
    const scope =
      await getTurnoScope(
        user
      );

    const news =
      await repo.findNews(
        id,
        true
      );

    // Verifica existencia, alcance por salita y autoría.
    if (
      !news ||
      (
        scope !== null &&
        (
          !scope.includes(
            String(
              news.id_salita
            )
          ) ||
          news.id_autor !==
            user.id_usuario
        )
      )
    ) {
      throw new AppError(
        'La noticia no existe o no tenés permisos para editarla.',
        404
      );
    }

    return news;
  };

// Crea una noticia nueva o actualiza una existente.
export const saveNews =
  async (
    user: AuthenticatedUser,
    id: string | null,
    input: NewsInput
  ) => {
    const scope =
      await getTurnoScope(
        user
      );

    // Al editar, recupera la versión actual para validar los cambios.
    const previous =
      id
        ? await adminNewsDetail(
            user,
            id
          )
        : null;

    // Limita al administrador a sus salitas vigentes.
    if (
      scope !== null &&
      (
        !input.id_salita ||
        !scope.includes(
          input.id_salita
        )
      )
    ) {
      throw new AppError(
        'Elegí una de tus salitas asignadas.',
        403
      );
    }

    // Verifica que la salita seleccionada continúe activa.
    if (
      input.id_salita &&
      !await findActiveSalitaById(
        input.id_salita
      )
    ) {
      throw new AppError(
        'La salita no está activa.',
        400
      );
    }

    // Verifica que la categoría seleccionada esté disponible.
    const categories =
      await repo.categories();

    const validCategory =
      categories.some(
        (category) =>
          category.id_categoria ===
          input.id_categoria
      );

    if (!validCategory) {
      throw new AppError(
        'La categoría no está disponible.',
        400
      );
    }

    const now =
      Date.now();

    // Valida las fechas y reglas de programación de la noticia.
    const scheduleError =
      newsScheduleError(
        input,
        previous,
        now
      );

    if (scheduleError) {
      throw new AppError(
        scheduleError,
        400
      );
    }

    // Si se publica sin fecha explícita, utiliza el momento actual.
    const fecha_publicacion =
      input.estado ===
      'PUBLICADA'
        ? input.fecha_publicacion ??
          new Date(
            now
          ).toISOString()
        : input.fecha_publicacion;

    return repo.saveNews(
      user.id_usuario,
      id,
      {
        ...input,
        fecha_publicacion,
      }
    );
  };