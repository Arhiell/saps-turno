import { readFileSync } from 'node:fs';
import { supabase } from '../config/supabase.js';
import { AppError } from '../utils/app-error.js';
import { esReporteSecciones, type ReporteSecciones } from '../types/reporte-agenda.types.js';

// El recurso pertenece al backend y también está disponible al ejecutar dist/.
export const reportLogo = readFileSync(new URL('../../assets/cora-logo.png', import.meta.url));
export const reportDate = (value: string) => value.split('-').reverse().join('/');
export const reportTimestamp = () => new Date().toLocaleString('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires', hour12: false,
}) + ' (Argentina)';

export const reportScopeLabel = async (salita: string | undefined, scope: string[] | null) => {
  if (scope?.length === 0) return ['Salitas: sin asignaciones vigentes'];
  if (!salita && scope === null) return ['Salitas: todas las salitas'];
  let query = supabase.from('salitas').select('nombre,direccion').order('nombre');
  if (salita) query = query.eq('id_salita', salita);
  else if (scope) query = query.in('id_salita', scope);
  const { data, error } = await query;
  if (error) throw new AppError('No se pudieron obtener los datos de la salita del reporte', 500);
  return data?.length ? data.map(row => `Salita: ${row.nombre}${row.direccion ? ` · ${row.direccion}` : ''}`)
    : ['Salita: sin datos disponibles'];
};

// Los exportadores comparten el mismo contenido; solo cambia la presentación.
export const reportDocument = (data: unknown, title: string): ReporteSecciones => {
  if (esReporteSecciones(data)) return { ...data, generado: data.generado ?? reportTimestamp() };
  const rows = (Array.isArray(data) ? data : data ? [data] : []) as Record<string, unknown>[];
  const keys = Object.keys(rows[0] ?? {});
  return { generado: reportTimestamp(), secciones: [{
    cabecera: ['CORA · Salud municipal', title], columnas: keys,
    filas: rows.map(row => keys.map(key => {
      const value = row[key];
      return typeof value === 'number' ? value : typeof value === 'object' && value !== null
        ? JSON.stringify(value) : String(value ?? '');
    })), pie: rows.length ? [] : ['No hay registros para los filtros seleccionados.'],
  }] };
};
