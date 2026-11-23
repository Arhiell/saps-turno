import { supabase } from "../config/supabase.js";

// GET todos
export const getAllSalitaBarrios = async () => {
  const { data, error } = await supabase
    .from("salita_barrios")
    .select(`
      id_salita,
      id_barrio,
      es_barrio_sede,
      activo,
      fecha_desde,
      fecha_hasta
    `)
    .order("fecha_desde", { ascending: true });

  if (error) {
    throw new Error(
      `Error consultando relaciones salita-barrio: ${error.message}`
    );
  }

  return data;
};

// GET por salita
export const getBarriosBySalita = async (idSalita: string) => {
  const { data, error } = await supabase
    .from("salita_barrios")
    .select(`
      id_salita,
      id_barrio,
      es_barrio_sede,
      activo,
      fecha_desde,
      fecha_hasta
    `)
    .eq("id_salita", idSalita)
    .order("fecha_desde", { ascending: true });

  if (error) {
    throw new Error(
      `Error consultando barrios de la salita: ${error.message}`
    );
  }

  return data;
};

// GET por barrio
export const getSalitasByBarrio = async (idBarrio: string) => {
  const { data, error } = await supabase
    .from("salita_barrios")
    .select(`
      id_salita,
      id_barrio,
      es_barrio_sede,
      activo,
      fecha_desde,
      fecha_hasta
    `)
    .eq("id_barrio", idBarrio)
    .order("fecha_desde", { ascending: true });

  if (error) {
    throw new Error(
      `Error consultando salitas del barrio: ${error.message}`
    );
  }

  return data;
};

// POST
export const createSalitaBarrio = async (relacion: {
  id_salita: string;
  id_barrio: string;
  es_barrio_sede?: boolean;
  activo?: boolean;
  fecha_desde: string;
  fecha_hasta?: string | null;
}) => {
  const { data, error } = await supabase
    .from("salita_barrios")
    .insert(relacion)
    .select(`
      id_salita,
      id_barrio,
      es_barrio_sede,
      activo,
      fecha_desde,
      fecha_hasta
    `)
    .single();

  if (error) {
    throw new Error(
      `Error creando relación salita-barrio: ${error.message}`
    );
  }

  return data;
};

// PUT
export const updateSalitaBarrio = async (
  idSalita: string,
  idBarrio: string,
  relacion: {
    es_barrio_sede?: boolean;
    activo?: boolean;
    fecha_desde?: string;
    fecha_hasta?: string | null;
  }
) => {
  const { data, error } = await supabase
    .from("salita_barrios")
    .update(relacion)
    .eq("id_salita", idSalita)
    .eq("id_barrio", idBarrio)
    .select(`
      id_salita,
      id_barrio,
      es_barrio_sede,
      activo,
      fecha_desde,
      fecha_hasta
    `)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Error actualizando relación salita-barrio: ${error.message}`
    );
  }

  return data;
};

// DELETE lógico
export const deleteSalitaBarrio = async (
  idSalita: string,
  idBarrio: string
) => {
  const { data, error } = await supabase
    .from("salita_barrios")
    .update({ activo: false })
    .eq("id_salita", idSalita)
    .eq("id_barrio", idBarrio)
    .select(`
      id_salita,
      id_barrio,
      es_barrio_sede,
      activo,
      fecha_desde,
      fecha_hasta
    `)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Error eliminando relación salita-barrio: ${error.message}`
    );
  }

  return data;
};