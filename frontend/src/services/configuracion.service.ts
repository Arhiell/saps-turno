import api from './api';
import { getAdminSalitas } from './salitas.service';

import type {
  Bloqueo,
  BloqueoInput,
  CatalogoInput,
  CatalogoRegistro,
  CatalogoTipo,
  Cobertura,
  Horario,
  HorarioInput,
  Parametro,
  Zona,
} from '../types/configuracion.types';

// Relaciona cada catálogo con el nombre de su campo identificador.
const ids = {
  zonas: 'id_zona',
  barrios: 'id_barrio',
  especialidades: 'id_especialidad',
} as const;

// ========================================
// ZONAS
// ========================================

// Obtiene todas las zonas.
export const getZonas = async () =>
  (
    await api.get<{ data: Zona[] }>(
      '/zonas'
    )
  ).data.data;

// ========================================
// CATÁLOGOS
// ========================================

const catalogoCache = new Map<CatalogoTipo, { data: CatalogoRegistro[]; timestamp: number }>();
const catalogoInflight = new Map<CatalogoTipo, Promise<CatalogoRegistro[]>>();

export const clearCatalogoCache = (tipo?: CatalogoTipo) => {
  if (tipo) {
    catalogoCache.delete(tipo);
    catalogoInflight.delete(tipo);
  } else {
    catalogoCache.clear();
    catalogoInflight.clear();
  }
};

// Obtiene zonas, barrios o especialidades según el tipo indicado con caché en memoria.
export const getCatalogo = async (
  tipo: CatalogoTipo,
  forceRefresh = false
): Promise<CatalogoRegistro[]> => {
  const now = Date.now();
  const cached = catalogoCache.get(tipo);
  if (!forceRefresh && cached && now - cached.timestamp < 10 * 60 * 1000) {
    return cached.data;
  }

  const inflight = catalogoInflight.get(tipo);
  if (!forceRefresh && inflight) {
    return inflight;
  }

  const promise = api
    .get<{
      data: (CatalogoInput & Record<string, unknown>)[];
    }>(`/${tipo}`)
    .then((response) => {
      const result = response.data.data.map((row) => ({
        ...row,
        id: String(row[ids[tipo]]),
      }));
      catalogoCache.set(tipo, { data: result, timestamp: Date.now() });
      catalogoInflight.delete(tipo);
      return result;
    })
    .catch((err) => {
      catalogoInflight.delete(tipo);
      throw err;
    });

  catalogoInflight.set(tipo, promise);
  return promise;
};

// Crea o actualiza un registro de catálogo.
export const guardarCatalogo = async (
  tipo: CatalogoTipo,
  input: CatalogoInput,
  id?: string
) => {
  clearCatalogoCache(tipo);
  if (id) {
    const response = await api.put<{ data: CatalogoInput & Record<string, unknown> }>(
      `/${tipo}/${id}`,
      input
    );
    return response.data.data;
  } else {
    const response = await api.post<{ data: CatalogoInput & Record<string, unknown> }>(
      `/${tipo}`,
      input
    );
    return response.data.data;
  }
};

// ========================================
// COBERTURA DE SALITAS
// ========================================

// Obtiene las relaciones entre salitas y barrios.
export const getCoberturas = async () =>
  (
    await api.get<{ data: Cobertura[] }>(
      '/salita-barrios'
    )
  ).data.data;

// Crea o actualiza la cobertura de una salita.
export const guardarCobertura = async (
  input: Cobertura,
  editing: boolean
) => {
  if (editing) {
    const {
      id_salita,
      id_barrio,
      ...data
    } = input;

    await api.put(
      `/salita-barrios/${id_salita}/${id_barrio}`,
      data
    );
  } else {
    await api.post(
      '/salita-barrios',
      input
    );
  }
};

// ========================================
// HORARIOS DE ATENCIÓN
// ========================================

// Obtiene todos los horarios de atención.
export const getHorarios = async () =>
  (
    await api.get<Horario[]>(
      '/horarios-atencion'
    )
  ).data;

// Crea o actualiza un horario de atención.
export const guardarHorario = async (
  input: HorarioInput,
  id?: string
) => {
  if (id) {
    await api.put(
      `/horarios-atencion/${id}`,
      input
    );
  } else {
    await api.post(
      '/horarios-atencion',
      input
    );
  }
};

// ========================================
// BLOQUEOS DE AGENDA
// ========================================

// Obtiene los bloqueos registrados en la agenda.
export const getBloqueos = async () =>
  (
    await api.get<Bloqueo[]>(
      '/bloqueos-agenda'
    )
  ).data;

// Crea o actualiza un bloqueo de agenda.
export const guardarBloqueo = async (
  input: BloqueoInput,
  id?: string
) => {
  if (id) {
    await api.put(
      `/bloqueos-agenda/${id}`,
      input
    );
  } else {
    await api.post(
      '/bloqueos-agenda',
      input
    );
  }
};

// ========================================
// PARÁMETROS DEL SISTEMA
// ========================================

// Obtiene los parámetros visibles para el usuario actual.
export const getParametros = async () =>
  (
    await api.get<{
      configuraciones: Parametro[];
    }>('/configuracion')
  ).data.configuraciones;

// Obtiene las salitas que el usuario puede configurar.
export const getSalitasConfigurables = async (
  superAdmin: boolean
) => {
  const { data } = await getAdminSalitas();

  return superAdmin
    ? data
    : data.filter((salita) => salita.activo);
};

// Crea o actualiza un parámetro del sistema.
export const guardarParametro = async (
  input: Omit<
    Parametro,
    'id_configuracion'
  >,
  id?: string,
  superAdmin = false
) => {
  if (id) {
    await api.patch(
      `/configuracion/${id}`,
      {
        valor: input.valor,
        descripcion: input.descripcion,

        // Solo SUPER_ADMIN puede modificar
        // la visibilidad pública.
        ...(superAdmin
          ? {
              es_publica: input.es_publica,
            }
          : {}),
      }
    );
  } else {
    await api.post(
      '/configuracion',
      input
    );
  }
};
