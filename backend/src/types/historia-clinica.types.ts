export type AntecedenteTipo =
  | 'PERSONAL'
  | 'FAMILIAR'
  | 'QUIRURGICO'
  | 'PATOLOGICO'
  | 'GINECOLOGICO'
  | 'OTRO';

export type AntecedenteEstado = 'ACTIVO' | 'RESUELTO' | 'INACTIVO' | 'ANULADO';

export type AlergiaGravedad = 'LEVE' | 'MODERADA' | 'GRAVE' | 'DESCONOCIDA';

export type AlergiaEstado = 'ACTIVA' | 'RESUELTA' | 'DESCARTADA' | 'ANULADA';

export type DiagnosticoTipo =
  | 'PRESUNTIVO'
  | 'CONFIRMADO'
  | 'DIFERENCIAL'
  | 'PRINCIPAL'
  | 'SECUNDARIO'
  | 'DESCARTADO';

export type EstudioEstado =
  | 'SOLICITADO'
  | 'EN_PROCESO'
  | 'COMPLETADO'
  | 'CANCELADO';

export type DerivacionTipo = 'DERIVACION' | 'AUTORIZACION_ACCESO';

export type DerivacionAlcance = 'PROFESIONAL' | 'ESPECIALIDAD' | 'LONGITUDINAL';

export type DerivacionEstado =
  | 'PENDIENTE'
  | 'AUTORIZADA'
  | 'RECHAZADA'
  | 'REVOCADA'
  | 'VENCIDA';

export interface HistoriaClinicaResponse {
  historia_clinica: Record<string, unknown> | null;
  paciente: Record<string, unknown>;
  via_acceso: 'SALITA_ASIGNADA' | 'DERIVACION_AUTORIZADA';
  alcance: string;
  id_derivacion: string | null;
  contenido_restringido_por_alcance: boolean;
  antecedentes: Array<Record<string, unknown>>;
  alergias: Array<Record<string, unknown>>;
  consultas: Array<Record<string, unknown>>;
}

export interface ConsultaMedicaResponse extends Record<string, unknown> {
  id_consulta: string;
  id_historia_clinica: string;
  id_paciente: string;
  id_profesional: string;
  id_especialidad: string;
  id_salita: string;
  estado: 'BORRADOR' | 'FIRMADA' | 'ANULADA';
  via_acceso: string;
  alcance: string;
  id_derivacion: string | null;
  diagnosticos: Array<Record<string, unknown>>;
  evoluciones: Array<Record<string, unknown>>;
  tratamientos: Array<Record<string, unknown>>;
  estudios: Array<Record<string, unknown>>;
}
