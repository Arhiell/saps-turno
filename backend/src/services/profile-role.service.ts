import {
  findProfesionalIdentity,
  getProfesionalById,
} from '../repositories/profesional.repository.js';

import {
  getEspecialidadesByProfesional,
} from '../repositories/profesional-especialidad.repository.js';

import {
  getSalitasByProfesional,
} from '../repositories/profesional-salita.repository.js';

import {
  findProfileAssignments,
} from '../repositories/profile-assignment.repository.js';

// Define los datos básicos de una entidad.
type NamedEntity = {
  nombre: string;
  activo: boolean;
};

// Define el período de vigencia de una asignación.
type Assignment = {
  activo: boolean;
  fecha_desde: string;
  fecha_hasta: string | null;
};

// Normaliza una entidad que puede recibirse como objeto o arreglo.
const entity = (
  value: NamedEntity | NamedEntity[] | null
): NamedEntity | null =>
  Array.isArray(value)
    ? value[0] ?? null
    : value;

// Obtiene la información del perfil según el rol del usuario.
export const getProfileRoleInfo = async (
  role: string,
  userId: string,
  personId: string | null
) => {
  // Obtiene la fecha actual de Argentina.
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date());

  // Comprueba si una asignación se encuentra vigente.
  const current = (row: Assignment) =>
    row.activo &&
    row.fecha_desde <= today &&
    (!row.fecha_hasta || row.fecha_hasta >= today);

  // Obtiene las salitas asignadas al administrador o recepcionista.
  if (role === 'ADMIN_SALITA' || role === 'RECEPCION') {
    const rows = await findProfileAssignments(userId);

    return {
      professional: null,
      clinics: rows
        .filter(current)
        .flatMap(row => {
          const clinic = entity(row.salita);

          return clinic
            ? [{
                name: clinic.nombre,
                primary: row.es_principal,
                active: clinic.activo,
              }]
            : [];
        }),
    };
  }

  // Devuelve datos vacíos si no corresponde a un profesional.
  if (role !== 'PROFESIONAL' || !personId) {
    return {
      professional: null,
      clinics: [],
    };
  }

  // Busca el profesional asociado a la persona.
  const identity = await findProfesionalIdentity(
    'id_persona',
    personId
  );

  if (!identity) {
    return {
      professional: null,
      clinics: [],
    };
  }

  // Obtiene los datos, especialidades y salitas del profesional.
  const [professional, specialties, clinics] = await Promise.all([
    getProfesionalById(identity.id_profesional),
    getEspecialidadesByProfesional(identity.id_profesional),
    getSalitasByProfesional(identity.id_profesional),
  ]);

  // Devuelve la información profesional y sus asignaciones vigentes.
  return {
    professional: professional
      ? {
          license: professional.matricula,
          active: professional.activo,
          specialties: specialties
            .filter(current)
            .flatMap(row => {
              const specialty = entity(row.especialidad);

              return specialty?.activo
                ? [specialty.nombre]
                : [];
            }),
        }
      : null,

    clinics: clinics
      .filter(current)
      .flatMap(row => {
        const clinic = entity(row.salita);

        return clinic
          ? [{
              name: clinic.nombre,
              primary: false,
              active: clinic.activo,
            }]
          : [];
      }),
  };
};