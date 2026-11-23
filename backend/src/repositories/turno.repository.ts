import { 
  supabase 
} from "../config/supabase.js";

import { 
  turnoSelect 
} from "./turno-select.js";

import { 
  rethrowTurnoError 
} from "../utils/turno-error.js";

import type { 
  TurnoRow 
} from "../types/turno.types.js";

export type TurnoInsert = Pick<TurnoRow, "codigo_turno" | "id_paciente" | "id_profesional" |
  "id_especialidad" | "id_salita" | "id_horario" | "id_estado" | "fecha_hora_inicio" | "fecha_hora_fin"> & {
    creado_por: string; motivo_consulta?: string | null | undefined; observaciones?: string | null | undefined;
  };
// Una sola escritura: los triggers crean historial y las exclusiones resuelven carreras.
export const insertTurno = async (input: TurnoInsert) => {
  const { data, error } = await supabase.from("turnos").insert(input)
    .select(turnoSelect).returns<TurnoRow[]>().single();
  if (error) rethrowTurnoError(error);
  return data!;
};
