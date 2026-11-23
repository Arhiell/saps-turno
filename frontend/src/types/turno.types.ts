// ========================================
// ESTADOS DEL TURNO
// ========================================

// Códigos conocidos para los estados del turno.
// Se permite string para admitir estados configurables.
export type TurnoEstadoCodigo =
  | 'SOLICITADO'
  | 'CONFIRMADO'
  | 'EN_ESPERA'
  | 'ATENDIDO'
  | 'NO_ASISTIO'
  | 'CANCELADO'
  | 'REPROGRAMADO'
  | string;

// Información completa del estado de un turno.
export interface TurnoEstado {
  id_estado: string;
  codigo: TurnoEstadoCodigo;
  nombre: string;
  ocupa_agenda: boolean;
  impide_otro_misma_especialidad: boolean;
  es_estado_final: boolean;
  activo: boolean;
}


// ========================================
// PACIENTE DEL TURNO
// ========================================

// Datos básicos del paciente asociados al turno.
export interface TurnoPaciente {
  id_paciente: string;

  persona: {
    dni: string;
    nombres: string;
    apellidos: string;
  };
}


// ========================================
// PROFESIONAL DEL TURNO
// ========================================

// Datos básicos del profesional asignado.
export interface TurnoProfesional {
  id_profesional: string;
  matricula: string;

  persona: {
    nombres: string;
    apellidos: string;
  };
}


// ========================================
// SALITA DEL TURNO
// ========================================

// Información de la salita donde
// se realizará la atención.
export interface TurnoSalita {
  id_salita: string;
  nombre: string;
  direccion?: string;
}


// ========================================
// ESPECIALIDAD DEL TURNO
// ========================================

// Especialidad médica correspondiente al turno.
export interface TurnoEspecialidad {
  id_especialidad: string;
  nombre: string;
}


// ========================================
// TURNO
// ========================================

// Representa un turno completo junto con
// sus relaciones principales.
export interface Turno {
  id_turno: string;
  codigo_turno: string;

  // Relaciones del turno.
  id_paciente: string;
  id_profesional: string;
  id_especialidad: string;
  id_salita: string;
  id_horario: string | null;
  id_estado: string;

  // Fecha y horario de atención.
  fecha_hora_inicio: string;
  fecha_hora_fin: string;

  // Información de la consulta.
  motivo_consulta: string | null;
  observaciones: string | null;

  // Información de cancelación.
  motivo_cancelacion: string | null;
  fecha_cancelacion: string | null;
  cancelado_por: string | null;

  // Fechas de seguimiento.
  fecha_solicitud?: string;
  fecha_actualizacion?: string;

  // Reglas y control del turno.
  ocupa_agenda: boolean;
  impide_otro_misma_especialidad: boolean;
  version: number;
  creado_por?: string | null;
  solicitante?: {
    id_usuario: string;
    nombre_usuario: string;
    persona: { nombres: string; apellidos: string } | null;
  } | null;

  // Relaciones completas.
  estado: TurnoEstado;
  paciente: TurnoPaciente;
  profesional: TurnoProfesional;
  salita: TurnoSalita;
  especialidad: TurnoEspecialidad;
}


// ========================================
// PAGINACIÓN DE TURNOS
// ========================================

// Información utilizada para paginar
// los resultados de turnos.
export interface TurnosPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}


// ========================================
// RESPUESTA DE LISTADO DE TURNOS
// ========================================

export interface TurnosResponse {
  success: boolean;
  message?: string;

  data: {
    turnos: Turno[];
    pagination: TurnosPagination;
  };
}


// ========================================
// RESPUESTA DE UN TURNO
// ========================================

export interface TurnoResponse {
  success: boolean;
  message?: string;

  data: {
    turno: Turno;
  };
}


// ========================================
// CREAR TURNO
// ========================================

// Datos necesarios para registrar
// un nuevo turno.
export interface CreateTurnoRequest {
  id_paciente: string;
  id_profesional: string;
  id_especialidad: string;
  id_salita: string;
  id_horario?: string;
  fecha_hora_inicio: string;
  motivo_consulta?: string | null;
  observaciones?: string | null;
}


// ========================================
// ACTUALIZAR TURNO
// ========================================

// Campos permitidos al modificar
// un turno existente.
export interface UpdateTurnoRequest {
  motivo_reprogramacion?: string;
  version?: number;
  id_profesional?: string;
  id_especialidad?: string;
  id_salita?: string;
  id_horario?: string;
  fecha_hora_inicio?: string;
  motivo_consulta?: string | null;
  observaciones?: string | null;
}


// ========================================
// CAMBIAR ESTADO DEL TURNO
// ========================================

// Datos enviados para modificar
// el estado actual de un turno.
export interface ChangeTurnoStatusRequest {
  estado: string;
  motivo_cancelacion?: string;
}


// ========================================
// DISPONIBILIDAD
// ========================================

// Estados posibles de un bloque horario.
export type DisponibilidadEstado =
  | 'DISPONIBLE'
  | 'OCUPADO'
  | 'BLOQUEADO';

// Representa un bloque horario generado
// por el sistema de disponibilidad.
export interface DisponibilidadSlot {
  hora_inicio: string;
  hora_fin: string;
  estado: DisponibilidadEstado;

  // Información disponible cuando el slot
  // está relacionado con un turno o bloqueo.
  id_turno?: string;
  estado_turno?: string;
  motivo?: string;
}


// ========================================
// HORARIO UTILIZADO
// ========================================

// Horario de atención utilizado para
// generar los slots disponibles.
export interface DisponibilidadHorario {
  id_horario: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_turno_minutos: number;
  cupo_maximo_diario: number | null;
}


// ========================================
// RESPUESTA DE DISPONIBILIDAD
// ========================================

// Resultado de consultar la disponibilidad
// de un profesional para una fecha.
export interface DisponibilidadResponse {
  fecha: string;
  dia_semana: number;

  id_profesional: string;
  id_especialidad: string;
  id_salita: string;

  // Resumen general de los slots.
  resumen: {
    total_slots: number;
    disponibles: number;
    ocupados: number;
    bloqueados: number;
  };

  // Slots generados para la fecha.
  slots: DisponibilidadSlot[];

  // Horarios utilizados para calcular
  // la disponibilidad.
  horarios_utilizados: DisponibilidadHorario[];
}


// ========================================
// FILTROS DE TURNOS
// ========================================

// Parámetros opcionales utilizados
// al consultar el listado de turnos.
export interface TurnosFilters {
  periodo?: 'proximos' | 'anteriores';
  orden?: 'asc' | 'desc';
  reprogramados?: 'true';

  fecha?: string;
  fecha_desde?: string;
  fecha_hasta?: string;

  id_profesional?: string;
  id_especialidad?: string;
  id_paciente?: string;
  id_salita?: string;

  estado?: string;
  search?: string;

  page?: number;
  limit?: number;
}


// ========================================
// HISTORIAL DEL TURNO
// ========================================

// Evento registrado dentro del historial
// de cambios de un turno.
export interface AppointmentHistory {
  estado_nombre: string | null;
  id_historial: string;
  accion: string;
  fecha: string;
  fecha_hora_anterior: string | null;
  fecha_hora_nueva: string | null;
}
