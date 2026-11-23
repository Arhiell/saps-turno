export type ReporteTipo =
  | 'resumen'
  | 'especialidades'
  | 'profesionales';

export type ReporteFormato =
  | 'pdf'
  | 'xlsx'
  | 'docx';

export interface ReporteFiltros {
  fecha_desde: string;
  fecha_hasta: string;
  id_salita?: string;
}

export interface ReportePeriodo {
  desde: string;
  hasta: string;
}

export interface ReporteResumen {
  periodo: ReportePeriodo;
  total_turnos: number;
  atenciones_realizadas: number;
  cancelaciones: number;
  inasistencias: number;
  pacientes_atendidos: number;
}

export interface ReporteEspecialidad {
  id_especialidad: string;
  nombre: string;
  total_turnos: number;
  atendidos: number;
  inasistencias: number;
  cancelados: number;
}

export interface ReporteProfesional {
  id_profesional: string;
  profesional: string;
  total_turnos: number;
  atendidos: number;
  inasistencias: number;
  cancelados: number;
}

export interface ReporteResumenResponse {
  ok: boolean;
  reporte: ReporteResumen;
}

export interface ReporteEspecialidadesResponse {
  ok: boolean;
  total: number;
  reporte: ReporteEspecialidad[];
}

export interface ReporteProfesionalesResponse {
  ok: boolean;
  total: number;
  reporte: ReporteProfesional[];
}

/* ========================= */
/* AGENDA DIARIA */
/* ========================= */

export interface AgendaPaciente {
  id_turno: string;
  codigo_turno: string;
  hora: string;
  apellido_nombre: string;
  dni: string;
  estado: string;
  motivo_consulta: string | null;
}

export interface AgendaLista {
  fecha: string;
  id_salita: string;
  salita: string;
  direccion: string | null;
  id_profesional: string;
  profesional: string;
  id_especialidad: string;
  especialidad: string;
  total_pacientes: number;
  pacientes: AgendaPaciente[];
}

export interface AgendaDiariaResponse {
  ok: boolean;
  sistema: string;
  fecha: string;
  total_pacientes: number;
  listas: AgendaLista[];
}