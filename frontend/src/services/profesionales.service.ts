import api from './api';

import type {
  PatientProfessional,
  CreateProfessionalClinicRequest,
  CreateProfessionalRequest,
  CreateProfessionalSpecialtyRequest,
  ProfessionalClinicsResponse,
  ProfessionalResponse,
  ProfessionalsResponse,
  ProfessionalSpecialtiesResponse,
  UpdateProfessionalClinicRequest,
  UpdateProfessionalRequest,
  UpdateProfessionalSpecialtyRequest,
} from '../types/profesional.types';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

let professionalsCache: { data: ProfessionalsResponse; timestamp: number } | null = null;
let professionalsInflight: Promise<ProfessionalsResponse> | null = null;

export const clearProfessionalsCache = () => {
  professionalsCache = null;
  professionalsInflight = null;
};

// Obtiene el listado de profesionales con caché en memoria e invalidación.
export const getProfessionals =
  async (forceRefresh = false): Promise<ProfessionalsResponse> => {
    const now = Date.now();
    if (!forceRefresh && professionalsCache && now - professionalsCache.timestamp < CACHE_TTL_MS) {
      return professionalsCache.data;
    }

    if (!forceRefresh && professionalsInflight) {
      return professionalsInflight;
    }

    professionalsInflight = api
      .get<ProfessionalsResponse>('/profesionales')
      .then((response) => {
        professionalsCache = { data: response.data, timestamp: Date.now() };
        professionalsInflight = null;
        return response.data;
      })
      .catch((error) => {
        professionalsInflight = null;
        throw error;
      });

    return professionalsInflight;
  };

// Obtiene los datos de un profesional por su identificador.
export const getProfessionalById = async (
  id: string
): Promise<ProfessionalResponse> => {
  const response = await api.get<ProfessionalResponse>(
    `/profesionales/${id}`
  );

  return response.data;
};

// Registra un nuevo profesional.
export const createProfessional = async (
  data: CreateProfessionalRequest
): Promise<ProfessionalResponse> => {
  const response = await api.post<ProfessionalResponse>(
    '/profesionales',
    data
  );

  clearProfessionalsCache();
  return response.data;
};

// Actualiza los datos de un profesional.
export const updateProfessional = async (
  id: string,
  data: UpdateProfessionalRequest
): Promise<ProfessionalResponse> => {
  const response = await api.put<ProfessionalResponse>(
    `/profesionales/${id}`,
    data
  );

  clearProfessionalsCache();
  return response.data;
};

// Elimina un profesional.
export const deleteProfessional = async (
  id: string
): Promise<ProfessionalResponse> => {
  const response = await api.delete<ProfessionalResponse>(
    `/profesionales/${id}`
  );

  clearProfessionalsCache();
  return response.data;
};

// Obtiene las especialidades asignadas a un profesional.
export const getProfessionalSpecialties = async (
  id: string
): Promise<ProfessionalSpecialtiesResponse> => {
  const response =
    await api.get<ProfessionalSpecialtiesResponse>(
      `/profesionales/${id}/especialidades`
    );

  return response.data;
};

// Asigna una especialidad a un profesional.
export const addProfessionalSpecialty = async (
  id: string,
  data: CreateProfessionalSpecialtyRequest
): Promise<ProfessionalSpecialtiesResponse> => {
  const response =
    await api.post<ProfessionalSpecialtiesResponse>(
      `/profesionales/${id}/especialidades`,
      data
    );

  return response.data;
};

// Actualiza una especialidad asignada a un profesional.
export const updateProfessionalSpecialty = async (
  id: string,
  idEspecialidad: string,
  data: UpdateProfessionalSpecialtyRequest
): Promise<ProfessionalSpecialtiesResponse> => {
  const response =
    await api.put<ProfessionalSpecialtiesResponse>(
      `/profesionales/${id}/especialidades/${idEspecialidad}`,
      data
    );

  return response.data;
};

// Elimina una especialidad asignada a un profesional.
export const deleteProfessionalSpecialty = async (
  id: string,
  idEspecialidad: string
): Promise<ProfessionalSpecialtiesResponse> => {
  const response =
    await api.delete<ProfessionalSpecialtiesResponse>(
      `/profesionales/${id}/especialidades/${idEspecialidad}`
    );

  return response.data;
};

