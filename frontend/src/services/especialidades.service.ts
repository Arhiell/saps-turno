import api from './api';

import type {
  SpecialtiesResponse,
} from '../types/profesional.types';

export const getSpecialties =
  async (): Promise<SpecialtiesResponse> => {
    const response =
      await api.get<SpecialtiesResponse>(
        '/especialidades',
      );

    return response.data;
  };