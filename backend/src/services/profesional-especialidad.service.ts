import {
  getEspecialidadesByProfesional,
  createProfesionalEspecialidad,
  updateProfesionalEspecialidad,
  deleteProfesionalEspecialidad
} from "../repositories/profesional-especialidad.repository.js";

import {
  createProfesionalEspecialidadSchema,
  updateProfesionalEspecialidadSchema,
  type CreateProfesionalEspecialidadInput,
  type UpdateProfesionalEspecialidadInput
} from "../validators/profesional-especialidad.validator.js";

import { hasDatabaseCode } from "../utils/profile-error.js";
import { AppError } from "../utils/app-error.js";
import { emitirCambioProfesional } from "./socket.service.js";

export const getEspecialidadesProfesional = async (
  idProfesional: string
) => {
  return await getEspecialidadesByProfesional(idProfesional);
};

export const agregarEspecialidadProfesional = async (
  idProfesional: string,
  input: CreateProfesionalEspecialidadInput
) => {
  const validated =
    createProfesionalEspecialidadSchema.parse(input);

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
    id_especialidad: string;
    fecha_desde?: string;
    fecha_hasta?: string | null;
  } = {
    id_profesional: idProfesional,
    id_especialidad: validated.id_especialidad
  };

  if (validated.fecha_desde !== undefined) {
    relacion.fecha_desde = validated.fecha_desde;
  }

  if (validated.fecha_hasta !== undefined) {
    relacion.fecha_hasta = validated.fecha_hasta;
  }

  try {
    const created = await createProfesionalEspecialidad(relacion);
    try {
      emitirCambioProfesional({
        tipo: 'PROFESIONAL_ACTUALIZADO',
        mensaje: 'Especialidad asociada al profesional',
        id_profesional: idProfesional,
      });
    } catch {
      // Notificación complementaria
    }
    return created;
  } catch (error) {
    if (hasDatabaseCode(error, "23505")) {
      throw new AppError(
        "El profesional ya tiene asignada esta especialidad",
        409
      );
    }

    if (hasDatabaseCode(error, "23503")) {
      throw new AppError(
        "El profesional o la especialidad no existen",
        404
      );
    }

    throw error;
  }
};

export const actualizarEspecialidadProfesional = async (
  idProfesional: string,
  idEspecialidad: string,
  input: UpdateProfesionalEspecialidadInput
) => {
  const validated =
    updateProfesionalEspecialidadSchema.parse(input);

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

  const updated = await updateProfesionalEspecialidad(
    idProfesional,
    idEspecialidad,
    relacion
  );
  try {
    emitirCambioProfesional({
      tipo: 'PROFESIONAL_ACTUALIZADO',
      mensaje: 'Especialidad de profesional actualizada',
      id_profesional: idProfesional,
    });
  } catch {
    // Notificación complementaria
  }
  return updated;
};

export const eliminarEspecialidadProfesional = async (
  idProfesional: string,
  idEspecialidad: string
) => {
  const deleted = await deleteProfesionalEspecialidad(
    idProfesional,
    idEspecialidad
  );
  try {
    emitirCambioProfesional({
      tipo: 'PROFESIONAL_ACTUALIZADO',
      mensaje: 'Especialidad desvinculada de profesional',
      id_profesional: idProfesional,
    });
  } catch {
    // Notificación complementaria
  }
  return deleted;
};