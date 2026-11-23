import { supabase } from "../config/supabase.js";

// GET todos
export const getAllZonas = async () => {
  const { data, error } = await supabase
    .from("zonas")
    .select(`
      id_zona,
      nombre,
      descripcion,
      activo,
      fecha_creacion,
      fecha_actualizacion
    `)
    .order("nombre", { ascending: true });

  if (error) {
    throw new Error(`Error consultando zonas: ${error.message}`);
  }

  return data;
};

// GET por ID
export const getZonaById = async (id: string) => {
  const { data, error } = await supabase
    .from("zonas")
    .select(`
      id_zona,
      nombre,
      descripcion,
      activo,
      fecha_creacion,
      fecha_actualizacion
    `)
    .eq("id_zona", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Error consultando zona: ${error.message}`);
  }

  return data;
};

// POST
export const createZona = async (zona: {
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
}) => {
  const { data, error } = await supabase
    .from("zonas")
    .insert(zona)
    .select(`
      id_zona,
      nombre,
      descripcion,
      activo,
      fecha_creacion,
      fecha_actualizacion
    `)
    .single();

  if (error) {
    throw new Error(`Error creando zona: ${error.message}`);
  }

  return data;
};

// PUT
export const updateZona = async (
  id: string,
  zona: {
    nombre?: string;
    descripcion?: string | null;
    activo?: boolean;
  }
) => {
  const { data, error } = await supabase
    .from("zonas")
    .update(zona)
    .eq("id_zona", id)
    .select(`
      id_zona,
      nombre,
      descripcion,
      activo,
      fecha_creacion,
      fecha_actualizacion
    `)
    .maybeSingle();

  if (error) {
    throw new Error(`Error actualizando zona: ${error.message}`);
  }

  return data;
};

// DELETE lógico
export const deleteZona = async (id: string) => {
  const { data, error } = await supabase
    .from("zonas")
    .update({ activo: false })
    .eq("id_zona", id)
    .select(`
      id_zona,
      nombre,
      descripcion,
      activo,
      fecha_creacion,
      fecha_actualizacion
    `)
    .maybeSingle();

  if (error) {
    throw new Error(`Error eliminando zona: ${error.message}`);
  }

  return data;
};