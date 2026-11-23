import api from './api';

import type {
  AppointmentHistory,
  ChangeTurnoStatusRequest,
  CreateTurnoRequest,
  DisponibilidadResponse,
  TurnoResponse,
  TurnosFilters,
  TurnosResponse,
  UpdateTurnoRequest,
} from '../types/turno.types';

const TURNOS_CACHE_TTL_MS = 10_000; // 10 segundos de retención para transiciones suaves
const turnosCache = new Map<string, { data: TurnosResponse; timestamp: number }>();
const turnosInflight = new Map<string, Promise<TurnosResponse>>();

export const clearTurnosCache = () => {
  turnosCache.clear();
  turnosInflight.clear();
};

// Obtiene el historial de cambios de un turno.
export const getTurnoHistory = async (
  id: string
) =>
  (
    await api.get<{ historial: AppointmentHistory[] }>(
      `/turnos/${id}/historial`
    )
  ).data.historial;

// Permite al paciente solicitar su propio turno.
export const createOwnTurno = async (
  data: { id_paciente?: string } & Omit<
    CreateTurnoRequest,
    'id_paciente' | 'observaciones'
  >
) => {
  clearTurnosCache();
  return (
    await api.post<TurnoResponse>(
      '/turnos',
      data
    )
  ).data;
};

// Obtiene los turnos aplicando los filtros indicados con caché en memoria y deduplicación en vuelo.
export const getTurnos = async (
  filters: TurnosFilters = {},
  forceRefresh = false
): Promise<TurnosResponse> => {
  const cacheKey = JSON.stringify(filters);
  const now = Date.now();

  if (!forceRefresh) {
    const cached = turnosCache.get(cacheKey);
    if (cached && now - cached.timestamp < TURNOS_CACHE_TTL_MS) {
      return cached.data;
    }

    const inflight = turnosInflight.get(cacheKey);
    if (inflight) {
      return inflight;
    }
  }

  const promise = api
    .get<TurnosResponse>('/turnos', {
      params: {
        ...filters,
      },
    })
    .then((response) => {
      turnosCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
      turnosInflight.delete(cacheKey);
      return response.data;
    })
    .catch((error) => {
      turnosInflight.delete(cacheKey);
      throw error;
    });

  turnosInflight.set(cacheKey, promise);
  return promise;
};

// Obtiene los datos de un turno por su identificador.
export const getTurnoById = async (
  id: string
): Promise<TurnoResponse> => {
  const response = await api.get<TurnoResponse>(
    `/turnos/${id}`
  );

  return response.data;
};

// Registra un nuevo turno.
export const createTurno = async (
  data: CreateTurnoRequest
): Promise<TurnoResponse> => {
  clearTurnosCache();
  const response = await api.post<TurnoResponse>(
    '/turnos',
    data
  );

  return response.data;
};

// Actualiza los datos de un turno existente.
export const updateTurno = async (
  id: string,
  data: UpdateTurnoRequest
): Promise<TurnoResponse> => {
  clearTurnosCache();
  const response = await api.patch<TurnoResponse>(
    `/turnos/${id}`,
    data
  );

  return response.data;
};

// Modifica el estado de un turno.
export const changeTurnoStatus = async (
  id: string,
  data: ChangeTurnoStatusRequest
): Promise<TurnoResponse> => {
  clearTurnosCache();
  const response = await api.patch<TurnoResponse>(
    `/turnos/${id}/status`,
    data
  );

  return response.data;
};

// Consulta la disponibilidad de turnos para una fecha y atención.
export const getDisponibilidad = async (
  fecha: string,
  idProfesional: string,
  idEspecialidad: string,
  idSalita: string,
  patientId?: string,
  turnoId?: string
): Promise<DisponibilidadResponse> => {
  const response = await api.get<DisponibilidadResponse>(
    '/disponibilidad',
    {
      params: {
        fecha,
        id_profesional: idProfesional,
        id_especialidad: idEspecialidad,
        id_salita: idSalita,
        ...(patientId ? { id_paciente: patientId } : {}),
        ...(turnoId ? { id_turno: turnoId } : {}),
      },
    }
  );

  return response.data;
};

// Define las fechas disponibles y la ventana de reserva.
export interface PatientAvailableDates {
  fechas: string[];
  dias: {
    fecha: string; disponible: boolean;
    estado: 'DISPONIBLE' | 'CERRADO' | 'SIN_CUPOS' | 'SIN_HORARIO';
    cierre: 'FERIADO' | 'NO LABORABLE' | 'SALITA CERRADA' | null;
    franjas_cerradas: string[];
  }[];

  ventana: {
    desde: string;
    hasta: string;
    proxima_apertura: string;
  };
}

// Obtiene las fechas disponibles para el paciente.
export const getPatientAvailableDates = async (
  professional: string,
  specialty: string,
  clinic: string,
  patientId?: string
): Promise<PatientAvailableDates> =>
  (
    await api.get<PatientAvailableDates>(
      '/disponibilidad/fechas',
      {
        params: {
          id_profesional: professional,
          id_especialidad: specialty,
          id_salita: clinic,
          ...(patientId ? { id_paciente: patientId } : {}),
        },
      }
    )
  ).data;
