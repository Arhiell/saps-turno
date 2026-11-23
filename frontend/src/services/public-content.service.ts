import publicApi from './auth-api';

import api from './api';

import type { 
  AdminNews, 
  MunicipalResult, 
  NewsCategory, 
  NewsInput, 
  NewsList, 
  PublicNews, 
  PublicSalita 
} from '../types/public-content.types';

// Las consultas públicas no adjuntan tokens ni intentan renovar sesiones.

// Obtiene las noticias públicas con paginación y filtros opcionales.
export const getPublicNews = async (
  page = 1,
  filters: {
    destacada?: boolean;
    avisos?: boolean;
  } = {}
) =>
  (
    await publicApi.get<NewsList>('/public/noticias', {
      params: { page, limit: 6, ...filters },
      timeout: 12000,
    })
  ).data;

// Obtiene el detalle de una noticia pública.
export const getPublicNewsDetail = async (id: string) =>
  (
    await publicApi.get<PublicNews>(`/public/noticias/${id}`, {
      timeout: 12000,
    })
  ).data;

// Obtiene las salitas disponibles para la vista pública.
export const getPublicSalitas = async () =>
  (
    await publicApi.get<{ data: PublicSalita[] }>('/salitas', {
      params: { vista: 'publica' },
      timeout: 12000,
    })
  ).data.data;

// Obtiene las noticias institucionales del municipio.
export const getMunicipalNews = async () =>
  (
    await publicApi.get<MunicipalResult>('/public/noticias-municipales', {
      timeout: 12000,
    })
  ).data;

// Obtiene las categorías disponibles para las noticias.
export const getNewsCategories = async () =>
  (await api.get<NewsCategory[]>('/contenido/categorias')).data;

// Obtiene las noticias disponibles dentro del alcance administrativo.
export const getAdminNews = async (page = 1) =>
  (
    await api.get<NewsList<AdminNews>>('/contenido/noticias', {
      params: { page, limit: 9 },
    })
  ).data;

// Obtiene una noticia específica para su edición.
export const getAdminNewsDetail = async (id: string) =>
  (await api.get<AdminNews>(`/contenido/noticias/${id}`)).data;

// Crea una nueva noticia o actualiza una existente.
export const saveNews = async (
  id: string | undefined,
  input: NewsInput
) => {
  if (id) {
    return (
      await api.put<{ id_noticia: string }>(
        `/contenido/noticias/${id}`,
        input
      )
    ).data;
  }

  return (
    await api.post<{ id_noticia: string }>('/contenido/noticias', input)
  ).data;
};