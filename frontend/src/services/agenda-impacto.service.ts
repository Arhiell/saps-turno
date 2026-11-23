
import api from './api';
import type { CierreInput } from '../types/cierre-calendario.types';
import { isAxiosError } from 'axios';

import type {
  HorarioInput,
  BloqueoInput,
} from '../types/configuracion.types';

import type { Turno } from '../types/turno.types';

// Define los tipos de cambios permitidos en la agenda.
export type AgendaChange =
  | { tipo: 'cierre'; id?: string; datos: CierreInput }
  | {
      tipo: 'horario';
      id: string;
      datos: HorarioInput;
    }
  | {
      tipo: 'bloqueo';
      id?: string;
      datos: BloqueoInput;
    };

// Define los datos necesarios de los turnos afectados.
export type AffectedTurno = Pick<
  Turno,
  | 'id_turno'
  | 'version'
  | 'fecha_hora_inicio'
  | 'fecha_hora_fin'
  | 'paciente'
  | 'profesional'
  | 'especialidad'
  | 'salita'
  | 'estado'
>;

// Representa una propuesta de reprogramación.
export interface AgendaProposal {
  id_turno: string;
  version: number;

  destino: {
    id_horario: string;
    fecha_hora_inicio: string;
    fecha_hora_fin: string;
  } | null;
}

// Representa el resultado de confirmar una reprogramación.
export interface AgendaResult {
  id_turno: string;
  confirmado: boolean;
  mensaje: string;
}

export const getAgendaAvailability = async (cambio: AgendaChange, id_turno: string, fecha: string) =>
  (await api.post<{ opciones: NonNullable<AgendaProposal['destino']>[]; version: number }>(
    '/turnos/reprogramacion/disponibilidad', { cambio, id_turno, fecha },
  )).data;

// Identifica errores de conflicto relacionados con la agenda.
export const isAgendaConflict = (error: unknown) =>
  isAxiosError(error) &&
  error.response?.data?.code === 'AGENDA_CONFLICT';

// Consulta los turnos afectados por un cambio de agenda.
export const getAgendaImpact = async (
  cambio: AgendaChange
) =>
  (
    await api.post<{
      afectados: AffectedTurno[];
    }>(
      '/turnos/reprogramacion/impacto',
      cambio
    )
  ).data;

// Obtiene propuestas de reprogramación dentro del período indicado.
export const getAgendaProposal = async (
  cambio: AgendaChange,
  dias: number
) =>
  (
    await api.post<{
      propuestas: AgendaProposal[];
      pendientes: number;
    }>(
      '/turnos/reprogramacion/propuesta',
      {
        cambio,
        dias,
      }
    )
  ).data;

// Confirma las propuestas que tienen un destino asignado.
export const confirmAgendaProposal = async (
  cambio: AgendaChange,
  motivo: string,
  propuestas: AgendaProposal[]
) =>
  (
    await api.post<{
      resultados: AgendaResult[];
    }>(
      '/turnos/reprogramacion/confirmar',
      {
        cambio,
        motivo,

        // Envía únicamente los turnos con destino propuesto.
        turnos: propuestas
          .filter((p) => p.destino)
          .map((p) => ({
            id_turno: p.id_turno,
            version: p.version,
            id_horario: p.destino!.id_horario,
            fecha_hora_inicio: p.destino!.fecha_hora_inicio,
          })),
      }
    )
  ).data;
