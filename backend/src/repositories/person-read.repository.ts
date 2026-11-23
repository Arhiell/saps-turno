import { literalLikePattern } from "../utils/like-pattern.js";
import { supabase } from "../config/supabase.js";

export const personSelect = `
  id_persona, dni, nombres, apellidos, fecha_nacimiento, sexo,
  telefono, email, direccion, localidad, provincia, codigo_postal
`;

export const findPersonByDni = async (dni: string) => {
  const { data, error } = await supabase.from("personas")
    .select(personSelect).eq("dni", dni).maybeSingle();
  if (error) throw error;
  return data;
};

export const findPersonById = async (idPerson: string) => {
  const { data, error } = await supabase.from("personas")
    .select(personSelect).eq("id_persona", idPerson).maybeSingle();
  if (error) throw error;
  return data;
};

export const findPersonsByEmail = async (email: string) => {
  const { data, error } = await supabase.from("personas").select("id_persona")
    .ilike("email", literalLikePattern(email));
  if (error) throw error;
  return data ?? [];
};
