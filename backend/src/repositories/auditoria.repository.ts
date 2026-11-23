import { supabase } from "../config/supabase.js";
import { AppError } from "../utils/app-error.js";

import type {
  AuditoriaQuery,
} from "../validators/auditoria.validator.js";

const AUDITORIA_SELECT = `
  id_auditoria,
  id_usuario,
  id_salita,
  esquema,
  entidad,
  id_entidad,
  accion,
  datos_anteriores,
  datos_nuevos,
  ip_origen,
  fecha
`;

// Lista registros de auditoría con filtros.
export const findAuditorias = async (
  filters: AuditoriaQuery,
) => {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  let query = supabase
    .from("auditoria")
    .select(AUDITORIA_SELECT, { count: "exact" })
    .order("fecha", { ascending: false });

  if (filters.entidad) {
    query = query.eq("entidad", filters.entidad);
  }

  if (filters.accion) {
    query = query.eq("accion", filters.accion);
  }

  if (filters.id_usuario) {
    query = query.eq(
      "id_usuario",
      filters.id_usuario,
    );
  }

  if (filters.id_salita) {
    query = query.eq(
      "id_salita",
      filters.id_salita,
    );
  }

  if (filters.id_entidad) {
    query = query.eq(
      "id_entidad",
      filters.id_entidad,
    );
  }

  // Filtra desde el inicio del día indicado.
  if (filters.fecha_desde) {
    query = query.gte(
      "fecha",
      `${filters.fecha_desde}T00:00:00`,
    );
  }

  // Incluye todo el último día indicado.
  if (filters.fecha_hasta) {
    query = query.lte(
      "fecha",
      `${filters.fecha_hasta}T23:59:59.999`,
    );
  }

  const { data, error, count } =
    await query.range(from, to);

  if (error) {
    throw new AppError(
      "No se pudo consultar la auditoría",
      500,
    );
  }

  return {
    data: data ?? [],
    total: count ?? 0,
  };
};

// Busca un registro específico.
export const findAuditoriaById = async (
  id: number,
) => {
  const { data, error } = await supabase
    .from("auditoria")
    .select(AUDITORIA_SELECT)
    .eq("id_auditoria", id)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "No se pudo consultar la auditoría",
      500,
    );
  }

  return data;
};