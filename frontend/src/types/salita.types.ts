import type {
  AccountDisplay,
} from './account-display.types';

// Representa una salita y sus datos principales.
export interface Salita {
  id_salita: string;
  codigo: string;
  nombre: string;
  direccion: string;
  id_barrio: string;
  telefono: string | null;
  email: string | null;
  latitud: number | null;
  longitud: number | null;
  horario_apertura:
    | string
    | null;
  horario_cierre:
    | string
    | null;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;

  // Cuentas administrativas asociadas a la salita.
  administradores?: {
    cuenta:
      AccountDisplay | null;
  }[];
}

// Respuesta utilizada para una única salita.
export interface SalitaResponse {
  success: boolean;
  message?: string;
  data: Salita;
}

// Respuesta utilizada para un listado de salitas.
export interface SalitasResponse {
  success: boolean;
  message?: string;
  data: Salita[];
}

// Datos necesarios para crear una salita.
export interface CreateSalitaRequest {
  codigo: string;
  nombre: string;
  direccion: string;
  id_barrio: string;
  telefono?: string | null;
  email?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  horario_apertura?:
    | string
    | null;
  horario_cierre?:
    | string
    | null;
  activo?: boolean;
}

// Datos permitidos para actualizar una salita.
export interface UpdateSalitaRequest {
  codigo?: string;
  nombre?: string;
  direccion?: string;
  id_barrio?: string;
  telefono?: string | null;
  email?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  horario_apertura?:
    | string
    | null;
  horario_cierre?:
    | string
    | null;
  activo?: boolean;
}