
import { supabase } from "../config/supabase.js";

// Campos utilizados para consultar los horarios de atención.
const horarioSelect = `
  id_horario,
  id_profesional,
  id_especialidad,
  id_salita,
  dia_semana,
  hora_inicio,
  hora_fin,
  duracion_turno_minutos,
  cupo_maximo_diario,
  vigencia_desde,
  vigencia_hasta,
  activo,
  fecha_creacion,
  fecha_actualizacion
`;

// Obtiene los horarios de atención según las salitas autorizadas.
export const getAllHorarios = async (
  scope: string[] | null = null
) => {
  let query = supabase
    .from("horarios_atencion")
    .select(horarioSelect);

  // Filtra los horarios por las salitas permitidas.
  if (scope !== null) {
    query = query.in("id_salita", scope);
  }

  const { data, error } = await query
    .order("dia_semana", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
};

// Obtiene un horario de atención por su identificador.
export const getHorarioById = async (id: string) => {
  const { data, error } = await supabase
    .from("horarios_atencion")
    .select(horarioSelect)
    .eq("id_horario", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

// Busca horarios candidatos para un turno específico.
export const findHorariosParaTurno = async (
  profesional: string,
  especialidad: string,
  salita: string,
  dia: number,
  fecha: string
) => {
  // Turnos valida posteriormente la franja horaria y su duración.
  const { data, error } = await supabase
    .from("horarios_atencion")
    .select(horarioSelect)
    .eq("id_profesional", profesional)
    .eq("id_especialidad", especialidad)
    .eq("id_salita", salita)
    .eq("dia_semana", dia)
    .eq("activo", true)
    .lte("vigencia_desde", fecha)
    .or(`vigencia_hasta.is.null,vigencia_hasta.gte.${fecha}`);

  if (error) {
    throw error;
  }

  return data ?? [];
};
