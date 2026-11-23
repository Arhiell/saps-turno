import type { 
  AuthenticatedUser 
} from "../types/auth.types.js";

import { 
  findTurnoSalitasForUser 
} from "../repositories/turno-access.repository.js";

import { 
  agendaDateTime 
} from "../utils/turno-time.js";

import {
   AppError 
  } from "../utils/app-error.js";

// SUPER_ADMIN es global; administración y recepción operan solo sus salitas vigentes.
export const getTurnoScope = async (user: AuthenticatedUser): Promise<string[] | null> => {
  if (user.rol === "SUPER_ADMIN") return null;

  if (!["ADMIN_SALITA", "RECEPCION"].includes(user.rol)) {
    throw new AppError("No tiene permisos para gestionar turnos", 403);
  }

  return findTurnoSalitasForUser(
    user.id_usuario, 
    agendaDateTime(
      new Date()).date
    );
};

export const assertTurnoScope = (scope: string[] | null, salita: string) => {

  if (scope !== null && !scope.includes(salita)) {
    throw new AppError(
      "No tiene permisos sobre los turnos de esta salita", 403
    );
  }
};
