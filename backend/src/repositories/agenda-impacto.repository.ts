
import { supabase } from '../config/supabase.js';
import { turnoSelect } from './turno-select.js';
import type { TurnoRow } from '../types/turno.types.js';
import { rethrowTurnoError } from '../utils/turno-error.js';

// Obtiene todos los turnos afectados por un cambio de agenda.
export const findAgendaAffected = async (
  tipo: 'horario' | 'bloqueo' | 'cierre',
  datos: object
) => {
  const rows: TurnoRow[] = [];

  // Pagina los resultados para evitar el límite de registros de PostgREST.
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .rpc(tipo === 'cierre' ? 'cierre_turnos_afectados' : 'agenda_turnos_afectados',
        tipo === 'cierre' ? { p_datos: datos } : { p_tipo: tipo, p_datos: datos })
      .select(
        turnoSelect.replace(
          'dni,nombres,apellidos',
          'nombres,apellidos'
        )
      )
      .order('fecha_hora_inicio')
      .order('id_turno')
      .range(from, from + 499);

    if (error) {
      throw error;
    }

    const page = (data ?? []) as unknown as TurnoRow[];

    rows.push(...page);

    // Finaliza cuando no quedan más registros por consultar.
    if (page.length < 500) {
      return rows;
    }
  }
};

// Guarda cambios de horarios, bloqueos o turnos en la agenda.
export const saveAgenda = async <T>(
  tipo: 'horario' | 'bloqueo' | 'turno',
  id: string | null,
  datos: object,
  usuario: string,
  version: number | null = null,
  motivo: string | null = null
): Promise<T | null> => {
  const { data, error } = await supabase.rpc('guardar_agenda', {
    p_tipo: tipo,
    p_id: id,
    p_datos: datos,
    p_usuario: usuario,
    p_version: version,
    p_motivo: motivo,
  });

  // Procesa los errores de la operación.
  if (error) {
    rethrowTurnoError(error);
  }

  return data as T | null;
};
