
import {
  supabase,
} from '../config/supabase.js';

import {
  turnoSelect,
} from './turno-select.js';

import {
  agendaDayBounds,
} from '../utils/turno-time.js';

import type {
  TurnoRow,
  TurnoState,
} from '../types/turno.types.js';

import type {
  TurnoQuery,
} from '../validators/turno-query.validator.js';

const patientSearchTerms = (search: string) => {
  const text = search.trim();

  if (!text) {
    return [];
  }

  if (/^[\d.\s-]+$/.test(text)) {
    return [text.replace(/\D/g, '')].filter(Boolean);
  }

  return text.match(/[\p{L}\p{M}\p{N}'’-]+/gu) ?? [];
};

export const findPatientIdsForTurnoSearch = async (
  search: string,
  scope: string[] | null
) => {
  const terms = patientSearchTerms(search);

  if (terms.length === 0) {
    return [];
  }

  let query = supabase
    .from('pacientes')
    .select('id_paciente, persona:personas!inner(dni,nombres,apellidos)')
    .eq('activo', true);

  if (scope !== null) {
    if (scope.length === 0) {
      return [];
    }

    query = query.in('id_salita_asignada', scope);
  }

  const filters = terms.map((term) => {
    const pattern = JSON.stringify(`*${term}*`);

    return `or(dni.ilike.${pattern},nombres.ilike.${pattern},apellidos.ilike.${pattern})`;
  });

  const { data, error } = await query.or(
    `and(${filters.join(',')})`,
    { referencedTable: 'persona' }
  );

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => String(row.id_paciente));
};

// Busca un turno específico por su ID.
export const findTurnoById = async (
  id: string
) => {
  const {
    data,
    error,
  } = await supabase
    .from('turnos')
    .select(turnoSelect)
    .eq('id_turno', id)
    .returns<TurnoRow[]>()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

// Busca un estado de turno activo mediante su código.
export const findTurnoState = async (
  code: string
) => {
  const {
    data,
    error,
  } = await supabase
    .from('estados_turno')
    .select(
      'id_estado,codigo,nombre,ocupa_agenda,impide_otro_misma_especialidad,es_estado_final,activo'
    )
    .eq('codigo', code)
    .eq('activo', true)
    .returns<TurnoState[]>()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

// El alcance se aplica en la consulta,
// antes de contar o paginar.
export const findTurnos = async (
  filters: TurnoQuery,
  scope: string[] | null,
  stateId?: string,
  patientIds?: string[] | null,
  agenda?: {
    id_especialidad?: string | undefined;
  }
) => {
  // Construye la consulta base de turnos.
  let query = supabase
    .from('turnos')
    .select(
      agenda
        ? turnoSelect
            .replace(
              'estado:estados_turno(',
              'estado:estados_turno!inner('
            )
            .replace(
              'salita:salitas(id_salita,nombre)',
              'salita:salitas(id_salita,nombre,direccion)'
            )
        : turnoSelect +
            (
              filters.reprogramados === 'true'
                ? ', cambios:historial_turnos!inner(accion)'
                : ''
            ),
      {
        count: 'exact',
      }
    );

  // Limita los turnos a las salitas permitidas.
  if (scope) {
    query = query.in(
      'id_salita',
      scope
    );
  }

  if (patientIds) {
    query = query.in(
      'id_paciente',
      patientIds
    );
  }

  // Aplica filtros por paciente, profesional y salita.
  for (
    const key of [
      'id_paciente',
      'id_profesional',
      'id_salita',
    ] as const
  ) {
    if (filters[key]) {
      query = query.eq(
        key,
        filters[key]
      );
    }
  }

  // NUEVO: filtra por especialidad en el listado general.
  // La agenda mantiene su filtro específico más abajo.
  if (!agenda && filters.id_especialidad) {
    query = query.eq(
      'id_especialidad',
      filters.id_especialidad
    );
  }

  // Filtra por estado cuando fue especificado.
  if (stateId) {
    query = query.eq(
      'id_estado',
      stateId
    );
  }

  // Filtra solamente turnos que fueron reprogramados.
  if (
    !agenda &&
    filters.reprogramados === 'true'
  ) {
    query = query.eq(
      'cambios.accion',
      'REPROGRAMACION'
    );
  }

  // La lista de atención incluye solo
  // estados no finales del catálogo.
  if (agenda) {
    query = query
      .eq(
        'estado.es_estado_final',
        false
      )
      .not(
        'estado.codigo',
        'in',
        '(CANCELADO,REPROGRAMADO)'
      );

    // Conserva el filtro de especialidad de la agenda.
    if (agenda.id_especialidad) {
      query = query.eq(
        'id_especialidad',
        agenda.id_especialidad
      );
    }
  }

  // Filtra los turnos correspondientes al día indicado.
  if (filters.fecha_desde && filters.fecha_hasta) {
    query = query
      .gte('fecha_hora_inicio', agendaDayBounds(filters.fecha_desde).start)
      .lt('fecha_hora_inicio', agendaDayBounds(filters.fecha_hasta).end);
  } else if (filters.fecha) {
    const bounds = agendaDayBounds(
      filters.fecha
    );

    query = query
      .gte(
        'fecha_hora_inicio',
        bounds.start
      )
      .lt(
        'fecha_hora_inicio',
        bounds.end
      );
  }

  // Calcula el inicio de la página solicitada.
  const from =
    (filters.page - 1) *
    filters.limit;

  // Filtra únicamente turnos próximos.
  if (filters.periodo === 'proximos') {
    query = query.gte(
      'fecha_hora_inicio',
      new Date().toISOString()
    );
  }

  // Filtra únicamente turnos anteriores.
  if (filters.periodo === 'anteriores') {
    query = query.lt(
      'fecha_hora_inicio',
      new Date().toISOString()
    );
  }

  // Ordena, pagina y ejecuta la consulta.
  const {
    data,
    count,
    error,
  } = await query
    .order(
      'fecha_hora_inicio',
      {
        ascending: filters.orden !== 'desc',
      }
    )
    .order('id_turno')
    .range(
      from,
      from + filters.limit - 1
    )
    .returns<TurnoRow[]>();

  if (error) {
    throw error;
  }

  // Devuelve los turnos encontrados y el total.
  return {
    turnos: data ?? [],
    total: count ?? 0,
  };
};
