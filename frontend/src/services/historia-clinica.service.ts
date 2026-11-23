import axios from 'axios';

import api from './api';
import type {
  ActualizarConsultaBorradorPayload,
  AlergiaPaciente,
  AntecedenteClinico,
  AuditoriaClinicaRecord,
  BorradorFormularioClinico,
  BorradorTemporalResponse,
  ClinicalPatientsSearchData,
  ConsultaMedicaDetalle,
  ConsultaMutationResponse,
  DerivacionClinica,
  DerivacionEstado,
  GuardarBorradorTemporalPayload,
  HistoriaClinicaContextData,
  HistoriaClinicaDossier,
  RegistrarConsultaPayload,
  ResolverDerivacionPayload,
  SolicitarDerivacionPayload,
} from '../types/historia-clinica.types';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
};

export interface ClinicalApiErrorInfo {
  status: number | null;
  message: string;
  code?: string;
  data?: {
    borrador_actual?: BorradorFormularioClinico;
    [key: string]: unknown;
  };
  isForbidden: boolean;
  isConflict: boolean;
  isNotFound: boolean;
}

export const extractClinicalApiError = (error: unknown): ClinicalApiErrorInfo => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? null;
    const responseData = error.response?.data as
      | {
          message?: string;
          error?: string;
          code?: string;
          data?: { borrador_actual?: BorradorFormularioClinico; [key: string]: unknown };
          errors?: Array<{ message?: string }>;
        }
      | undefined;

    const validationMessage = responseData?.errors
      ?.map((e) => e.message)
      .filter(Boolean)
      .join('. ');

    const serverMessage =
      validationMessage &&
      (!responseData?.message || responseData.message === 'Error de validación')
        ? validationMessage
        : responseData?.message || responseData?.error || validationMessage;

    if (status === 401) {
      return {
        status,
        message:
          serverMessage || 'Tu sesión expiró. Volvé a iniciar sesión para continuar.',
        isForbidden: false,
        isConflict: false,
        isNotFound: false,
      };
    }

    if (status === 403) {
      return {
        status,
        message:
          serverMessage ||
          'No tenés permisos o alcance clínico autorizado para acceder a esta información.',
        isForbidden: true,
        isConflict: false,
        isNotFound: false,
      };
    }

    if (status === 404) {
      return {
        status,
        message: serverMessage || 'El recurso clínico solicitado no fue encontrado.',
        isForbidden: false,
        isConflict: false,
        isNotFound: true,
      };
    }

    if (status === 409) {
      return {
        status,
        message:
          serverMessage ||
          'La operación entra en conflicto con el estado actual o la inmutabilidad del registro clínico.',
        ...(responseData?.code ? { code: responseData.code } : {}),
        ...(responseData?.data ? { data: responseData.data } : {}),
        isForbidden: false,
        isConflict: true,
        isNotFound: false,
      };
    }

    return {
      status,
      message:
        serverMessage ||
        'Ocurrió un error al procesar la solicitud de Historia Clínica.',
      isForbidden: false,
      isConflict: false,
      isNotFound: false,
    };
  }

  return {
    status: null,
    message:
      error instanceof Error
        ? error.message
        : 'Error inesperado al consultar Historia Clínica.',
    isForbidden: false,
    isConflict: false,
    isNotFound: false,
  };
};

export const getHistoriaClinicaContext = async (): Promise<HistoriaClinicaContextData> => {
  const response = await api.get<{
    success: boolean;
    data: HistoriaClinicaContextData;
  }>('/historia-clinica/contexto', { headers: NO_STORE_HEADERS });

  return response.data.data;
};

export const searchClinicalPatients = async (params: {
  search?: string;
  id_salita?: string;
  page?: number;
  limit?: number;
}): Promise<ClinicalPatientsSearchData> => {
  const response = await api.get<{
    success: boolean;
    data: ClinicalPatientsSearchData;
  }>('/historia-clinica/pacientes', {
    headers: NO_STORE_HEADERS,
    params: {
      search: params.search?.trim() || undefined,
      id_salita: params.id_salita || undefined,
      page: params.page ?? 1,
      limit: params.limit ?? 12,
    },
  });

  return response.data.data;
};

export const getHistoriaClinicaPaciente = async (
  idPaciente: string,
  params: {
    id_salita: string;
    id_especialidad?: string;
    motivo_acceso?: string;
    es_exportacion?: boolean;
  }
): Promise<HistoriaClinicaDossier> => {
  const response = await api.get<{
    success: boolean;
    data: HistoriaClinicaDossier;
  }>(`/historia-clinica/pacientes/${idPaciente}`, {
    headers: NO_STORE_HEADERS,
    params: {
      id_salita: params.id_salita,
      id_especialidad: params.id_especialidad || undefined,
      motivo_acceso: params.motivo_acceso || undefined,
      es_exportacion: params.es_exportacion ? 'true' : undefined,
    },
  });

  return response.data.data;
};

