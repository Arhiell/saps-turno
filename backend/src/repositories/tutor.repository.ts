import { supabase } from "../config/supabase.js";

export const findTutorByPersonId = async (idPerson: string) => {
  const { data, error } = await supabase.from("tutores")
    .select("id_tutor, id_persona, activo").eq("id_persona", idPerson).maybeSingle();
  if (error) throw error;
  return data;
};

export const createTutor = async (idPerson: string) => {
  const { data, error } = await supabase.from("tutores")
    .insert({ id_persona: idPerson })
    .select("id_tutor, id_persona, activo, fecha_creacion, fecha_actualizacion").single();
  if (error) throw error;
  return data;
};