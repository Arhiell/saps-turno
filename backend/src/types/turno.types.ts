export interface TurnoState {
  id_estado: string;
  codigo: string;
  nombre: string;
  ocupa_agenda: boolean;
  impide_otro_misma_especialidad: boolean;
  es_estado_final: boolean;
  activo: boolean;
}

// Campos reales de turnos; indicadores, versión
//  e historial los mantiene PostgreSQL.
export interface TurnoRow {
  id_turno: string;
  codigo_turno: string;
  id_paciente: string;
  id_profesional: string;
  id_especialidad: string;
  id_salita: string;
  id_horario: string | null;
  id_estado: string;
  fecha_hora_inicio: string;
  fecha_hora_fin: string;
  motivo_consulta: string | null;
  observaciones: string | null;
  motivo_cancelacion: string | null;
  fecha_cancelacion: string | null;
  cancelado_por: string | null;
  ocupa_agenda: boolean;
  impide_otro_misma_especialidad: boolean;
  version: number;
  creado_por?: string | null;
  solicitante?: {
    id_usuario: string;
    nombre_usuario: string;
    persona: { nombres: string; apellidos: string } | null;
  } | null;
  estado: TurnoState;
}
