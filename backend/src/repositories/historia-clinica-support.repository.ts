import { supabase } from '../config/supabase.js';
import { flattenPatient, patientSelect, type PatientRow } from './patient-select.js';

export interface ActiveCatalogSalita {
  id_salita: string;
  nombre: string;
}

export interface ActiveCatalogEspecialidad {
  id_especialidad: string;
  nombre: string;
}

export interface ActiveCatalogProfesional {
  id_profesional: string;
  matricula: string;
  nombres: string;
  apellidos: string;
}

export const listActiveSalitasCatalog = async (): Promise<ActiveCatalogSalita[]> => {
  const { data, error } = await supabase
    .from('salitas')
    .select('id_salita, nombre')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ActiveCatalogSalita[];
};

export const listActiveEspecialidadesCatalog = async (): Promise<ActiveCatalogEspecialidad[]> => {
  const { data, error } = await supabase
    .from('especialidades')
    .select('id_especialidad, nombre')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ActiveCatalogEspecialidad[];
};

export const listActiveProfesionalesCatalog = async (): Promise<ActiveCatalogProfesional[]> => {
  const { data, error } = await supabase
    .from('profesionales')
    .select('id_profesional, matricula, persona:personas!inner(nombres, apellidos)')
    .eq('activo', true);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => {
      const persona = Array.isArray(row.persona) ? row.persona[0] : row.persona;
      return {
        id_profesional: row.id_profesional as string,
        matricula: row.matricula as string,
        nombres: (persona?.nombres as string) ?? '',
        apellidos: (persona?.apellidos as string) ?? '',
      };
    })
    .sort((a, b) =>
      `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`, 'es')
    );
};

export const listUserAssignedSalitas = async (userId: string) => {
  const { data, error } = await supabase
    .from('usuario_salita')
    .select('id_salita, activo, fecha_desde, fecha_hasta, salita:salitas(id_salita, nombre, activo)')
    .eq('id_usuario', userId)
    .eq('activo', true);

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const findClinicalPatientsByScope = async (params: {
  from: number;
  to: number;
  salitaIds: string[];
  derivedPatientIds: string[];
  search?: string | undefined;
}) => {
  const { from, to, salitaIds, derivedPatientIds, search = '' } = params;

  if (salitaIds.length === 0 && derivedPatientIds.length === 0) {
    return { patients: [], total: 0 };
  }

  let query = supabase
    .from('pacientes')
    .select(patientSelect, { count: 'exact' })
    .eq('activo', true);

  if (salitaIds.length > 0 && derivedPatientIds.length > 0) {
    query = query.or(
      `id_salita_asignada.in.(${salitaIds.join(',')}),id_paciente.in.(${derivedPatientIds.join(',')})`
    );
  } else if (salitaIds.length > 0) {
    query = query.in('id_salita_asignada', salitaIds);
  } else {
    query = query.in('id_paciente', derivedPatientIds);
  }

  const text = search.trim();
  const terms = /^[\d.\s-]+$/.test(text)
    ? [text.replace(/\D/g, '')].filter(Boolean)
    : (text.match(/[\p{L}\p{M}\p{N}'’-]+/gu) ?? []);

  if (terms.length > 0) {
    const filters = terms.map((term) => {
      const pattern = JSON.stringify(`*${term}*`);
      return `or(dni.ilike.${pattern},nombres.ilike.${pattern},apellidos.ilike.${pattern})`;
    });
    query = query.or(`and(${filters.join(',')})`, { referencedTable: 'personas' });
  }

  const { data, count, error } = await query
    .order('fecha_registro', { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  const patients = ((data ?? []) as unknown as PatientRow[]).map(flattenPatient);
  return {
    patients,
    total: count ?? patients.length,
  };
};

export const findActiveDerivedPatientIdsForSalitas = async (
  salitaIds: string[],
  today: string
): Promise<string[]> => {
  if (salitaIds.length === 0) return [];
  const { data, error } = await supabase
    .from('derivaciones_autorizaciones_clinicas')
    .select('id_paciente')
    .in('id_salita_destino', salitaIds)
    .eq('estado', 'AUTORIZADA')
    .lte('fecha_desde', today)
    .gte('fecha_hasta', today);

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => row.id_paciente as string);
};
