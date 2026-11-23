import { supabase } from "../config/supabase.js";
import { agendaDayBounds } from '../utils/turno-time.js';
import { getSalitasByProfesional } from './profesional-salita.repository.js';

export const getHorariosParaDisponibilidad = async (
  idProfesional: string,
  idEspecialidad: string,
  idSalita: string,
  diaSemana: number,
  fecha: string
) => {
  const asociaciones = await getSalitasByProfesional(idProfesional, [idSalita], fecha);
  if (!asociaciones?.length) return [];

  const { data, error } = await supabase
    .from("horarios_atencion")
    .select(`
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
      activo
    `)
    .eq("id_profesional", idProfesional)
    .eq("id_especialidad", idEspecialidad)
    .eq("id_salita", idSalita)
    .eq("dia_semana", diaSemana)
    .eq("activo", true)
    .lte("vigencia_desde", fecha);

  if (error) {
    throw error;
  }

  return (data ?? []).filter((horario) => {
    return (
      horario.vigencia_hasta === null ||
      horario.vigencia_hasta >= fecha
    );
  });
};

export const getBloqueosParaDisponibilidad = async (
  idProfesional: string,
  idEspecialidad: string,
  idSalita: string,
  fecha: string
) => {
  const { data, error } = await supabase
    .from("bloqueos_agenda")
    .select(`
      id_bloqueo,
      id_profesional,
      id_salita,
      id_especialidad,
      fecha,
      hora_inicio,
      hora_fin,
      dia_completo,
      motivo,
      activo
    `)
    .eq("id_salita", idSalita)
    .eq("fecha", fecha)
    .eq("activo", true)
    .or(
      `id_profesional.is.null,id_profesional.eq.${idProfesional}`
    )
    .or(
      `id_especialidad.is.null,id_especialidad.eq.${idEspecialidad}`
    );

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const getTurnosParaDisponibilidad = async (
  idProfesional: string,
  idSalita: string,
  fecha: string
) => {
  // Usa el mismo día argentino que el conteo de cupos de la reserva.
  const { start: inicioDia, end: finDia } = agendaDayBounds(fecha);

  const { data, error } = await supabase
    .from("turnos")
    .select(`
      id_turno,
      id_profesional,
      id_salita,
      id_especialidad,
      fecha_hora_inicio,
      fecha_hora_fin,
      ocupa_agenda,
      estado:id_estado (
        id_estado,
        codigo,
        nombre
      )
    `)
    .eq("id_profesional", idProfesional)
    .eq("id_salita", idSalita)
    .eq("ocupa_agenda", true)
    .lt("fecha_hora_inicio", finDia)
    .gte("fecha_hora_fin", inicioDia);

  if (error) {
    throw error;
  }

  return data ?? [];
};
