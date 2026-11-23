import { 
    supabase 
} from "../config/supabase.js";

import { 
    AppError 
} from "../utils/app-error.js";

import type {
  CreateSancionInput,
} from "../validators/sancion.validator.js";

interface CreateSancionData extends CreateSancionInput {
  creado_por?: string | null;
}

// Registra una sanción vinculada al turno que originó la inasistencia.
export const createSancion = async (
  input: CreateSancionData,
) => {
  const { data, error } = await supabase
    .from("sanciones")
    .insert({
      id_paciente: input.id_paciente,
      id_especialidad: input.id_especialidad,
      id_turno: input.id_turno,
      motivo: input.motivo,
      fecha_fin: input.fecha_fin,
      creado_por: input.creado_por ?? null,
    })
    .select("*")
    .single();

  if (error) {
    // Un turno solamente puede originar una sanción.
    if (error.code === "23505") {
      throw new AppError(
        "Ya existe una sanción asociada a este turno",
        409,
      );
    }

    // Incluye validaciones realizadas por triggers de PostgreSQL.
    if (error.code === "P0001") {
      throw new AppError(error.message, 400);
    }

    if (error.code === "23503" || error.code === "23514") {
      throw new AppError(
        "Los datos de la sanción no cumplen las relaciones o restricciones de la base de datos",
        400,
      );
    }

    throw new AppError(
      "No se pudo registrar la sanción",
      500,
    );
  }

  return data;
};

// Anulación lógica: conserva la sanción y su historial.
export const anularSancion = async (
  id: string,
  motivo: string,
  idUsuario?: string | null,
) => {
  const { data, error } = await supabase
    .from("sanciones")
    .update({
      anulada: true,
      motivo_anulacion: motivo,
      anulada_por: idUsuario ?? null,
    })
    .eq("id_sancion", id)
    .eq("anulada", false)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new AppError(
      "No se pudo anular la sanción",
      500,
    );
  }

  return data;
};
