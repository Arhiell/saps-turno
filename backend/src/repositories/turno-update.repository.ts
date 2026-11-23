
import { supabase } from "../config/supabase.js";
import { turnoSelect } from "./turno-select.js";
import { rethrowTurnoError } from "../utils/turno-error.js";
import type { TurnoRow } from "../types/turno.types.js";

// Define los campos del turno que pueden modificarse.
type TurnoEditable = Pick<
  TurnoRow,
  | "id_profesional"
  | "id_especialidad"
  | "id_salita"
  | "id_horario"
  | "id_estado"
  | "fecha_hora_inicio"
  | "fecha_hora_fin"
  | "motivo_consulta"
  | "observaciones"
  | "motivo_cancelacion"
  | "cancelado_por"
  | "fecha_cancelacion"
>;

export type TurnoPatch = {
  [K in keyof TurnoEditable]?: TurnoEditable[K] | undefined;
};

// Actualiza un turno verificando su versión para evitar conflictos concurrentes.
export const patchTurno = async (
  id: string,
  version: number,
  input: TurnoPatch,
  context?: {
    usuario: string;
    motivo?: string;
  }
) => {
  // Utiliza la función de agenda cuando existe un contexto de usuario.
  if (context) {
    const { data, error } = await supabase
      .rpc('guardar_turno_agenda', {
        p_id: id,
        p_datos: input,
        p_usuario: context.usuario,
        p_version: version,
        p_motivo: context.motivo ?? null,
      })
      .select(turnoSelect)
      .returns<TurnoRow[]>()
      .maybeSingle();

    if (error) {
      rethrowTurnoError(error);
    }

    return data;
  }

  // Actualiza directamente el turno si coincide su versión.
  const { data, error } = await supabase
    .from("turnos")
    .update(input)
    .eq("id_turno", id)
    .eq("version", version)
    .select(turnoSelect)
    .returns<TurnoRow[]>()
    .maybeSingle();

  if (error) {
    rethrowTurnoError(error);
  }

  return data;
};
