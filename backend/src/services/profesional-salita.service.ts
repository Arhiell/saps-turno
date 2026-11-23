import {
  getSalitasByProfesional,
  createProfesionalSalita,
  updateProfesionalSalita,
  deleteProfesionalSalita
} from "../repositories/profesional-salita.repository.js";

import {
  createProfesionalSalitaSchema,
  updateProfesionalSalitaSchema,
  type CreateProfesionalSalitaInput,
  type UpdateProfesionalSalitaInput
} from "../validators/profesional-salita.validator.js";

import { hasDatabaseCode } from "../utils/profile-error.js";
import { AppError } from "../utils/app-error.js";
import { emitirCambioProfesional, emitirCambioSalita } from "./socket.service.js";

export const getSalitasProfesional = async (
  idProfesional: string, scope: string[] | null = null
) => {
  return await getSalitasByProfesional(idProfesional, scope);
};

export const agregarSalitaProfesional = async (
  idProfesional: string,
  input: CreateProfesionalSalitaInput
) => {
  const validated =
    createProfesionalSalitaSchema.parse(input);

  if (
    validated.fecha_desde !== undefined &&
    validated.fecha_hasta !== undefined &&
    validated.fecha_hasta !== null &&
    validated.fecha_hasta < validated.fecha_desde
  ) {
    throw new AppError(
      "La fecha_hasta no puede ser anterior a fecha_desde",
      400
    );
  }

  const relacion: {
    id_profesional: string;
    id_salita: string;
    fecha_desde?: string;
    fecha_hasta?: string | null;
  } = {
    id_profesional: idProfesional,
    id_salita: validated.id_salita
  };

  if (validated.fecha_desde !== undefined) {
    relacion.fecha_desde = validated.fecha_desde;
  }

  if (validated.fecha_hasta !== undefined) {
    relacion.fecha_hasta = validated.fecha_hasta;
  }

  try {
    const created = await createProfesionalSalita(relacion);
    try {
      emitirCambioProfesional({
        tipo: 'PROFESIONAL_ACTUALIZADO',
        mensaje: 'Salita asignada a profesional',
        id_profesional: idProfesional,
        id_salita: validated.id_salita,
      });
      emitirCambioSalita({
        tipo: 'DISPONIBILIDAD_ACTUALIZADA',
        mensaje: 'Profesional asignado a salita',
        id_salita: validated.id_salita,
      });
    } catch {
      // Notificación complementaria
    }
    return created;
  } catch (error) {
    if (hasDatabaseCode(error, "23505")) {
      throw new AppError(
        "El profesional ya está asignado a esta salita",
        409
      );
    }

    if (hasDatabaseCode(error, "23503")) {
      throw new AppError(
        "El profesional o la salita no existen",
        404
      );
    }

    throw error;
  }
};

export const actualizarSalitaProfesional = async (
  idProfesional: string,
  idSalita: string,
  input: UpdateProfesionalSalitaInput
) => {
  const validated =
    updateProfesionalSalitaSchema.parse(input);

  if (
    validated.fecha_desde !== undefined &&
    validated.fecha_hasta !== undefined &&
    validated.fecha_hasta !== null &&
    validated.fecha_hasta < validated.fecha_desde
  ) {
    throw new AppError(
      "La fecha_hasta no puede ser anterior a fecha_desde",
      400
    );
  }

  const relacion: {
    fecha_desde?: string;
    fecha_hasta?: string | null;
    activo?: boolean;
  } = {};

  if (validated.fecha_desde !== undefined) {
    relacion.fecha_desde = validated.fecha_desde;
  }

  if (validated.fecha_hasta !== undefined) {
    relacion.fecha_hasta = validated.fecha_hasta;
  }

  if (validated.activo !== undefined) {
    relacion.activo = validated.activo;
  }

  const updated = await updateProfesionalSalita(
    idProfesional,
    idSalita,
    relacion
  );
  try {
    emitirCambioProfesional({
      tipo: 'PROFESIONAL_ACTUALIZADO',
      mensaje: 'Asignación de salita actualizada',
      id_profesional: idProfesional,
      id_salita: idSalita,
    });
    emitirCambioSalita({
      tipo: 'DISPONIBILIDAD_ACTUALIZADA',
      mensaje: 'Asignación de profesional actualizada',
      id_salita: idSalita,
    });
  } catch {
    // Notificación complementaria
  }
  return updated;
};

export const eliminarSalitaProfesional = async (
  idProfesional: string,
  idSalita: string
) => {
  const deleted = await deleteProfesionalSalita(
    idProfesional,
    idSalita
  );
  try {
    emitirCambioProfesional({
      tipo: 'PROFESIONAL_ACTUALIZADO',
      mensaje: 'Salita desvinculada de profesional',
      id_profesional: idProfesional,
      id_salita: idSalita,
    });
    emitirCambioSalita({
      tipo: 'DISPONIBILIDAD_ACTUALIZADA',
      mensaje: 'Profesional desvinculado de salita',
      id_salita: idSalita,
    });
  } catch {
    // Notificación complementaria
  }
  return deleted;
};