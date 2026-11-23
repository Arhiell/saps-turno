import { supabase } from "../config/supabase.js";
import type { UpdatePersonInput } from "../validators/person.validator.js";
import { personSelect } from "./person-read.repository.js";

export const updatePerson = async (idPerson: string, input: UpdatePersonInput) => {
  const { data, error } = await supabase.from("personas").update(input)
    .eq("id_persona", idPerson).select(personSelect).single();
  if (error) throw error;
  return data;
};