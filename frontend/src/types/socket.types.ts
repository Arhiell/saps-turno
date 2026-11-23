export type TipoEventoAgenda =
  | 'TURNO_CREADO'
  | 'TURNO_CONFIRMADO'
  | 'TURNO_REPROGRAMADO'
  | 'TURNO_CANCELADO'
  | 'TURNO_ACTUALIZADO'
  | 'BLOQUEO_AGENDA'
  | 'HORARIO_ATENCION_ACTUALIZADO';

export interface EventoAgenda {
  id: string;
  tipo: TipoEventoAgenda;
  mensaje: string;
  id_turno?: string;
  id_paciente?: string;
  id_horario?: string;
  dia_semana?: number;
  id_profesional?: string;
  id_salita?: string;
  estado?: string;
  paciente?: string;
  fecha_anterior?: string;
  horario_anterior?: string;
  nueva_fecha?: string;
  nuevo_horario?: string;
  motivo?: string;
  timestamp: string;
}

export interface EventoPaciente {
  id: string;
  tipo:
    | 'PACIENTE_CREADO'
    | 'PACIENTE_ACTUALIZADO'
    | 'PACIENTE_ESTADO_CAMBIADO'
    | 'TUTOR_VINCULACION_ACTUALIZADA';
  mensaje: string;
  id_paciente: string;
  id_salita?: string;
  activo?: boolean;
  nombre_paciente?: string;
  dni_paciente?: string;
  timestamp: string;
}

export interface EventoProfesional {
  id: string;
  tipo:
    | 'PROFESIONAL_CREADO'
    | 'PROFESIONAL_ACTUALIZADO'
    | 'HORARIO_ATENCION_ACTUALIZADO'
    | 'BLOQUEO_AGENDA';
  mensaje: string;
  id_profesional: string;
  id_salita?: string;
  matricula?: string;
  activo?: boolean;
  timestamp: string;
}

export interface EventoSalita {
  id: string;
  tipo:
    | 'SALITA_CREADA'
    | 'SALITA_ACTUALIZADA'
    | 'SALITA_ESTADO_CAMBIADO'
    | 'SALITA_ELIMINADA'
    | 'SALITA_CONFIGURACION_ACTUALIZADA'
    | 'HORARIO_SALITA_ACTUALIZADO'
    | 'DISPONIBILIDAD_ACTUALIZADA'
    | 'BLOQUEO_SALITA';
  mensaje: string;
  id_salita: string;
  activo?: boolean;
  timestamp: string;
}

export interface EventoTerritorial {
  id: string;
  tipo:
    | 'ZONA_CREADA'
    | 'ZONA_ACTUALIZADA'
    | 'ZONA_ELIMINADA'
    | 'BARRIO_CREADO'
    | 'BARRIO_ACTUALIZADO'
    | 'BARRIO_ELIMINADO'
    | 'COBERTURA_ACTUALIZADA';
  mensaje: string;
  id_zona?: string;
  id_barrio?: string;
  id_salita?: string;
  timestamp: string;
}

export interface EventoClinico {
  id: string;
  tipo:
    | 'CONSULTA_FIRMADA'
    | 'EVOLUCION_REGISTRADA'
    | 'ESTUDIO_INFORMADO'
    | 'DERIVACION_ACTUALIZADA';
  mensaje: string;
  id_paciente: string;
  id_salita: string;
  id_profesional?: string;
  id_consulta?: string;
  id_derivacion?: string;
  timestamp: string;
}

export type EstadoConexionSocket = 'conectado' | 'reconectando' | 'desconectado';