export const getAntecedentesPaciente = async (
  idPaciente: string,
  params: {
    id_salita: string;
    tipo?: string;
    estado?: string;
  }
): Promise<{
  antecedentes: AntecedenteClinico[];
  contenido_restringido_por_alcance: boolean;
}> => {
  const response = await api.get<{
    success: boolean;
    data: {
      antecedentes: AntecedenteClinico[];
      contenido_restringido_por_alcance: boolean;
    };
  }>(`/historia-clinica/pacientes/${idPaciente}/antecedentes`, {
    headers: NO_STORE_HEADERS,
    params,
  });

  return response.data.data;
};

export const getAlergiasPaciente = async (
  idPaciente: string,
  params: {
    id_salita: string;
    estado?: string;
  }
): Promise<{
  alergias: AlergiaPaciente[];
  contenido_restringido_por_alcance: boolean;
}> => {
  const response = await api.get<{
    success: boolean;
    data: {
      alergias: AlergiaPaciente[];
      contenido_restringido_por_alcance: boolean;
    };
  }>(`/historia-clinica/pacientes/${idPaciente}/alergias`, {
    headers: NO_STORE_HEADERS,
    params,
  });

  return response.data.data;
};

export const getConsultaMedicaById = async (
  idConsulta: string,
  params: {
    id_salita: string;
    id_paciente?: string;
    motivo_acceso?: string;
  }
): Promise<ConsultaMedicaDetalle> => {
  const response = await api.get<{
    success: boolean;
    data: ConsultaMedicaDetalle;
  }>(`/historia-clinica/consultas/${idConsulta}`, {
    headers: NO_STORE_HEADERS,
    params,
  });

  return response.data.data;
};

export const registrarConsultaClinica = async (
  payload: RegistrarConsultaPayload
): Promise<ConsultaMutationResponse> => {
  const response = await api.post<{
    success: boolean;
    data: ConsultaMutationResponse;
  }>('/historia-clinica/consultas', payload, {
    headers: NO_STORE_HEADERS,
  });

  return response.data.data;
};

export const actualizarConsultaBorrador = async (
  idConsulta: string,
  payload: ActualizarConsultaBorradorPayload
): Promise<ConsultaMutationResponse> => {
  const response = await api.patch<{
    success: boolean;
    data: ConsultaMutationResponse;
  }>(`/historia-clinica/consultas/${idConsulta}`, payload, {
    headers: NO_STORE_HEADERS,
  });

  return response.data.data;
};

export const firmarConsultaMedica = async (
  idConsulta: string,
  payload: {
    id_salita: string;
    id_paciente?: string;
    motivo_acceso?: string;
  }
): Promise<ConsultaMutationResponse> => {
  const response = await api.post<{
    success: boolean;
    data: ConsultaMutationResponse;
  }>(`/historia-clinica/consultas/${idConsulta}/firmar`, payload, {
    headers: NO_STORE_HEADERS,
  });

  return response.data.data;
};

export const anularConsultaBorrador = async (
  idConsulta: string,
  payload: {
    id_salita: string;
    id_paciente?: string;
    motivo_anulacion: string;
  }
): Promise<Record<string, unknown>> => {
  const response = await api.post<{
    success: boolean;
    data: Record<string, unknown>;
  }>(`/historia-clinica/consultas/${idConsulta}/anular`, payload, {
    headers: NO_STORE_HEADERS,
  });

  return response.data.data;
};

export const registrarEvolucionClinica = async (
  idConsulta: string,
  payload: {
    id_salita: string;
    evolucion: string;
    observaciones?: string | null;
    fecha_evolucion?: string;
  }
): Promise<Record<string, unknown>> => {
  const response = await api.post<{
    success: boolean;
    data: Record<string, unknown>;
  }>(`/historia-clinica/consultas/${idConsulta}/evoluciones`, payload, {
    headers: NO_STORE_HEADERS,
  });

  return response.data.data;
};

export const rectificarEvolucionClinica = async (
  idEvolucion: string,
  payload: {
    id_salita: string;
    evolucion: string;
    motivo_correccion: string;
    observaciones?: string | null;
    fecha_evolucion?: string;
  }
): Promise<Record<string, unknown>> => {
  const response = await api.post<{
    success: boolean;
    data: Record<string, unknown>;
  }>(`/historia-clinica/evoluciones/${idEvolucion}/rectificar`, payload, {
    headers: NO_STORE_HEADERS,
  });

  return response.data.data;
};

