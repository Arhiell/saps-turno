
import { supabase } from "../config/supabase.js";

// Campos utilizados para consultar los bloqueos de agenda.
const bloqueoSelect = `
  id_bloqueo,
  id_profesional,
  id_salita,
  id_especialidad,
  fecha,
  hora_inicio,
  hora_fin,
  dia_completo,
  motivo,
  creado_por,
  activo,
  fecha_creacion
`;

// Obtiene los bloqueos de agenda según las salitas autorizadas.
export const getAllBloqueos = async (
  scope: string[] | null = null
) => {
  let query = supabase
    .from("bloqueos_agenda")
    .select(bloqueoSelect);

  // Filtra los bloqueos por las salitas permitidas.
  if (scope !== null) {
    query = query.in("id_salita", scope);
  }

  const { data, error } = await query
    .order("fecha", { ascending: true })
    .order("hora_inicio", {
      ascending: true,
      nullsFirst: true,
    });

  if (error) {
    throw error;
  }

  return data;
};

// Obtiene un bloqueo de agenda por su identificador.
export const getBloqueoById = async (id: string) => {
  const { data, error } = await supabase
    .from("bloqueos_agenda")
    .select(bloqueoSelect)
    .eq("id_bloqueo", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

// Busca bloqueos que afecten a un turno específico.
export const findBloqueoParaTurno = async (
  profesional: string,
  especialidad: string,
  salita: string,
  fecha: string,
  inicio: string,
  fin: string
) => {
  // Un bloqueo sin profesional o especialidad afecta a toda la salita en ese ámbito.
  const { data, error } = await supabase
    .from("bloqueos_agenda")
    .select("id_bloqueo")
    .eq("activo", true)
    .eq("id_salita", salita)
    .eq("fecha", fecha)
    .or(
      `and(or(id_profesional.is.null,id_profesional.eq.${profesional}),` +
      `or(id_especialidad.is.null,id_especialidad.eq.${especialidad}),` +
      `or(dia_completo.eq.true,and(hora_inicio.lt.${fin},hora_fin.gt.${inicio})))`
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};
