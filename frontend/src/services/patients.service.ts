
import api from './api';

import { updateOwnProfile } from './auth.service';

import type {
  CreatePatientRequest,
  OwnPatientUpdate,
  PatientResponse,
  PatientStatusFilter,
  PatientsResponse,
  UpdatePatientRequest,
} from '../types/patient.types';
import type { PatientHistoriaClinicaData } from '../types/historia-clinica.types';

// Obtiene la historia clínica del paciente autenticado o tutelado autorizado.
export const getOwnHistoriaClinica = async (
  idPaciente?: string
): Promise<{ success: boolean; data: PatientHistoriaClinicaData }> => {
  const response = await api.get<{ success: boolean; data: PatientHistoriaClinicaData }>(
    '/patients/mi-historia-clinica',
    {
      params: idPaciente ? { id_paciente: idPaciente } : undefined,
    }
  );
  return response.data;
};

// Actualiza los datos personales del paciente autenticado.
export const updateOwnPatient = async (
  data: OwnPatientUpdate
) => {
  return updateOwnProfile(data);
};

// Obtiene la lista paginada de pacientes con filtros de búsqueda, estado y salita.
export const getPatients = async (
  page = 1,
  limit = 10,
  search = '',
  estado: PatientStatusFilter = 'activo',
  idSalita?: string,
): Promise<PatientsResponse> => {
  const response = await api.get<PatientsResponse>(
    '/patients',
    {
      params: {
        page,
        limit,
        search: search || undefined,
        estado,
        id_salita: idSalita || undefined,
      },
    }
  );

  return response.data;
};

// Busca un paciente mediante su número de DNI.
export const getPatientByDni = async (
  dni: string
): Promise<PatientResponse> => {
  const response = await api.get<PatientResponse>(
    `/patients/dni/${dni}`
  );

  return response.data;
};

// Obtiene los datos de un paciente mediante su identificador.
export const getPatientById = async (
  id: string
): Promise<PatientResponse> => {
  const response = await api.get<PatientResponse>(
    `/patients/${id}`
  );

  return response.data;
};

// Registra un nuevo paciente en el sistema.
export const createPatient = async (
  data: CreatePatientRequest
): Promise<PatientResponse> => {
  const response = await api.post<PatientResponse>(
    '/patients',
    data
  );

  return response.data;
};

// Actualiza el estado activo o inactivo de un paciente.
export const updatePatientStatus = async (
  id: string,
  activo: boolean
): Promise<PatientResponse> => {
  const response = await api.patch<PatientResponse>(
    `/patients/${id}/status`,
    {
      activo,
    }
  );

  return response.data;
};

// Actualiza los datos de un paciente registrado.
export const updatePatient = async (
  id: string,
  data: UpdatePatientRequest
): Promise<PatientResponse> => {
  const response = await api.patch<PatientResponse>(
    `/patients/${id}`,
    data
  );

  return response.data;
};
