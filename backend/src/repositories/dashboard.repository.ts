import { supabase } from '../config/supabase.js';
import { AppError } from '../utils/app-error.js';

// Cuenta registros en PostgreSQL sin descargar listados ni duplicar asignaciones.
export async function countDashboardRecords(table: string, active: boolean, role?: string) {
  let query = supabase.from(table).select(
    role ? 'id_usuario,rol:roles!inner(codigo)' : '*',
    { count: 'exact', head: true },
  ).eq('activo', active);
  if (role) query = query.eq('rol.codigo', role);
  const { count, error } = await query;
  if (error || count === null) throw new AppError('No se pudieron obtener los totales del sistema', 500);
  return count;
}

export async function countDashboardTurnos(
  start: string, end: string, field: 'fecha_solicitud' | 'fecha_hora_inicio', state?: string,
) {
  let query = supabase.from('turnos').select(
    state ? 'id_turno,estado:estados_turno!turnos_id_estado_fkey!inner(codigo)' : 'id_turno',
    { count: 'exact', head: true },
  ).gte(field, start).lt(field, end);
  // Los estados históricos también cuentan aunque su catálogo se desactive.
  if (state) query = query.eq('estado.codigo', state);
  const { count, error } = await query;
  if (error || count === null) throw new AppError('No se pudieron obtener los indicadores de turnos', 500);
  return count;
}

export async function findDashboardActivity() {
  // Nunca enviar los datos anteriores/nuevos ni información clínica al resumen.
  const { data, error } = await supabase.from('auditoria')
    .select('id_auditoria,entidad,accion,fecha')
    .order('fecha', { ascending: false }).order('id_auditoria', { ascending: false }).limit(8);
  if (error) throw new AppError('No se pudo obtener la actividad reciente', 500);
  return data ?? [];
}
