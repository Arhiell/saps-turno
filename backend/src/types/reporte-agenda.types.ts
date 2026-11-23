export interface AgendaPaciente {
  id_turno: string;
  codigo_turno: string;
  hora: string;
  apellido_nombre: string;
  dni: string;
  estado: string;
  estado_nombre?: string;
  motivo_consulta: string | null;
}
export interface AgendaLista {
  fecha: string;
  id_salita: string;
  salita: string;
  direccion: string | null;
  id_profesional: string;
  profesional: string;
  matricula?: string | null;
  id_especialidad: string;
  especialidad: string;
  total_pacientes: number;
  pacientes: AgendaPaciente[];
}
// Contrato común para los exportadores existentes, independiente del origen de datos.
export interface ReporteSecciones {
  generado?: string;
  excel?: { nombre: string; columnas: string[]; filas: (string | number)[][] };
  secciones: {
     nombre?: string;
     anchos?: number[];
     cabecera: string[]; 
     columnas: string[]; 
     filas: (string | number)[][];
     pie: string[] }[];
}
export const esReporteSecciones = (
  data: unknown
): data is ReporteSecciones =>
  typeof data === "object" && data !== null && "secciones" in data && Array.isArray(data.secciones);