export const actualizarEstadoEstudio = async (
  idEstudio: string,
  payload: {
    id_salita: string;
    estado: 'EN_PROCESO' | 'CANCELADO';
  }
): Promise<Record<string, unknown>> => {
  const response = await api.patch<{
    success: boolean;
    data: Record<string, unknown>;
  }>(`/historia-clinica/estudios/${idEstudio}/estado`, payload, {
    headers: NO_STORE_HEADERS,
  });

  return response.data.data;
};

export const informarEstudioClinico = async (
  idEstudio: string,
  payload: {
    id_salita: string;
    resultado: string;
    fecha_resultado?: string;
  }
): Promise<Record<string, unknown>> => {
  const response = await api.post<{
    success: boolean;
    data: Record<string, unknown>;
  }>(`/historia-clinica/estudios/${idEstudio}/informar`, payload, {
    headers: NO_STORE_HEADERS,
  });

  return response.data.data;
};

export const listarDerivacionesClinicas = async (params: {
  id_salita: string;
  id_paciente?: string;
  estado?: DerivacionEstado;
}): Promise<DerivacionClinica[]> => {
  const response = await api.get<{
    success: boolean;
    data: DerivacionClinica[];
  }>('/historia-clinica/derivaciones', {
    headers: NO_STORE_HEADERS,
    params: {
      id_salita: params.id_salita,
      id_paciente: params.id_paciente || undefined,
      estado: params.estado || undefined,
    },
  });

  return response.data.data;
};

export const solicitarDerivacionClinica = async (
  payload: SolicitarDerivacionPayload
): Promise<Record<string, unknown>> => {
  const response = await api.post<{
    success: boolean;
    data: Record<string, unknown>;
  }>('/historia-clinica/derivaciones', payload, {
    headers: NO_STORE_HEADERS,
  });

  return response.data.data;
};

export const resolverDerivacionClinica = async (
  idDerivacion: string,
  payload: ResolverDerivacionPayload
): Promise<Record<string, unknown>> => {
  const response = await api.patch<{
    success: boolean;
    data: Record<string, unknown>;
  }>(`/historia-clinica/derivaciones/${idDerivacion}/resolver`, payload, {
    headers: NO_STORE_HEADERS,
  });

  return response.data.data;
};

export const consultarAuditoriaClinica = async (params: {
  id_salita?: string;
  id_paciente?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditoriaClinicaRecord[]> => {
  const response = await api.get<{
    success: boolean;
    data: AuditoriaClinicaRecord[];
  }>('/historia-clinica/auditoria', {
    headers: NO_STORE_HEADERS,
    params: {
      id_salita: params.id_salita || undefined,
      id_paciente: params.id_paciente || undefined,
      fecha_desde: params.fecha_desde || undefined,
      fecha_hasta: params.fecha_hasta || undefined,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    },
  });

  return response.data.data;
};

export const obtenerBorradorTemporal = async (params: {
  id_paciente: string;
  id_salita: string;
  id_turno?: string | null;
}): Promise<BorradorTemporalResponse> => {
  const response = await api.get<{
    success: boolean;
    data: BorradorTemporalResponse;
  }>('/historia-clinica/borradores-temporales', {
    headers: NO_STORE_HEADERS,
    params: {
      id_paciente: params.id_paciente,
      id_salita: params.id_salita,
      id_turno: params.id_turno || undefined,
    },
  });

  return response.data.data;
};

export const guardarBorradorTemporal = async (
  payload: GuardarBorradorTemporalPayload
): Promise<BorradorTemporalResponse> => {
  const response = await api.put<{
    success: boolean;
    data: BorradorTemporalResponse;
  }>('/historia-clinica/borradores-temporales', payload, {
    headers: NO_STORE_HEADERS,
  });

  return response.data.data;
};

export const descartarBorradorTemporal = async (params: {
  id_paciente: string;
  id_salita: string;
  id_turno?: string | null;
}): Promise<{ available: boolean; descartado: boolean }> => {
  const response = await api.delete<{
    success: boolean;
    data: { available: boolean; descartado: boolean };
  }>('/historia-clinica/borradores-temporales', {
    headers: NO_STORE_HEADERS,
    params: {
      id_paciente: params.id_paciente,
      id_salita: params.id_salita,
      id_turno: params.id_turno || undefined,
    },
  });

  return response.data.data;
};
