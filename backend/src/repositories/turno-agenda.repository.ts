import { supabase } from '../config/supabase.js';

import { agendaDayBounds } from '../utils/turno-time.js';

// Comprueba intervalos abiertos por la derecha: dos turnos contiguos no se solapan.
export const findTurnoOverlap = async (
  column: 'id_profesional' | 'id_paciente',
  id: string,
  start: string,
  end: string,
  exclude?: string
) => {
  let query = supabase
    .from('turnos')
    .select('id_turno')
    .eq(column, id)
    .eq('ocupa_agenda', true)
    .lt('fecha_hora_inicio', end)
    .gt('fecha_hora_fin', start);

  // Excluye un turno específico de la búsqueda.
  if (exclude) {
    query = query.neq('id_turno', exclude);
  }

  const { data, error } = await query
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

// Busca un turno que impida reservar otro de la misma especialidad.
export const findOpenTurno = async (
  patient: string,
  specialty: string,
  exclude?: string
) => {
  let query = supabase
    .from('turnos')
    .select('id_turno')
    .eq('id_paciente', patient)
    .eq('id_especialidad', specialty)
    .eq('impide_otro_misma_especialidad', true);

  // Excluye el turno indicado, si corresponde.
  if (exclude) {
    query = query.neq('id_turno', exclude);
  }

  const { data, error } = await query
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

// Cuenta los turnos que ocupan un horario durante una fecha determinada.
export const countTurnosDelHorario = async (
  horario: string,
  date: string,
  exclude?: string
) => {
  // Obtiene los límites del día consultado.
  const bounds = agendaDayBounds(date);

  let query = supabase
    .from('turnos')
    .select('id_turno', {
      count: 'exact',
      head: true,
    })
    .eq('id_horario', horario)
    .eq('ocupa_agenda', true)
    .gte('fecha_hora_inicio', bounds.start)
    .lt('fecha_hora_inicio', bounds.end);

  // Excluye un turno específico del conteo.
  if (exclude) {
    query = query.neq('id_turno', exclude);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
};

// Busca una sanción vigente que afecte al paciente.
export const findTurnoSanction = async (
  patient: string,
  now = new Date().toISOString()
) => {
  const { data, error } = await supabase
    .from('sanciones')
    .select(
      'id_sancion,motivo,fecha_inicio,fecha_fin'
    )
    .eq('id_paciente', patient)
    .eq('anulada', false)
    .lte('fecha_inicio', now)
    .gt('fecha_fin', now)
    .order('fecha_fin', {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};