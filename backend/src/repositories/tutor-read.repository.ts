import { supabase } from "../config/supabase.js";
import { tutorSelect, flattenTutor, type TutorRow } from "./tutor-select.js";

export const findTutors = async (from: number, to: number) => {
  const { data, count, error } = await supabase.from("tutores")
    .select(tutorSelect, { count: "exact" }).eq("activo", true)
    .order("persona(apellidos)").order("persona(nombres)").order("id_tutor")
    .range(from, to).returns<TutorRow[]>();
  if (error) throw error;
  return { tutors: (data ?? []).map(flattenTutor), total: count ?? 0 };
};

export const findTutorById = async (id: string) => {
  const { data, error } = await supabase.from("tutores").select(tutorSelect)
    .eq("id_tutor", id).returns<TutorRow[]>().maybeSingle();
  if (error) throw error;
  return data ? flattenTutor(data) : null;
};

export const findTutorByDni = async (dni: string) => {
  const { data, error } = await supabase.from("tutores").select(tutorSelect)
    .eq("persona.dni", dni).returns<TutorRow[]>().maybeSingle();
  if (error) throw error;
  return data ? flattenTutor(data) : null;
};

export const findTutorPersonState = async (id: string) => {
  const { data, error } = await supabase.from("personas")
    .select("activo, telefono").eq("id_persona", id).maybeSingle();
  if (error) throw error;
  return data;
};
