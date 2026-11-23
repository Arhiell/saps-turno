import { supabase } from "../config/supabase.js";

// Reutiliza las asignaciones administrativas reales, sin un segundo sistema de roles.
export const findTurnoSalitasForUser = async (userId: string, date: string) => {
  const { data, error } = await supabase.from("usuario_salita").select("id_salita")
    .eq("id_usuario", userId).eq("activo", true).lte("fecha_desde", date)
    .or(`fecha_hasta.is.null,fecha_hasta.gte.${date}`);
  if (error) throw error;
  return (data ?? []).map(row => String(row.id_salita));
};

// Obtiene las salitas activas con asignación vigente para un profesional.
export const findTurnoSalitasForProfesional = async (profesionalId: string, date: string) => {
  const { data, error } = await supabase.from("profesional_salita").select("id_salita")
    .eq("id_profesional", profesionalId).eq("activo", true).lte("fecha_desde", date)
    .or(`fecha_hasta.is.null,fecha_hasta.gte.${date}`);
  if (error) throw error;
  return (data ?? []).map(row => String(row.id_salita));
};
