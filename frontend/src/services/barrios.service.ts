import api from './api';

import type {
  Barrio,
  BarriosResponse,
} from '../types/barrio.types';

export const getBarrios = async (): Promise<BarriosResponse> => {
  const response = await api.get<{
    success: boolean;
    message?: string;
    data: Barrio[];
  }>('/barrios');

  return {
    success: response.data.success,
    message: response.data.message,
    data: {
      barrios: response.data.data,
    },
  };
};