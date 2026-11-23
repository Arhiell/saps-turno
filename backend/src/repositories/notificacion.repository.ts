import { supabase } from "../config/supabase.js";
import { AppError } from "../utils/app-error.js";

const bandejaSelect =
  "id_notificacion,id_turno,tipo,titulo,mensaje,fecha_creacion,fecha_envio,leida,remitente";

import type {
  CreateNotificacionInput,
  NotificacionQuery,
} from "../validators/notificacion.validator.js";

// Crea una notificación interna.
export const createNotificacion = async (
  input: CreateNotificacionInput,
) => {
  const { data, error } = await supabase
    .from("notificaciones")
    .insert({
      id_usuario: input.id_usuario,
      id_turno: input.id_turno ?? null,
      tipo: input.tipo,
      canal: "SISTEMA",
      titulo: input.titulo,
      mensaje: input.mensaje,
      estado_envio: "ENVIADA",
      fecha_envio: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    throw new AppError(
      "No se pudo crear la notificación",
      500,
    );
  }

  return data;
};

// Busca notificaciones pertenecientes a un usuario.
export const findNotificacionesByUsuario = async (
  idUsuario: string,
  filters: NotificacionQuery,
) => {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  let query = supabase
    .from("notificaciones")
    .select(bandejaSelect, { count: "exact" })
    .eq("canal", "SISTEMA")
    .eq("estado_envio", "ENVIADA")
    .eq("id_usuario", idUsuario)
    .order("fecha_envio", { ascending: false })
    .order("id_notificacion");

  if (filters.leida) {
    query = query.eq(
      "leida",
      filters.leida === "true",
    );
  }

  const { data, error, count } =
    await query.range(from, to);

  if (error) {
    throw new AppError(
      "No se pudieron consultar las notificaciones",
      500,
    );
  }

  return {
    data: data ?? [],
    total: count ?? 0,
  };
};

export const findNotificacionById = async (
  id: string,
  idUsuario: string,
) => {
  const { data, error } = await supabase
    .from("notificaciones")
    .select(bandejaSelect)
    .eq("canal", "SISTEMA")
    .eq("estado_envio", "ENVIADA")
    .eq("id_notificacion", id)
    .eq("id_usuario", idUsuario)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "No se pudo consultar la notificación",
      500,
    );
  }

  return data;
};

// Marca una notificación como leída.
// Si ya estaba leída, devuelve igualmente el registro para que la operación sea idempotente.
export const markNotificacionAsRead = async (
  id: string,
  idUsuario: string,
) => {
  const { data, error } = await supabase
    .from("notificaciones")
    .update({
      leida: true,
      fecha_lectura: new Date().toISOString(),
    })
    .eq("id_notificacion", id)
    .eq("id_usuario", idUsuario)
    .eq("canal", "SISTEMA")
    .eq("estado_envio", "ENVIADA")
    .select(bandejaSelect)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "No se pudo marcar la notificación como leída",
      500,
    );
  }

  // Si no se actualizó ninguna fila, puede no existir o ya no cumplir los filtros.
  // Consultamos solo en ese caso para distinguirlo de una notificación ya leída.
  if (!data) {
    const existing = await findNotificacionById(
      id,
      idUsuario,
    );

    if (existing) {
      return existing;
    }
  }

  return data;
};

// Marca todas las notificaciones pendientes como leídas.
export const markAllNotificacionesAsRead = async (
  idUsuario: string,
) => {
  const { count, error } = await supabase
    .from("notificaciones")
    .update({
      leida: true,
      fecha_lectura: new Date().toISOString(),
    }, { count: "exact" })
    .eq("id_usuario", idUsuario)
    .eq("leida", false)
    .eq("canal", "SISTEMA")
    .eq("estado_envio", "ENVIADA");

  if (error) {
    throw new AppError(
      "No se pudieron actualizar las notificaciones",
      500,
    );
  }

  return count ?? 0;
};
