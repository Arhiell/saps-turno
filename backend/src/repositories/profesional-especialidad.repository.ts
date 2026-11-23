import { supabase } from "../config/supabase.js";

const profesionalEspecialidadSelect = `
  id_profesional,
  id_especialidad,
  fecha_desde,
  fecha_hasta,
  activo,
  especialidad:especialidades (
    id_especialidad,
    nombre,
    descripcion,
    activo
  )
`;

export const getEspecialidadesByProfesional = async (
  idProfesional: string
) => {
  const { data, error } = await supabase
    .from("profesional_especialidad")
    .select(profesionalEspecialidadSelect)
    .eq("id_profesional", idProfesional)
    .order("fecha_desde", { ascending: false });

  if (error) {
    throw new Error(
      `Error consultando especialidades del profesional: ${error.message}`
    );
  }

  return data;
};

export const createProfesionalEspecialidad = async (
  relacion: {
    id_profesional: string;
    id_especialidad: string;
    fecha_desde?: string;
    fecha_hasta?: string | null;
  }
) => {
  const { data, error } = await supabase
    .from("profesional_especialidad")
    .insert(relacion)
    .select(profesionalEspecialidadSelect)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const updateProfesionalEspecialidad = async (
  idProfesional: string,
  idEspecialidad: string,
  relacion: {
    fecha_desde?: string;
    fecha_hasta?: string | null;
    activo?: boolean;
  }
) => {
  const { data, error } = await supabase
    .from("profesional_especialidad")
    .update(relacion)
    .eq("id_profesional", idProfesional)
    .eq("id_especialidad", idEspecialidad)
    .select(profesionalEspecialidadSelect)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

export const deleteProfesionalEspecialidad = async (
  idProfesional: string,
  idEspecialidad: string
) => {
  const { data, error } = await supabase
    .from("profesional_especialidad")
    .update({
      activo: false,
      fecha_hasta: new Date()
        .toISOString()
        .split("T")[0]
    })
    .eq("id_profesional", idProfesional)
    .eq("id_especialidad", idEspecialidad)
    .select(profesionalEspecialidadSelect)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};