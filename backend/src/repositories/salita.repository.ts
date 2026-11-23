import {
  supabase,
} from '../config/supabase.js';

import {
  accountDisplaySelect,
  type AccountDisplay,
} from './account-display.select.js';

// Define los campos visibles de una salita.
const salitaSelect = `
  id_salita,
  codigo,
  nombre,
  direccion,
  id_barrio,
  telefono,
  email,
  latitud,
  longitud,
  horario_apertura,
  horario_cierre,
  activo,
  fecha_creacion,
  fecha_actualizacion
`;

// Representa una salita con sus administradores cuando corresponde.
type SalitaDisplayRow =
  NonNullable<
    Awaited<
      ReturnType<
        typeof getSalitaById
      >
    >
  > & {
    administradores?: {
      cuenta:
        AccountDisplay | null;
    }[];
  };

// Agrega las cuentas de administradores solo para consultas autorizadas.
const administrativeSalitaSelect = `
  ${salitaSelect},
  administradores:usuario_salita (
    cuenta:usuarios!inner (
      ${accountDisplaySelect}
    )
  )
`;

// Obtiene todas las salitas.
export const getAllSalitas = async (
  includeAccounts = false
) =>
  getSalitasByIds(
    null,
    includeAccounts
  );

// Obtiene las salitas indicadas o todas cuando no se especifican IDs.
export const getSalitasByIds = async (
  ids: string[] | null,
  includeAccounts = false
) => {
  if (ids?.length === 0) {
    return [];
  }

  let query =
    supabase
      .from('salitas')
      .select(
        includeAccounts
          ? administrativeSalitaSelect
          : salitaSelect
      );

  // Limita la consulta a las salitas solicitadas.
  if (ids !== null) {
    query = query.in(
      'id_salita',
      ids
    );
  }

  // Incluye únicamente administradores activos de salita.
  if (includeAccounts) {
    query = query
      .eq(
        'administradores.activo',
        true
      )
      .eq(
        'administradores.cuenta.rol.codigo',
        'ADMIN_SALITA'
      );
  }

  const {
    data,
    error,
  } = await query
    .order(
      'nombre',
      {
        ascending: true,
      }
    )
    .returns<
      SalitaDisplayRow[]
    >();

  if (error) {
    throw error;
  }

  return data;
};

// Obtiene una salita por su identificador.
export const getSalitaById = async (
  id: string
) => {
  const {
    data,
    error,
  } = await supabase
    .from('salitas')
    .select(salitaSelect)
    .eq(
      'id_salita',
      id
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Error consultando salita: ${error.message}`
    );
  }

  return data;
};

// Crea una nueva salita.
export const createSalita = async (
  salita: {
    codigo: string;
    nombre: string;
    direccion: string;
    id_barrio: string;
    telefono?: string | null;
    email?: string | null;
    latitud?: number | null;
    longitud?: number | null;
    horario_apertura?: string | null;
    horario_cierre?: string | null;
    activo?: boolean;
  }
) => {
  const {
    data,
    error,
  } = await supabase
    .from('salitas')
    .insert(salita)
    .select(salitaSelect)
    .single();

  if (error) {
    throw new Error(
      `Error creando salita: ${error.message}`
    );
  }

  return data;
};

// Actualiza los datos de una salita.
export const updateSalita = async (
  id: string,
  salita: {
    codigo?: string;
    nombre?: string;
    direccion?: string;
    id_barrio?: string;
    telefono?: string | null;
    email?: string | null;
    latitud?: number | null;
    longitud?: number | null;
    horario_apertura?: string | null;
    horario_cierre?: string | null;
    activo?: boolean;
  }
) => {
  const {
    data,
    error,
  } = await supabase
    .from('salitas')
    .update(salita)
    .eq(
      'id_salita',
      id
    )
    .select(salitaSelect)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Error actualizando salita: ${error.message}`
    );
  }

  return data;
};

// Realiza la baja lógica de una salita.
export const deleteSalita = async (
  id: string
) => {
  const {
    data,
    error,
  } = await supabase
    .from('salitas')
    .update({
      activo: false,
    })
    .eq(
      'id_salita',
      id
    )
    .select(salitaSelect)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Error eliminando salita: ${error.message}`
    );
  }

  return data;
};