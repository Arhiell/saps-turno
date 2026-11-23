
import type {
  PatientListQuery
} from "../validators/patient-query.validator.js";

import {
  findPatientById,
  findPatientDetailsByDni,
  findPatients
} from "../repositories/patient-read.repository.js";

import {
  AppError
} from "../utils/app-error.js";

/**
 * Obtiene el listado paginado de pacientes,
 * aplicando los filtros y el alcance autorizado.
 */
export const getPatients = async (
  query: PatientListQuery,
  scope: string[] | null = null,
  includeAccount = false
) => {
  const {
    page,
    limit,
    id_salita
  } = query;

  // Si el usuario tiene un alcance limitado, no puede
  // consultar una salita que esté fuera de ese alcance.
  if (
    id_salita &&
    scope !== null &&
    !scope.includes(id_salita)
  ) {
    throw new AppError(
      "No tenés permisos para consultar pacientes de esa salita",
      403
    );
  }

  // Si se seleccionó una salita, se aplica ese filtro.
  // Si no, se conserva el alcance original del usuario.
  const effectiveScope: string[] | null =
    id_salita
      ? [id_salita]
      : scope;

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const result = await findPatients(
    from,
    to,
    effectiveScope,
    query.search,
    query.estado,
    includeAccount
  );

  const totalPages = Math.ceil(
    result.total / limit
  );

  return {
    patients: result.patients,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages
    }
  };
};

/**
 * Obtiene un paciente por ID.
 */
export const getPatientById = async (
  idPatient: string,
  includeAccount = false
) => {
  const patient = await findPatientById(
    idPatient,
    includeAccount
  );

  if (!patient) {
    throw new AppError(
      "Paciente no encontrado",
      404
    );
  }

  return patient;
};

/**
 * Obtiene un paciente por DNI.
 */
export const getPatientByDni = async (
  dni: string,
  includeAccount = false
) => {
  const patient = await findPatientDetailsByDni(
    dni,
    includeAccount
  );

  if (!patient) {
    throw new AppError(
      "Paciente no encontrado",
      404
    );
  }

  return patient;
};
