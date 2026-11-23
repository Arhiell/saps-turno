import { AppError } from "../utils/app-error.js";

import {
  findAuditorias,
  findAuditoriaById,
} from "../repositories/auditoria.repository.js";

import type {
  AuditoriaQuery,
} from "../validators/auditoria.validator.js";

export const getAuditorias = async (
  filters: AuditoriaQuery,
) => {
  return findAuditorias(filters);
};

export const getAuditoriaById = async (
  id: number,
) => {
  const auditoria = await findAuditoriaById(id);

  if (!auditoria) {
    throw new AppError(
      "El registro de auditoría no existe",
      404,
    );
  }

  return auditoria;
};
