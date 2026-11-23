import {
    supabase
} from "../config/supabase.js";

import {
    AppError
} from "../utils/app-error.js";

import type {
  HistorialTurnoQuery,
} from "../validators/historial-turno.validator.js";
import { agendaDayBounds } from "../utils/turno-time.js";


// Verifica que el turno realmente exista.
export const findTurnoForHistorial = async (
  idTurno: string,
) => {
  const { data, error } = await supabase
    .from("turnos")
    .select("id_turno, id_salita")
    .eq("id_turno", idTurno)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "No se pudo verificar el turno",
      500,
    );
  }

  return data;
};

// Obtiene el historial con información legible de usuario y estados.
export const findHistorialByTurno = async (
  idTurno: string,
) => {
  const { data, error } = await supabase
    .from("historial_turnos")
    .select(`
      id_historial,
      id_turno,
      accion,
      fecha_hora_anterior,
      fecha_hora_nueva,
      detalle,
      fecha,

      usuario:usuarios!historial_turnos_id_usuario_fkey (
        id_usuario,
        nombre_usuario,
        email
      ),

      estado_anterior:estados_turno!historial_turnos_id_estado_anterior_fkey (
        id_estado,
        codigo,
        nombre
      ),

      estado_nuevo:estados_turno!historial_turnos_id_estado_nuevo_fkey (
        id_estado,
        codigo,
        nombre
      )
    `)
    .eq("id_turno", idTurno)
    .order("fecha", { ascending: false });

  if (error) {
    throw new AppError(
      "No se pudo consultar el historial del turno",
      500,
    );
  }

  return data ?? [];
};

// Lista el historial general aplicando filtros y paginación.
export const findHistorialGeneral = async (
  filters: HistorialTurnoQuery,
  scope: string[] | null = null,
) => {
  const {
    accion,
    id_usuario,
    fecha_desde,
    fecha_hasta,
    page,
    limit,
  } = filters;

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("historial_turnos")
    .select(
      `
        id_historial,
        id_turno,
        accion,
        fecha_hora_anterior,
        fecha_hora_nueva,
        detalle,
        fecha,
        ${scope === null ? "" : "turno:turnos!inner(id_salita),"}

        usuario:usuarios!historial_turnos_id_usuario_fkey (
          id_usuario,
          nombre_usuario,
          email
        ),

        estado_anterior:estados_turno!historial_turnos_id_estado_anterior_fkey (
          id_estado,
          codigo,
          nombre
        ),

        estado_nuevo:estados_turno!historial_turnos_id_estado_nuevo_fkey (
          id_estado,
          codigo,
          nombre
        )
      `,
      { count: "exact" },
    )
    .order("fecha", { ascending: false });

  if (scope !== null) {
    query = query.in("turno.id_salita", scope);
  }

  if (accion) {
    query = query.eq("accion", accion);
  }

  if (id_usuario) {
    query = query.eq("id_usuario", id_usuario);
  }

  if (fecha_desde) {
    query = query.gte(
      "fecha",
      agendaDayBounds(fecha_desde).start,
    );
  }

  if (fecha_hasta) {
    query = query.lt(
      "fecha",
      agendaDayBounds(fecha_hasta).end,
    );
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new AppError(
      "No se pudo consultar el historial general",
      500,
    );
  }

  return {
    data: data ?? [],
    total: count ?? 0,
  };
};
