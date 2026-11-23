import api from './api';

import type {
  TurnoResponse,
  UpdateTurnoRequest,
} from '../types/turno.types';

export const reprogramarTurno = async (
  id: string,
  data: UpdateTurnoRequest,
): Promise<TurnoResponse> => {
  const response =
    await api.patch<TurnoResponse>(
      `/turnos/${id}`,
      data,
    );

  return response.data;
};