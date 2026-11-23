import api from './api';

import type {
  CreateSalitaRequest,
  SalitaResponse,
  SalitasResponse,
  UpdateSalitaRequest,
} from '../types/salita.types';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

let adminSalitasCache: { data: SalitasResponse; timestamp: number } | null = null;
let adminSalitasInflight: Promise<SalitasResponse> | null = null;

let salitasCache: { data: SalitasResponse; timestamp: number } | null = null;
let salitasInflight: Promise<SalitasResponse> | null = null;

export const clearSalitasCache = () => {
  adminSalitasCache = null;
  adminSalitasInflight = null;
  salitasCache = null;
  salitasInflight = null;
};

export const getSalitas = async (forceRefresh = false): Promise<SalitasResponse> => {
  const now = Date.now();
  if (!forceRefresh && salitasCache && now - salitasCache.timestamp < CACHE_TTL_MS) {
    return salitasCache.data;
  }

  if (!forceRefresh && salitasInflight) {
    return salitasInflight;
  }

  salitasInflight = api
    .get<SalitasResponse>('/salitas')
    .then((response) => {
      salitasCache = { data: response.data, timestamp: Date.now() };
      salitasInflight = null;
      return response.data;
    })
    .catch((error) => {
      salitasInflight = null;
      throw error;
    });

  return salitasInflight;
};

export const getAdminSalitas = async (forceRefresh = false): Promise<SalitasResponse> => {
  const now = Date.now();
  if (!forceRefresh && adminSalitasCache && now - adminSalitasCache.timestamp < CACHE_TTL_MS) {
    return adminSalitasCache.data;
  }

  if (!forceRefresh && adminSalitasInflight) {
    return adminSalitasInflight;
  }

  adminSalitasInflight = api
    .get<SalitasResponse>('/salitas/admin')
    .then((response) => {
      adminSalitasCache = { data: response.data, timestamp: Date.now() };
      adminSalitasInflight = null;
      return response.data;
    })
    .catch((error) => {
      adminSalitasInflight = null;
      throw error;
    });

  return adminSalitasInflight;
};

export const getSalitaById = async (
  id: string,
): Promise<SalitaResponse> => {
  const response = await api.get<SalitaResponse>(
    `/salitas/${id}`,
  );

  return response.data;
};

export const createSalita = async (
  data: CreateSalitaRequest,
): Promise<SalitaResponse> => {
  const response = await api.post<SalitaResponse>(
    '/salitas',
    data,
  );

  clearSalitasCache();
  return response.data;
};

export const updateSalita = async (
  id: string,
  data: UpdateSalitaRequest,
): Promise<SalitaResponse> => {
  const response = await api.put<SalitaResponse>(
    `/salitas/${id}`,
    data,
  );

  clearSalitasCache();
  return response.data;
};

export const deleteSalita = async (
  id: string,
): Promise<SalitaResponse> => {
  const response = await api.delete<SalitaResponse>(
    `/salitas/${id}`,
  );

  clearSalitasCache();
  return response.data;
};