// Obtiene las salitas asignadas a un profesional.
export const getProfessionalClinics = async (
  id: string
): Promise<ProfessionalClinicsResponse> => {
  const response =
    await api.get<ProfessionalClinicsResponse>(
      `/profesionales/${id}/salitas`
    );

  return response.data;
};

// Asigna una salita a un profesional.
export const addProfessionalClinic = async (
  id: string,
  data: CreateProfessionalClinicRequest
): Promise<ProfessionalClinicsResponse> => {
  const response =
    await api.post<ProfessionalClinicsResponse>(
      `/profesionales/${id}/salitas`,
      data
    );

  return response.data;
};

// Actualiza la asignación de una salita a un profesional.
export const updateProfessionalClinic = async (
  id: string,
  idSalita: string,
  data: UpdateProfessionalClinicRequest
): Promise<ProfessionalClinicsResponse> => {
  const response =
    await api.put<ProfessionalClinicsResponse>(
      `/profesionales/${id}/salitas/${idSalita}`,
      data
    );

  return response.data;
};

// Elimina la asignación de una salita a un profesional.
export const deleteProfessionalClinic = async (
  id: string,
  idSalita: string
): Promise<ProfessionalClinicsResponse> => {
  const response =
    await api.delete<ProfessionalClinicsResponse>(
      `/profesionales/${id}/salitas/${idSalita}`
    );

  return response.data;
};

// Obtiene los profesionales disponibles para los pacientes.
export const getPatientProfessionals = async (
  fecha?: string,
  patientId?: string
) =>
  (
    await api.get<{ data: PatientProfessional[] }>(
      '/profesionales',
      {
        params: {
          fecha,
          ...(patientId ? { id_paciente: patientId } : {}),
        },
      }
    )
  ).data.data;


export interface SlotDisponibilidad {
  hora_inicio: string;
  hora_fin: string;
  estado: 'DISPONIBLE' | 'OCUPADO' | 'BLOQUEADO' | 'FINALIZADO' | 'NO_DISPONIBLE';
  motivo?: string;
  id_turno?: string;
  codigo_turno?: string;
  paciente?: string;
  dni?: string;
  estado_turno?: string;
}

export interface FranjaHorario {
  id_horario: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_turno_minutos: number;
  cupo_maximo_diario?: number | null;
  salita: string;
  id_salita?: string;
  especialidad: string;
  id_especialidad?: string;
}

export interface CronogramaDia {
  dia_semana: number;
  nombre_dia: string;
  trabaja: boolean;
  franjas: FranjaHorario[];
}

export interface DisponibilidadFecha {
  fecha: string;
  dia_semana: number;
  nombre_dia: string;
  trabaja: boolean;
  bloqueo_dia_completo: {
    bloqueado: boolean;
    motivo?: string;
  };
  resumen_slots: {
    total: number;
    disponibles: number;
    ocupados: number;
    bloqueados: number;
    finalizados?: number;
  };
  duracion_dia_minutos?: number;
  duracion_dia_descripcion?: string;
  franjas: {
    id_horario: string;
    hora_inicio: string;
    hora_fin: string;
    duracion_turno_minutos: number;
    salita: string;
    id_salita?: string;
    especialidad: string;
    id_especialidad?: string;
    slots: SlotDisponibilidad[];
  }[];
}

export interface MisHorariosData {
  profesional: {
    id_profesional: string;
    matricula: string;
    nombre_completo: string;
  };
  informacion_general: {
    dias_laborales: string[];
    horario_atencion: string;
    es_horario_uniforme?: boolean;
    horarios_por_dia?: { dia: string; franjas: string }[];
    duracion_turno_minutos: number;
    es_duracion_uniforme?: boolean;
    duraciones_disponibles?: number[];
    duracion_descripcion?: string;
    salitas: string[];
    especialidades: string[];
    salitas_detalle?: { id: string; nombre: string }[];
    especialidades_detalle?: { id: string; nombre: string }[];
  };
  cronograma_semanal: CronogramaDia[];
  disponibilidad_fecha: DisponibilidadFecha;
}

// Obtiene los horarios y disponibilidad del profesional autenticado.
export const getMisHorarios = async (
  fecha?: string
): Promise<{ success: boolean; data: MisHorariosData }> => {
  const response = await api.get<{ success: boolean; data: MisHorariosData }>(
    '/profesionales/me/horarios-disponibilidad',
    {
      params: fecha ? { fecha } : {},
    }
  );
  return response.data;
};
