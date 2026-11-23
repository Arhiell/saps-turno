import api from './api';
import type { Cierre, CierreInput, SyncStatus, SyncResult } from '../types/cierre-calendario.types';
export const getCierres = async () => (await api.get<Cierre[]>('/cierres-calendario')).data;
export const guardarCierre = async (datos: CierreInput, id?: string) => id
  ? (await api.put<Cierre>(`/cierres-calendario/${id}`, datos)).data
  : (await api.post<Cierre>('/cierres-calendario', datos)).data;
export const desactivarCierre = async (id: string) => (await api.delete<Cierre>(`/cierres-calendario/${id}`)).data;
export const getCalendarioSync = async () => (await api.get<SyncStatus>('/cierres-calendario/sincronizacion')).data;
export const sincronizarFeriados = async () => (await api.post<SyncResult>('/cierres-calendario/sincronizacion', {}, { timeout: 120_000 })).data;
