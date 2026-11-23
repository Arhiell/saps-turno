import { findTurnosReporte } from
  "../repositories/reporte.repository.js";

import type {
  ReporteQuery,
} from "../validators/reporte.validator.js";

// Genera las métricas generales del período.
export const getReporteResumen = async (
  filters: ReporteQuery, scope: string[] | null = null,
) => {
  const turnos =
    await findTurnosReporte(filters, scope);

  let atendidos = 0;
  let cancelados = 0;
  let inasistencias = 0;

  const pacientes = new Set<string>();

  for (const turno of turnos) {
    const estado = Array.isArray(turno.estado)
      ? turno.estado[0]
      : turno.estado;

    // Cuenta los estados finales principales.
    if (estado?.codigo === "ATENDIDO") {
      atendidos++;
      pacientes.add(turno.id_paciente);
    }

    if (estado?.codigo === "CANCELADO") {
      cancelados++;
    }

    if (estado?.codigo === "NO_ASISTIO") {
      inasistencias++;
    }
  }

  return {
    periodo: {
      desde: filters.fecha_desde,
      hasta: filters.fecha_hasta,
    },

    total_turnos: turnos.length,
    atenciones_realizadas: atendidos,
    cancelaciones: cancelados,
    inasistencias,
    pacientes_atendidos: pacientes.size,
  };
};

// Agrupa la cantidad de turnos por especialidad.
export const getReporteEspecialidades = async (
  filters: ReporteQuery, scope: string[] | null = null,
) => {
  const turnos =
    await findTurnosReporte(filters, scope);

  const resultado = new Map<
    string,
    {
      id_especialidad: string;
      nombre: string;
      total_turnos: number;
      atendidos: number;
      inasistencias: number;
      cancelados: number;
    }
  >();

  for (const turno of turnos) {
    const especialidad =
      Array.isArray(turno.especialidad)
        ? turno.especialidad[0]
        : turno.especialidad;

    const estado =
      Array.isArray(turno.estado)
        ? turno.estado[0]
        : turno.estado;

    if (!especialidad) {
      continue;
    }

    // Crea el grupo si todavía no existe.
    if (!resultado.has(especialidad.id_especialidad)) {
      resultado.set(
        especialidad.id_especialidad,
        {
          id_especialidad:
            especialidad.id_especialidad,
          nombre: especialidad.nombre,
          total_turnos: 0,
          atendidos: 0,
          inasistencias: 0,
          cancelados: 0,
        },
      );
    }

    const item =
      resultado.get(
        especialidad.id_especialidad,
      )!;

    item.total_turnos++;

    if (estado?.codigo === "ATENDIDO") {
      item.atendidos++;
    }

    if (estado?.codigo === "NO_ASISTIO") {
      item.inasistencias++;
    }

    if (estado?.codigo === "CANCELADO") {
      item.cancelados++;
    }
  }

  return [...resultado.values()]
    .sort(
      (a, b) =>
        b.total_turnos - a.total_turnos,
    );
};
