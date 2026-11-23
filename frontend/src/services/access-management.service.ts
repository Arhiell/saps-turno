import api from './api';

import type {
  CompletePersonInput,
  PersonProfile,
} from '../types/auth.types';

// Representa una cuenta administrativa y sus datos asociados.
export interface ManagedAccount {
  id_usuario: string;
  id_persona: string | null;
  nombre_usuario: string;
  email: string;
  activo: boolean;
  email_verificado: boolean;

  rol: {
    codigo: string;
    nombre: string;
  };

  persona: PersonProfile | null;

  asignaciones: {
    id_salita: string;
    salita: {
      id_salita: string;
      nombre: string;
    } | null;
  }[];
}

// Define la estructura de una respuesta paginada.
export interface ManagedPage<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

// Obtiene las cuentas administrativas con filtros y paginación.
export const getManagedAccounts = async (
  page: number,
  search: string,
  role: string,
  clinic: string
) => {
  const response = await api.get<{
    data: ManagedPage<ManagedAccount>;
  }>('/access-management/accounts', {
    params: {
      page,
      search,
      role: role || undefined,
      clinic: clinic || undefined,
    },
  });

  return response.data.data;
};

// Activa o desactiva una cuenta administrativa.
export const setManagedAccountStatus = async (
  id: string,
  activo: boolean
) => {
  return api.patch(
    `/access-management/accounts/${id}/status`,
    {
      activo,
    }
  );
};

// Corrige los datos personales de una cuenta administrativa.
export const correctManagedPerson = async (
  id: string,
  data: CompletePersonInput
) => {
  return api.patch(
    `/access-management/people/${id}`,
    data
  );
};