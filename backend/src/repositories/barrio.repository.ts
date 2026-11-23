import {
   supabase
} from "../config/supabase.js";

// GET todos
export const getAllBarrios = async () => {
  const { data, error } = await supabase
    .from("barrios")
    .select(
      `
      id_barrio,
      id_zona,
      nombre,
      codigo_postal,
      activo,
      fecha_creacion,
      fecha_actualizacion
    `,
    )
    .order("nombre", { ascending: true });

  if (error) {
    throw new Error(`Error consultando barrios: ${error.message}`);
  }

  return data;
};

// GET por ID
export const getBarrioById = async (id: string) => {
  const { data, error } = await supabase
    .from("barrios")
    .select(
      `
      id_barrio,
      id_zona,
      nombre,
      codigo_postal,
      activo,
      fecha_creacion,
      fecha_actualizacion
    `,
    )
    .eq("id_barrio", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Error consultando barrio: ${error.message}`);
  }

  return data;
};

// POST
export const createBarrio = async (barrio: {
  id_zona: string;
  nombre: string;
  codigo_postal?: string | null;
  activo?: boolean;
}) => {
  const { data, error } = await supabase
    .from("barrios")
    .insert(barrio)
    .select(
      `
      id_barrio,
      id_zona,
      nombre,
      codigo_postal,
      activo,
      fecha_creacion,
      fecha_actualizacion
    `,
    )
    .single();

  if (error) {
    throw new Error(`Error creando barrio: ${error.message}`);
  }

  return data;
};

// PUT
export const updateBarrio = async (
  id: string,
  barrio: {
    id_zona?: string;
    nombre?: string;
    codigo_postal?: string | null;
    activo?: boolean;
  },
) => {
  const { data, error } = await supabase
    .from("barrios")
    .update(barrio)
    .eq("id_barrio", id)
    .select(
      `
      id_barrio,
      id_zona,
      nombre,
      codigo_postal,
      activo,
      fecha_creacion,
      fecha_actualizacion
    `,
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Error actualizando barrio: ${error.message}`);
  }

  return data;
};

// DELETE lógico
export const deleteBarrio = async (id: string) => {
  const { data, error } = await supabase
    .from("barrios")
    .update({ activo: false })
    .eq("id_barrio", id)
    .select(
      `
      id_barrio,
      id_zona,
      nombre,
      codigo_postal,
      activo,
      fecha_creacion,
      fecha_actualizacion
    `,
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Error eliminando barrio: ${error.message}`);
  }

  return data;
};
