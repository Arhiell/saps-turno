import { AppError } from "../utils/app-error.js";

import {
  createSancion,
  anularSancion,
} from "../repositories/sancion.repository.js";

import {
  findSancionById,
  findSanciones,
} from "../repositories/sancion-read.repository.js";

import type {
  CreateSancionInput,
  SancionQuery,
} from "../validators/sancion.validator.js";

// Registra la restricción; PostgreSQL verifica turno/paciente/especialidad.
export const registerSancion = async (
  input: CreateSancionInput,
  idUsuario?: string | null,
) => {
  return createSancion({
    ...input,
    creado_por: idUsuario ?? null,
  });
};

export const getSancionById = async (
  id: string,
) => {
  const sancion = await findSancionById(id);

  if (!sancion) {
    throw new AppError(
      "La sanción no existe",
      404,
    );
  }

  return sancion;
};

export const getSanciones = async (
  filters: SancionQuery,
) => {
  return findSanciones(filters);
};

export const cancelSancion = async (
  id: string,
  motivo: string,
  idUsuario?: string | null,
) => {
  const actual = await getSancionById(id);

  if (actual.anulada) {
    throw new AppError(
      "La sanción ya se encuentra anulada",
      409,
    );
  }

  const result = await anularSancion(
    id,
    motivo,
    idUsuario,
  );

  if (!result) {
    throw new AppError(
      "No fue posible anular la sanción",
      409,
    );
  }

  return result;
};
