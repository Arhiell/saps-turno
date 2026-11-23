
import {
  supabase,
} from '../config/supabase.js';

import {
  flattenPatient,
  patientAdminSelect,
  patientSelect,
  type PatientRow,
} from './patient-select.js';

// Obtiene los pacientes aplicando filtros, alcance y paginación.
export const findPatients = async (
  from: number,
  to: number,
  scope: string[] | null = null,
  search = '',
  status:
    | 'activo'
    | 'inactivo'
    | 'todos' = 'activo',
  includeAccount = false
) => {
  // Un alcance vacío significa que no hay salitas autorizadas.
  if (scope !== null && scope.length === 0) {
    return {
      patients: [],
      total: 0,
    };
  }

  let query = supabase
    .from('pacientes')
    .select(
      includeAccount
        ? patientAdminSelect
        : patientSelect,
      {
        count: 'exact',
      }
    );

  // Filtra los pacientes según su estado.
  if (status !== 'todos') {
    query = query.eq(
      'activo',
      status === 'activo'
    );
  }

  // Limita los resultados a las salitas permitidas.
  if (scope !== null) {
    query = query.in(
      'id_salita_asignada',
      scope
    );
  }

  // Cada término debe aparecer en el DNI, nombres o apellidos.
  const text = search.trim();

  const terms =
    /^[\d.\s-]+$/.test(text)
      ? [
          text.replace(/\D/g, ''),
        ].filter(Boolean)
      : text.match(
          /[\p{L}\p{M}\p{N}'’-]+/gu
        ) ?? [];

  if (terms.length) {
    const filters = terms.map((term) => {
      const pattern = JSON.stringify(`*${term}*`);

      return `or(dni.ilike.${pattern},nombres.ilike.${pattern},apellidos.ilike.${pattern})`;
    });

    // Aplica todos los términos antes de contar y paginar.
    query = query.or(
      `and(${filters.join(',')})`,
      {
        referencedTable: 'persona',
      }
    );
  } else if (text) {
    return {
      patients: [],
      total: 0,
    };
  }

  // Ordena y pagina los resultados.
  const {
    data,
    count,
    error,
  } = await query
    .order(
      'persona(apellidos)',
      {
        ascending: true,
      }
    )
    .order(
      'persona(nombres)',
      {
        ascending: true,
      }
    )
    .order(
      'id_paciente',
      {
        ascending: true,
      }
    )
    .range(from, to)
    .returns<PatientRow[]>();

  if (error) {
    throw error;
  }

  return {
    patients: (data ?? []).map(flattenPatient),
    total: count ?? 0,
  };
};

// Busca un paciente por su identificador.
export const findPatientById = async (
  idPatient: string,
  includeAccount = false
) => {
  const {
    data,
    error,
  } = await supabase
    .from('pacientes')
    .select(
      includeAccount
        ? patientAdminSelect
        : patientSelect
    )
    .eq(
      'id_paciente',
      idPatient
    )
    .returns<PatientRow[]>()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? flattenPatient(data)
    : null;
};

// Busca los datos de un paciente mediante su DNI.
export const findPatientDetailsByDni = async (
  dni: string,
  includeAccount = false
) => {
  const {
    data,
    error,
  } = await supabase
    .from('pacientes')
    .select(
      includeAccount
        ? patientAdminSelect
        : patientSelect
    )
    .eq(
      'persona.dni',
      dni
    )
    .returns<PatientRow[]>()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? flattenPatient(data)
    : null;
};

// Busca el perfil de paciente asociado a una persona.
export const findPatientByPersonId = async (
  idPerson: string
) => {
  const {
    data,
    error,
  } = await supabase
    .from('pacientes')
    .select(
      'id_paciente, id_persona, activo'
    )
    .eq(
      'id_persona',
      idPerson
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};
