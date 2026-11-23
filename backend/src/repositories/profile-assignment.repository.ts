import { supabase } from '../config/supabase.js';

// Obtiene las asignaciones de salitas del usuario autenticado.
export const findProfileAssignments = async (
  userId: string
) => {
  const { data, error } = await supabase
    .from('usuario_salita')
    .select(
      'es_principal, activo, fecha_desde, fecha_hasta, salita:salitas(nombre, activo)'
    )
    .eq('id_usuario', userId)
    .order('es_principal', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};