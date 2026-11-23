import { 
  findTurnoById, 
  findPatientIdsForTurnoSearch,
  findTurnos, 
  findTurnoState } from "../repositories/turno-read.repository.js";

import { 
  getTurnoScope, 
  assertTurnoScope 
} from "./turno-access.service.js";

import { 
  AppError 
} from "../utils/app-error.js";

import type { 
  AuthenticatedUser 
} from "../types/auth.types.js";

import type { 
  TurnoQuery 
} from "../validators/turno-query.validator.js";
import { getOwnEntity } from "./auth-profile.service.js";
import { resolveManagedPatient } from './patient-managed.service.js';

export const getTurno = async (id: string, user: AuthenticatedUser) => {
  
  const own = ["PACIENTE", "PROFESIONAL"].includes(user.rol) ? await getOwnEntity(user) : null;
  const scope = own ? null : await getTurnoScope(user);
 
  const turno = await findTurnoById(id);
  
  if (!turno) throw new AppError(
    "Turno no encontrado",
    404
  );

  assertTurnoScope(scope, turno.id_salita);
  if (user.rol === 'PACIENTE') await resolveManagedPatient(user, turno.id_paciente);
  else if (own && turno[own.key as "id_paciente" | "id_profesional"] !== own.id) {
    throw new AppError("No tiene permisos sobre este turno", 403);
  }

  // Las notas internas no tienen una política de publicación al paciente.
  return user.rol === 'PACIENTE' ? { ...turno, observaciones: null, cancelado_por: null } : turno;
};


export const getTurnoState = async (code: string) => {
  const state = await findTurnoState(code);

  if (!state) throw new AppError(
    "El estado del turno no existe o está inactivo",
    400);

  return state;
};

// Sin asignaciones no se consultan ni se cuentan turnos de otras salitas.
export const getTurnos = async (
  filters: TurnoQuery, 
  user: AuthenticatedUser) => {
     const own = ["PACIENTE", "PROFESIONAL"].includes(user.rol) ? await getOwnEntity(user) : null;
     const scope = own ? null : await getTurnoScope(user);
     if (user.rol === 'PACIENTE') {
       const patient = await resolveManagedPatient(user, filters.id_paciente);
       filters = { ...filters, id_paciente: patient.id_paciente };
     } else if (own) filters = { ...filters, [own.key]: own.id };
     
     if (filters.id_salita) assertTurnoScope(scope, filters.id_salita);
     
     const state = filters.estado ? await getTurnoState(filters.estado) : null;
     const patientIds = filters.search
      ? await findPatientIdsForTurnoSearch(filters.search, null)
      : null;
     
     if (filters.search && patientIds?.length === 0) {
      return {
        turnos: [],
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: 0,
          totalPages: 0
        }
      };
     }
     
     const result = scope?.length === 0 ? { turnos: [], total: 0 }
     : await findTurnos(
      filters, 
      scope, 
      state?.id_estado,
      patientIds
);

  return { 
    turnos: user.rol === 'PACIENTE'
      ? result.turnos.map(turno => ({ ...turno, observaciones: null, cancelado_por: null })) : result.turnos,
    pagination: { 
      page: filters.page, 
      limit: filters.limit,
    total: result.total, 
      totalPages: Math.ceil(result.total / filters.limit) 
    } 
  };
};
