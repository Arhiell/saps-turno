export interface Barrio {
  id_barrio: string;
  id_zona: string;
  nombre: string;
  codigo_postal: string | null;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface BarriosResponse {
  success: boolean;
  message?: string;
  data: {
    barrios: Barrio[];
  };
}