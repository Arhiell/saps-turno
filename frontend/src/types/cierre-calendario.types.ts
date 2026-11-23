
// Define los tipos de cierres institucionales y sus etiquetas.
export const tiposCierre = {
  FERIADO_NACIONAL: 'Feriado nacional',
  FERIADO_PROVINCIAL: 'Feriado provincial',
  FERIADO_MUNICIPAL: 'Feriado municipal',
  DIA_NO_LABORABLE: 'Día no laborable',
  ASUETO: 'Asueto',
  DUELO: 'Duelo',
  FUMIGACION: 'Fumigación',
  MANTENIMIENTO: 'Mantenimiento',
  EMERGENCIA: 'Emergencia',
  CIERRE_ADMINISTRATIVO: 'Cierre administrativo',
  OTRO: 'Otro cierre extraordinario',
} as const;

// Representa los datos editables de un cierre institucional.
export interface CierreInput {
  titulo: string;
  observaciones: string | null;
  tipo: keyof typeof tiposCierre;
  alcance: 'GLOBAL' | 'SALITA';
  id_salita: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  dia_completo: boolean;
  hora_inicio: string | null;
  hora_fin: string | null;
  origen: string;
  activo: boolean;
}

// Representa un cierre almacenado con sus metadatos y relaciones.
export interface Cierre extends CierreInput {
  id_cierre: string;
  creado_por: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;

  // Identifica los cierres provenientes de una fuente externa.
  fuente_externa: 'ARGENTINADATOS' | null;
  clave_externa: string | null;

  datos_externos: {
    fecha: string;
    nombre: string;
    tipo: string;
  }[] | null;

  // Información adicional sobre turnos y coincidencias manuales.
  turnos_pendientes: number;
  coincidencias_manuales: string[];
}

// Extrae únicamente los campos editables de un cierre.
export const datosCierre = (row: Cierre): CierreInput => ({
  titulo: row.titulo,
  observaciones: row.observaciones,
  tipo: row.tipo,
  alcance: row.alcance,
  id_salita: row.id_salita,
  fecha_inicio: row.fecha_inicio,
  fecha_fin: row.fecha_fin,
  dia_completo: row.dia_completo,
  hora_inicio: row.hora_inicio,
  hora_fin: row.hora_fin,
  origen: row.origen,
  activo: row.activo,
});

// Representa el resultado de sincronización de un año.
export interface SyncYearResult {
  anio: number;
  estado: 'OK' | 'NO_DISPONIBLE' | 'ERROR';
  mensaje?: string;

  // Cantidad de registros procesados durante la sincronización.
  nuevos?: number;
  actualizados?: number;
  sin_cambios?: number;

  // Información sobre coincidencias y turnos pendientes.
  coincidencias_manuales?: number;
  turnos_pendientes?: number;
  no_recibidos_conservados?: number;
}

// Representa el estado de la sincronización del calendario.
export interface SyncStatus {
  ultimo_intento: string | null;
  ultimo_exito: string | null;
  modo: string | null;

  // Resumen del estado y los resultados por año.
  resumen: {
    estado: string;
    resultados?: SyncYearResult[];
  };
}

// Representa la respuesta de una solicitud de sincronización.
export interface SyncResult {
  iniciado: boolean;
  mensaje: string;
  estado?: string;
  resultados?: SyncYearResult[];
}
