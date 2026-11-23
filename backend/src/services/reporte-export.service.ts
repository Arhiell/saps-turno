import {
  getReporteResumen,
  getReporteEspecialidades,
} from "./reporte.service.js";

import {
  getReporteProfesionales,
} from "./reporte-profesional.service.js";

import type {
  ReporteExportQuery,
} from "../validators/reporte.validator.js";

import { generateExcel } from
  "./reporte-excel.service.js";

import { generateWord } from
  "./reporte-word.service.js";

import { generatePdf } from
  "./reporte-pdf.service.js";
import { reportScopeLabel, reportDate, reportTimestamp } from './reporte-documento.js';
import type { ReporteSecciones } from '../types/reporte-agenda.types.js';


// Obtiene los datos según el reporte pedido.
export const getReporteExportData = async (
  filters: ReporteExportQuery, scope: string[] | null = null,
) => {
  if (filters.tipo === "resumen") {
    return getReporteResumen(filters, scope);
  }

  if (filters.tipo === "especialidades") {
    return getReporteEspecialidades(filters, scope);
  }

  return getReporteProfesionales(filters, scope);
};

// Genera el archivo solicitado.
export const exportReporte = async (
  filters: ReporteExportQuery, scope: string[] | null = null,
) => {
  const data =
    await getReporteExportData(filters, scope);

  const titles = { resumen: 'Resumen de actividad', especialidades: 'Actividad por especialidad', profesionales: 'Actividad por profesional' };
  const context = await reportScopeLabel(filters.id_salita, scope);
  const section: ReporteSecciones['secciones'][number] = {
    nombre: titles[filters.tipo],
    cabecera: ['CORA · Salud municipal', titles[filters.tipo],
      `Período: ${reportDate(filters.fecha_desde)} al ${reportDate(filters.fecha_hasta)}`, ...context],
    columnas: [], filas: [], pie: [],
  };
  if (filters.tipo === 'resumen') {
    const summary = data as Awaited<ReturnType<typeof getReporteResumen>>;
    section.columnas = ['Indicador', 'Cantidad'];
    section.anchos = [4, 1];
    section.filas = [
      ['Total de turnos', summary.total_turnos], ['Atenciones realizadas', summary.atenciones_realizadas],
      ['Cancelaciones', summary.cancelaciones], ['Inasistencias', summary.inasistencias],
      ['Pacientes atendidos (únicos)', summary.pacientes_atendidos],
    ];
  } else if (filters.tipo === 'especialidades') {
    section.columnas = ['Especialidad', 'Turnos', 'Atendidos', 'Inasistencias', 'Cancelados'];
    section.anchos = [3, 1, 1, 1.3, 1.2];
    section.filas = (data as Awaited<ReturnType<typeof getReporteEspecialidades>>).map(row =>
      [row.nombre, row.total_turnos, row.atendidos, row.inasistencias, row.cancelados]);
  } else {
    section.columnas = ['Profesional / matrícula', 'Salitas / especialidades', 'Turnos', 'Atendidos', 'Inasistencias', 'Cancelados'];
    section.anchos = [2.5, 2.8, 0.8, 1, 1.1, 1];
    section.filas = (data as Awaited<ReturnType<typeof getReporteProfesionales>>).map(row =>
      [`${row.profesional}\nMatrícula: ${row.matricula}`, `${row.salitas.join(', ')}\n${row.especialidades.join(', ')}`,
        row.total_turnos, row.atendidos, row.inasistencias, row.cancelados]);
  }
  section.pie = section.filas.length ? ['Fuente: turnos registrados en CORA.'] : ['No hay registros para los filtros seleccionados.'];
  const document: ReporteSecciones = { generado: reportTimestamp(), secciones: [section] };
  if (filters.tipo === 'profesionales') document.excel = {
    nombre: 'Profesionales', columnas: ['Profesional', 'Matrícula', 'Salitas', 'Especialidades', 'Turnos', 'Atendidos', 'Inasistencias', 'Cancelados'],
    filas: (data as Awaited<ReturnType<typeof getReporteProfesionales>>).map(row =>
      [row.profesional, row.matricula, row.salitas.join(', '), row.especialidades.join(', '), row.total_turnos, row.atendidos, row.inasistencias, row.cancelados]),
  };
  return generateReporteFile(
    document,
    `Reporte SAPS - ${filters.tipo}`,
     filters.formato
    );
};

// Un solo punto de selección de formato para reportes estadísticos y agenda diaria.
export const generateReporteFile = async (
  data: unknown, 
  titulo: string,
   formato: "pdf" | "xlsx" | "docx") => {

  if (formato === "xlsx") {
    return {
      buffer: await generateExcel(
        data,
        titulo,
      ),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
    };
  }

  if (formato === "docx") {
    return {
      buffer: await generateWord(
        data,
        titulo,
      ),
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: "docx",
    };
  }

  return {
    buffer: await generatePdf(
      data,
      titulo,
    ),
    contentType: "application/pdf",
    extension: "pdf",
  };
};
