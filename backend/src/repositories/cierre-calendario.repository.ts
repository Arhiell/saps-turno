
import { supabase } from '../config/supabase.js';

import type {
  Cierre,
  CierreInput,
} from '../validators/cierre-calendario.validator.js';

import { rethrowTurnoError } from '../utils/turno-error.js';
import type { FeriadoExterno } from './argentinadatos.repository.js';

// Obtiene los cierres del calendario según los filtros indicados.
export const findCierres = async (
  scope: string[] | null,
  desde?: string,
  hasta?: string,
  activos = false
) => {
  const rows: Cierre[] = [];

  // Pagina los resultados para evitar el límite de PostgREST.
  for (let from = 0; ; from += 500) {
    let query = supabase
      .from('cierres_calendario')
      .select('*');

    // Filtra los cierres globales y los correspondientes a las salitas.
    if (scope !== null) {
      query = scope.length
        ? query.or(
            `alcance.eq.GLOBAL,id_salita.in.(${scope.join(',')})`
          )
        : query.eq('alcance', 'GLOBAL');
    }

    // Aplica los filtros de fechas y estado.
    if (desde) {
      query = query.gte('fecha_fin', desde);
    }

    if (hasta) {
      query = query.lte('fecha_inicio', hasta);
    }

    if (activos) {
      query = query.eq('activo', true);
    }

    const { data, error } = await query
      .order('fecha_inicio')
      .order('id_cierre')
      .range(from, from + 499);

    if (error) {
      throw error;
    }

    const page = (data ?? []) as Cierre[];

    rows.push(...page);

    // Finaliza cuando se obtiene la última página.
    if (page.length < 500) {
      return rows;
    }
  }
};

// Obtiene un cierre de calendario por su identificador.
export const findCierre = async (id: string) => {
  const { data, error } = await supabase
    .from('cierres_calendario')
    .select('*')
    .eq('id_cierre', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Cierre | null;
};

// Crea, actualiza o desactiva un cierre mediante una función RPC.
export const saveCierre = async (
  id: string | null,
  datos: CierreInput | { activo: false },
  usuario: string
) => {
  const { data, error } = await supabase.rpc(
    'guardar_cierre_calendario',
    {
      p_id: id,
      p_datos: datos,
      p_usuario: usuario,
    }
  );

  if (error) {
    rethrowTurnoError(error);
  }

  return data as Cierre | null;
};

// Obtiene los profesionales activos asociados a las salitas autorizadas.
export const findProfesionalesCierre = async (
  scope: string[] | null
) => {
  const ids = new Set<string>();

  // Evita consultar cuando no existen salitas autorizadas.
  if (scope?.length === 0) {
    return [];
  }

  // Recupera los profesionales mediante consultas paginadas.
  for (let from = 0; ; from += 500) {
    let query = supabase
      .from('profesional_salita')
      .select('id_profesional,id_salita')
      .eq('activo', true);

    if (scope) {
      query = query.in('id_salita', scope);
    }

    const { data, error } = await query
      .order('id_profesional')
      .order('id_salita')
      .range(from, from + 499);

    if (error) {
      throw error;
    }

    // Almacena identificadores únicos de profesionales.
    for (const row of data ?? []) {
      ids.add(row.id_profesional);
    }

    if ((data?.length ?? 0) < 500) {
      return [...ids];
    }
  }
}

// Representa el resultado de sincronización de un año.
export interface SyncYearResult {
  anio: number;
  estado: 'OK' | 'NO_DISPONIBLE' | 'ERROR';
  mensaje?: string;
  nuevos?: number;
  actualizados?: number;
  sin_cambios?: number;
  coincidencias_manuales?: number;
  turnos_pendientes?: number;
  no_recibidos_conservados?: number;
}

// Resume los resultados generales de sincronización.
export interface SyncSummary {
  estado: string;
  resultados?: SyncYearResult[];
}

// Representa el estado de la última sincronización.
export interface SyncStatus {
  ultimo_intento: string | null;
  ultimo_exito: string | null;
  modo: 'MANUAL' | 'AUTOMATICA' | null;
  resumen: SyncSummary;
}

// Consulta el estado de sincronización de ArgentinaDatos.
export const getCalendarioSync = async () => {
  const { data, error } = await supabase
    .from('calendario_sincronizacion')
    .select('ultimo_intento,ultimo_exito,modo,resumen')
    .eq('fuente', 'ARGENTINADATOS')
    .single();

  if (error) {
    throw error;
  }

  return data as SyncStatus;
};

// Solicita autorización para iniciar una sincronización.
export const claimCalendarioSync = async (
  manual: boolean,
  usuario: string | null
) => {
  const { data, error } = await supabase.rpc(
    'reclamar_calendario_sync',
    {
      p_manual: manual,
      p_usuario: usuario,
    }
  );

  if (error) {
    rethrowTurnoError(error);
  }

  return data as string | null;
};

// Aplica los feriados de un año mediante una función RPC.
export const applyFeriados = async (
  token: string,
  anio: number,
  filas: FeriadoExterno[]
) => {
  const { data, error } = await supabase.rpc(
    'aplicar_feriados_argentinadatos',
    {
      p_token: token,
      p_anio: anio,
      p_filas: filas,
    }
  );

  if (error) {
    rethrowTurnoError(error);
  }

  return data as SyncYearResult;
};

// Finaliza la sincronización y registra su resultado.
export const finishCalendarioSync = async (
  token: string,
  resumen: SyncSummary,
  exito: boolean
) => {
  const { data, error } = await supabase.rpc(
    'finalizar_calendario_sync',
    {
      p_token: token,
      p_resumen: resumen,
      p_exito: exito,
    }
  );

  if (error) {
    throw error;
  }

  // Verifica que la ejecución siga siendo válida.
  if (!data) {
    throw new Error(
      'La ejecución de sincronización venció; consultá el último estado'
    );
  }
};

// Obtiene los cierres importados que tienen turnos pendientes.
export const getCierresPendientes = async (
  scope: string[] | null
) => {
  const { data, error } = await supabase.rpc(
    'cierres_importados_pendientes',
    {
      p_salitas: scope,
    }
  );

  if (error) {
    throw error;
  }

  return (data ?? []) as {
    id_cierre: string;
    cantidad: number;
  }[];
};