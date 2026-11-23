import {
  supabase,
} from '../config/supabase.js';

import {
  personAccountSelect,
  type AccountDisplay,
} from './account-display.select.js';

import type {
  CreatePersonInput,
} from '../validators/person.validator.js';

// Representa la estructura devuelta por las consultas de profesionales.
interface ProfessionalRow {
  id_profesional: string;
  id_persona: string;
  matricula: string;
  activo: boolean;
  fecha_alta: string;
  fecha_baja: string | null;
  fecha_actualizacion: string;
  persona: CreatePersonInput & {
    id_persona: string;
    activo: boolean;
    cuenta?: AccountDisplay | null;
  };
}

// Define los datos básicos del profesional y su persona asociada.
const profesionalSelect = `
  id_profesional,
  id_persona,
  matricula,
  activo,
  fecha_alta,
  fecha_baja,
  fecha_actualizacion,
  persona:personas (
    id_persona,
    dni,
    nombres,
    apellidos,
    fecha_nacimiento,
    sexo,
    telefono,
    email,
    direccion,
    localidad,
    provincia,
    codigo_postal,
    activo
  )
`;

// Agrega los datos de cuenta para las consultas administrativas.
const profesionalAdminSelect =
  profesionalSelect.replace(
    'persona:personas (',
    `persona:personas (${personAccountSelect},`
  );

// Busca un profesional por matrícula o persona, incluyendo inactivos.
export const findProfesionalIdentity = async (
  field:
    | 'matricula'
    | 'id_persona',
  value: string
) => {
  const {
    data,
    error,
  } = await supabase
    .from('profesionales')
    .select(
      'id_profesional, id_persona'
    )
    .eq(
      field,
      value
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

// Obtiene los profesionales según el alcance indicado.
export const getAllProfesionales = async (
  scope: string[] | null = null,
  includeAccount = false
) => {
  let query =
    supabase
      .from('profesionales')
      .select(`
        ${
          includeAccount
            ? profesionalAdminSelect
            : profesionalSelect
        },
        salitas:profesional_salita (
          id_salita,
          activo,
          fecha_desde,
          fecha_hasta,
          salita:salitas (
            id_salita,
            nombre,
            activo
          )
        )
      `);

  // Limita los resultados al alcance permitido.
  if (scope !== null) {
    query = query.in(
      'id_profesional',
      scope
    );
  }

  const {
    data,
    error,
  } = await query
    .order(
      'fecha_alta',
      {
        ascending: false,
      }
    )
    .returns<ProfessionalRow[]>();

  if (error) {
    throw new Error(
      `Error consultando profesionales: ${error.message}`
    );
  }

  return data;
};

// Obtiene un profesional por su identificador.
export const getProfesionalById = async (
  id: string,
  includeAccount = false
) => {
  const {
    data,
    error,
  } = await supabase
    .from('profesionales')
    .select(
      includeAccount
        ? profesionalAdminSelect
        : profesionalSelect
    )
    .eq(
      'id_profesional',
      id
    )
    .returns<ProfessionalRow[]>()
    .maybeSingle();

  if (error) {
    throw new Error(
      `Error consultando profesional: ${error.message}`
    );
  }

  return data;
};

// Crea un nuevo profesional.
export const createProfesional = async (
  profesional: {
    id_persona: string;
    matricula: string;
    activo?: boolean;
    fecha_alta?: string;
    fecha_baja?: string | null;
  }
) => {
  const {
    data,
    error,
  } = await supabase
    .from('profesionales')
    .insert(
      profesional
    )
    .select(
      profesionalSelect
    )
    .single();

  if (error) {
    // Conserva el código UNIQUE para manejar el conflicto en el servicio.
    throw error;
  }

  return data;
};

// Actualiza los datos propios de un profesional.
export const updateProfesional = async (
  id: string,
  profesional: {
    id_persona?: string;
    matricula?: string;
    activo?: boolean;
    fecha_alta?: string;
    fecha_baja?: string | null;
  }
) => {
  const {
    data,
    error,
  } = await supabase
    .from('profesionales')
    .update(
      profesional
    )
    .eq(
      'id_profesional',
      id
    )
    .select(
      profesionalSelect
    )
    .maybeSingle();

  if (error) {
    // Conserva el código UNIQUE para manejar el conflicto en el servicio.
    throw error;
  }

  return data;
};

// Realiza la baja lógica del profesional.
export const deleteProfesional = async (
  id: string
) => {
  const {
    data,
    error,
  } = await supabase
    .from('profesionales')
    .update({
      activo: false,
      fecha_baja:
        new Date()
          .toISOString()
          .split('T')[0],
    })
    .eq(
      'id_profesional',
      id
    )
    .select(
      profesionalSelect
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Error eliminando profesional: ${error.message}`
    );
  }

  return data;
};