import { 
    supabase 
} from "../config/supabase.js";

import { 
    AppError 
} from "../utils/app-error.js";

import type {
  SancionQuery,
} from "../validators/sancion.validator.js";

const SANCION_SELECT = `
  id_sancion,
  id_paciente,
  id_especialidad,
  id_turno,
  motivo,
  fecha_inicio,
  fecha_fin,
  anulada,
  motivo_anulacion,
  anulada_por,
  creado_por,
  fecha_creacion
`;

// Busca una sanción concreta.
export const findSancionById = async (
  id: string,
) => {
  const { data, error } = await supabase
    .from("sanciones")
    .select(SANCION_SELECT)
    .eq("id_sancion", id)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "No se pudo consultar la sanción",
      500,
    );
  }

  return data;
};

// Lista sanciones con filtros administrativos.
export const findSanciones = async (
  filters: SancionQuery,
) => {
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;
  const now = new Date().toISOString();

  let query = supabase
    .from("sanciones")
    .select(SANCION_SELECT, { count: "exact" })
    .order("fecha_creacion", { ascending: false });

  if (filters.id_paciente) {
    query = query.eq(
      "id_paciente",
      filters.id_paciente,
    );
  }

  if (filters.id_especialidad) {
    query = query.eq(
      "id_especialidad",
      filters.id_especialidad,
    );
  }

  if (filters.vigente === "true") {
    query = query
      .eq("anulada", false)
      .lte("fecha_inicio", now)
      .gt("fecha_fin", now);
  }

  if (filters.vigente === "false") {
    query = query.or(
      `anulada.eq.true,fecha_inicio.gt.${now},fecha_fin.lte.${now}`,
    );
  }

  const { data, error, count } =
    await query.range(from, to);

  if (error) {
    throw new AppError(
      "No se pudieron consultar las sanciones",
      500,
    );
  }

  return {
    data: data ?? [],
    total: count ?? 0,
  };
};
