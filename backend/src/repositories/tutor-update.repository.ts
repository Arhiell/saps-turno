import { supabase } from "../config/supabase.js";
import { tutorSelect, flattenTutor, type TutorRow } from "./tutor-select.js";

export const updateTutorStatus = async (id: string, active: boolean) => {
  const { data, error } = await supabase.from("tutores").update({ activo: active })
    .eq("id_tutor", id).eq("activo", !active)
    .select(tutorSelect).returns<TutorRow[]>().maybeSingle();
  if (error) throw error;
  return data ? flattenTutor(data) : null;
};
