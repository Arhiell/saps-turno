import api from './api';
import axios from 'axios';
import { authError } from '../utils/auth-errors';

// Las respuestas de error también llegan como Blob en una descarga.
export const reporteDownloadError = async (error: unknown): Promise<string> => {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const body = JSON.parse(await error.response.data.text());
      if (typeof body.message === 'string') return body.message;
    } catch { /* Conserva el mensaje de respaldo si no es JSON. */ }
    return 'No se pudo descargar el archivo. Volvé a intentar.';
  }
  return authError(error);
};

const saveDownload = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Da tiempo al navegador para iniciar la descarga antes de liberar el recurso.
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
};

import type {
  AgendaDiariaResponse,
  ReporteEspecialidadesResponse,
  ReporteFiltros,
  ReporteFormato,
  ReporteProfesionalesResponse,
  ReporteResumenResponse,
  ReporteTipo,
} from '../types/reporte.types';

const buildParams = (
  filters: ReporteFiltros,
) => {
  const params: Record<string, string> = {
    fecha_desde:
      filters.fecha_desde,
    fecha_hasta:
      filters.fecha_hasta,
  };

  if (filters.id_salita) {
    params.id_salita =
      filters.id_salita;
  }

  return params;
};

export const getReporteResumen =
  async (
    filters: ReporteFiltros,
  ): Promise<ReporteResumenResponse> => {
    const response =
      await api.get<ReporteResumenResponse>(
        '/reportes/resumen',
        {
          params:
            buildParams(filters),
        },
      );

    return response.data;
  };

export const getReporteEspecialidades =
  async (
    filters: ReporteFiltros,
  ): Promise<ReporteEspecialidadesResponse> => {
    const response =
      await api.get<ReporteEspecialidadesResponse>(
        '/reportes/especialidades',
        {
          params:
            buildParams(filters),
        },
      );

    return response.data;
  };

export const getReporteProfesionales =
  async (
    filters: ReporteFiltros,
  ): Promise<ReporteProfesionalesResponse> => {
    const response =
      await api.get<ReporteProfesionalesResponse>(
        '/reportes/profesionales',
        {
          params:
            buildParams(filters),
        },
      );

    return response.data;
  };

export const descargarReporte =
  async (
    filters: ReporteFiltros,
    tipo: ReporteTipo,
    formato: ReporteFormato,
  ): Promise<void> => {
    const response =
      await api.get<Blob>(
        '/reportes/exportar',
        {
          params: {
            ...buildParams(filters),
            tipo,
            formato,
          },
          responseType: 'blob',
        },
      );

    saveDownload(response.data,
      `reporte-${tipo}-${filters.fecha_desde}-${filters.fecha_hasta}.${formato}`);
  };

/* ========================= */
/* AGENDA DIARIA */
/* ========================= */

export interface AgendaFiltros {
  fecha?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  id_salita?: string;
  id_profesional?: string;
  id_especialidad?: string;
  estado?: string;
}

const buildAgendaParams = (
  filters: AgendaFiltros,
) => {
  const params: Record<string, string> = {};
  if (filters.fecha_desde && filters.fecha_hasta) {
    params.fecha_desde = filters.fecha_desde;
    params.fecha_hasta = filters.fecha_hasta;
  } else if (filters.fecha) {
    params.fecha = filters.fecha;
  }

  if (filters.id_salita) {
    params.id_salita =
      filters.id_salita;
  }

  if (filters.id_profesional) {
    params.id_profesional =
      filters.id_profesional;
  }

  if (filters.id_especialidad) {
    params.id_especialidad =
      filters.id_especialidad;
  }

  if (filters.estado) {
    params.estado =
      filters.estado;
  }

  return params;
};

export const getAgendaDiaria =
  async (
    filters: AgendaFiltros,
  ): Promise<AgendaDiariaResponse> => {
    const response =
      await api.get<AgendaDiariaResponse>(
        '/reportes/agenda-diaria',
        {
          params:
            buildAgendaParams(filters),
        },
      );

    return response.data;
  };

export const descargarAgendaDiaria =
  async (
    filters: AgendaFiltros,
    formato: ReporteFormato,
  ): Promise<void> => {
    const response =
      await api.get<Blob>(
        '/reportes/agenda-diaria/exportar',
        {
          params: {
            ...buildAgendaParams(
              filters,
            ),
            formato,
          },
          responseType: 'blob',
        },
      );

    const period = filters.fecha_desde && filters.fecha_hasta
      ? `${filters.fecha_desde}-${filters.fecha_hasta}` : filters.fecha ?? 'hoy';
    saveDownload(response.data, `agenda-${period}.${formato}`);
  };
