import { supabase } from "../config/supabase.js";

export interface SystemRole {
  codigo: string;
  nombre: string;
}

/**
 * Consulta los roles existentes en SAPS Turno.
 *
 * Sirve inicialmente para verificar que la API
 * realmente puede acceder a PostgreSQL/Supabase.
 */
export const getSystemRoles = async (): Promise<SystemRole[]> => {
  const { data, error } = await supabase
    .from("roles")
    .select("codigo, nombre")
    .order("nombre");

  if (error) {
    throw new Error(
      `Error consultando Supabase: ${error.message}`
    );
  }

  return data ?? [];
};