import { 
  supabase 
} from "../config/supabase.js";

import { 
  AppError 
} from "../utils/app-error.js";

import type {
  ReporteQuery,
} from "../validators/reporte.validator.js";

// Trae los turnos necesarios para generar reportes.
export const findTurnosReporte = async (
  filters: ReporteQuery, scope: string[] | null = null,
) => {
  const desde =
    `${filters.fecha_desde}T00:00:00-03:00`;

  const hasta =
    `${filters.fecha_hasta}T23:59:59.999-03:00`;

  const buildQuery = () => {
  let query = supabase
    .from("turnos")
    .select(`
      id_turno,
      id_paciente,
      id_profesional,
      id_especialidad,
      id_salita,
      fecha_hora_inicio,

      estado:estados_turno!turnos_id_estado_fkey (
        codigo,
        nombre
      ),

      especialidad:especialidades (
        id_especialidad,
        nombre
      ),

      profesional:profesionales (
        id_profesional,
        matricula,
        persona:personas (
          nombres,
          apellidos
        )
      ),

      salita:salitas (
        id_salita,
        nombre
      )
    `)
    .gte("fecha_hora_inicio", desde)
    .lte("fecha_hora_inicio", hasta);

  // Limita el reporte a una salita.
  if (filters.id_salita) {
    query = query.eq(
      "id_salita",
      filters.id_salita,
    );
  }

  if (scope !== null) query = query.in("id_salita", scope);
  return query.order('fecha_hora_inicio').order('id_turno');
  };
  // Recorrer todas las páginas evita truncar métricas y archivos al límite de Supabase.
  const rows: NonNullable<Awaited<ReturnType<typeof buildQuery>>['data']> = [];
  if (scope?.length === 0) return rows;
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await buildQuery().range(offset, offset + 499);
    if (error) throw new AppError('No se pudieron obtener los datos del reporte', 500);
    rows.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  return rows;
};
