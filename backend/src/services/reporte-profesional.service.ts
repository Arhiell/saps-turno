import { findTurnosReporte } from
  "../repositories/reporte.repository.js";

import type {
  ReporteQuery,
} from "../validators/reporte.validator.js";

// Agrupa los turnos por profesional.
export const getReporteProfesionales = async (
  filters: ReporteQuery, scope: string[] | null = null,
) => {
  const turnos =
    await findTurnosReporte(filters, scope);

  const resultado = new Map<string, {
    id_profesional: string;
    profesional: string;
    matricula: string;
    salitas: string[];
    especialidades: string[];
    total_turnos: number;
    atendidos: number;
    inasistencias: number;
    cancelados: number;
  }>();

  for (const turno of turnos) {
    const profesional =
      Array.isArray(turno.profesional)
        ? turno.profesional[0]
        : turno.profesional;

    const estado =
      Array.isArray(turno.estado)
        ? turno.estado[0]
        : turno.estado;

    if (!profesional) {
      continue;
    }

    const persona =
      Array.isArray(profesional.persona)
        ? profesional.persona[0]
        : profesional.persona;

    const nombre = persona
      ? `${persona.nombres} ${persona.apellidos}`
      : "Sin datos";

    // Inicializa las métricas del profesional.
    if (!resultado.has(profesional.id_profesional)) {
      resultado.set(
        profesional.id_profesional,
        {
          id_profesional:
            profesional.id_profesional,
          profesional: nombre,
          matricula: profesional.matricula ?? 'No registrada',
          salitas: [],
          especialidades: [],
          total_turnos: 0,
          atendidos: 0,
          inasistencias: 0,
          cancelados: 0,
        },
      );
    }

    const item =
      resultado.get(
        profesional.id_profesional,
      )!;

    item.total_turnos++;
    const salita = Array.isArray(turno.salita) ? turno.salita[0] : turno.salita;
    const especialidad = Array.isArray(turno.especialidad) ? turno.especialidad[0] : turno.especialidad;
    if (salita?.nombre && !item.salitas.includes(salita.nombre)) item.salitas.push(salita.nombre);
    if (especialidad?.nombre && !item.especialidades.includes(especialidad.nombre)) item.especialidades.push(especialidad.nombre);

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
