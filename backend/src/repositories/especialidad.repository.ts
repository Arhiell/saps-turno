import {
  supabase
} from "../config/supabase.js";

// GET todos
export const getAllEspecialidades = async () => {
  const { data, error } = await supabase
    .from("especialidades")
    .select(
      `
      id_especialidad,
      codigo,
      nombre,
      descripcion,
      requiere_profesional,
      activo,
      fecha_creacion,
      fecha_actualizacion
    `,
    )
    .order("nombre", { ascending: true });

  if (error) {
    throw new Error(`Error consultando especialidades: ${error.message}`);
  }

  return data;
};

// GET por ID
export const getEspecialidadById = async (id: string) => {
  const { data, error } = await supabase
    .from("especialidades")
    .select(
      `
      id_especialidad,
      codigo,
      nombre,
      descripcion,
      requiere_profesional,
      activo,
      fecha_creacion,
      fecha_actualizacion
    `,
    )
    .eq("id_especialidad", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Error consultando especialidad: ${error.message}`);
  }

  return data;
};

// POST
export const createEspecialidad = async (especialidad: {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  requiere_profesional: boolean;
  activo?: boolean;
}) => {
  const { data, error } = await supabase
    .from("especialidades")
    .insert(especialidad)
    .select(
      `
      id_especialidad,
      codigo,
      nombre,
      descripcion,
      requiere_profesional,
      activo,
      fecha_creacion,
      fecha_actualizacion
    `,
    )
    .single();

  if (error) {
    throw new Error(`Error creando especialidad: ${error.message}`);
  }

  return data;
};

// PUT
export const updateEspecialidad = async (
  id: string,
  especialidad: {
    codigo?: string;
    nombre?: string;
    descripcion?: string | null;
    requiere_profesional?: boolean;
    activo?: boolean;
  },
) => {
  const { data, error } = await supabase
    .from("especialidades")
    .update(especialidad)
    .eq("id_especialidad", id)
    .select(
      `
      id_especialidad,
      codigo,
      nombre,
      descripcion,
      requiere_profesional,
      activo,
      fecha_creacion,
      fecha_actualizacion
    `,
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Error actualizando especialidad: ${error.message}`);
  }

  return data;
};

// DELETE lógico
export const deleteEspecialidad = async (id: string) => {
  const { data, error } = await supabase
    .from("especialidades")
    .update({ activo: false })
    .eq("id_especialidad", id)
    .select(
      `
      id_especialidad,
      codigo,
      nombre,
      descripcion,
      requiere_profesional,
      activo,
      fecha_creacion,
      fecha_actualizacion
    `,
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Error eliminando especialidad: ${error.message}`);
  }

  return data;
};
