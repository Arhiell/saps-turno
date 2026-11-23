import { supabase } from "../config/supabase.js";
import { agendaDateTime } from '../utils/turno-time.js';

const profesionalSalitaSelect = `
  id_profesional,
  id_salita,
  fecha_desde,
  fecha_hasta,
  activo,
  salita:salitas (
    id_salita,
    codigo,
    nombre,
    direccion,
    id_barrio,
    telefono,
    email,
    latitud,
    longitud,
    horario_apertura,
    horario_cierre,
    activo
  )
`;

export const getSalitasByProfesional = async (
  idProfesional: string, scope: string[] | null = null, fecha?: string
) => {
  let query = supabase
    .from("profesional_salita")
    .select(profesionalSalitaSelect)
    .eq("id_profesional", idProfesional)
  if (scope !== null) query = query.in("id_salita", scope);
  // Sin fecha conserva el historial; con fecha devuelve solo asociaciones vigentes.
  if (fecha !== undefined) {
    query = query.eq("activo", true).lte("fecha_desde", fecha)
      .or(`fecha_hasta.is.null,fecha_hasta.gte.${fecha}`);
  }
  const { data, error } = await query.order("fecha_desde", { ascending: false });

  if (error) {
    throw new Error(
      `Error consultando salitas del profesional: ${error.message}`
    );
  }

  return data;
};

export const createProfesionalSalita = async (
  relacion: {
    id_profesional: string;
    id_salita: string;
    fecha_desde?: string;
    fecha_hasta?: string | null;
  }
) => {
  const { data, error } = await supabase
    .from("profesional_salita")
    .insert(relacion)
    .select(profesionalSalitaSelect)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const updateProfesionalSalita = async (
  idProfesional: string,
  idSalita: string,
  relacion: {
    fecha_desde?: string;
    fecha_hasta?: string | null;
    activo?: boolean;
  }
) => {
  const { data, error } = await supabase
    .from("profesional_salita")
    .update(relacion)
    .eq("id_profesional", idProfesional)
    .eq("id_salita", idSalita)
    .select(profesionalSalitaSelect)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

export const deleteProfesionalSalita = async (
  idProfesional: string,
  idSalita: string
) => {
  const { data, error } = await supabase
    .from("profesional_salita")
    .update({
      activo: false,
      fecha_hasta: agendaDateTime(new Date()).date
    })
    .eq("id_profesional", idProfesional)
    .eq("id_salita", idSalita)
    .select(profesionalSalitaSelect)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};
