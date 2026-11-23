export const CLINICAL_PERMISSIONS = {
  VER_HISTORIA_CLINICA: 'VER_HISTORIA_CLINICA',
  CREAR_CONSULTA_CLINICA: 'CREAR_CONSULTA_CLINICA',
  GESTIONAR_ANTECEDENTES_CLINICOS: 'GESTIONAR_ANTECEDENTES_CLINICOS',
  REGISTRAR_DIAGNOSTICOS: 'REGISTRAR_DIAGNOSTICOS',
  REGISTRAR_EVOLUCIONES: 'REGISTRAR_EVOLUCIONES',
  GESTIONAR_TRATAMIENTOS: 'GESTIONAR_TRATAMIENTOS',
  GESTIONAR_ESTUDIOS_CLINICOS: 'GESTIONAR_ESTUDIOS_CLINICOS',
  VER_AUDITORIA_CLINICA: 'VER_AUDITORIA_CLINICA',
  GESTIONAR_DERIVACIONES_CLINICAS: 'GESTIONAR_DERIVACIONES_CLINICAS',
} as const;

export type ClinicalPermission =
  (typeof CLINICAL_PERMISSIONS)[keyof typeof CLINICAL_PERMISSIONS];

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

export type DiagnosticoEstado = 'ACTIVO' | 'RESUELTO' | 'DESCARTADO' | 'ANULADO';

export type ConsultaEstado = 'BORRADOR' | 'FIRMADA' | 'ANULADA';

export type EvolucionEstado = 'BORRADOR' | 'FIRMADA' | 'RECTIFICADA' | 'ANULADA';

export type TratamientoEstado = 'ACTIVO' | 'FINALIZADO' | 'SUSPENDIDO' | 'ANULADO';

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

export interface CatalogSalitaItem {
  id_salita: string;
  nombre: string;
}

export interface CatalogEspecialidadItem {
  id_especialidad: string;
  nombre: string;
}

export interface CatalogProfesionalItem {
  id_profesional: string;
  matricula: string;
  nombres: string;
  apellidos: string;
}

export interface HistoriaClinicaContextData {
  id_profesional: string | null;
  salitas_autorizadas: CatalogSalitaItem[];
  especialidades_autorizadas: CatalogEspecialidadItem[];
  catalogo_salitas: CatalogSalitaItem[];
  catalogo_especialidades: CatalogEspecialidadItem[];
  catalogo_profesionales: CatalogProfesionalItem[];
}

export interface ClinicalPatientSearchItem {
  id_paciente: string;
  dni: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  sexo?: string | null;
  id_salita_asignada?: string | null;
  salita_nombre?: string | null;
  activo: boolean;
  via_acceso_estimada: 'SALITA_ASIGNADA' | 'DERIVACION_AUTORIZADA';
}

export interface ClinicalPatientsSearchData {
  patients: ClinicalPatientSearchItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface HistoriaClinicaCabecera {
  id_historia_clinica: string;
  id_paciente: string;
  estado: 'ACTIVA' | 'INACTIVA' | 'ARCHIVADA';
  observaciones_generales?: string | null;
  fecha_apertura: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface HistoriaClinicaPacienteResumen {
  id_paciente: string;
  id_salita_asignada: string | null;
  obra_social?: string | null;
  dni: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  sexo?: string | null;
}

export interface AntecedenteClinico {
  id_antecedente: string;
  id_historia_clinica: string;
  id_paciente: string;
  tipo: AntecedenteTipo;
  categoria?: string | null;
  descripcion: string;
  fecha_antecedente: string;
  estado: AntecedenteEstado;
  id_profesional_autor: string;
  id_salita_registro?: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface AlergiaPaciente {
  id_alergia: string;
  id_historia_clinica: string;
  id_paciente: string;
  alergeno: string;
  tipo_reaccion: string;
  gravedad: AlergiaGravedad;
  observaciones?: string | null;
  estado: AlergiaEstado;
  fecha_deteccion?: string | null;
  id_profesional_autor: string;
  id_salita_registro?: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface DiagnosticoClinico {
  id_diagnostico: string;
  id_consulta: string;
  id_historia_clinica: string;
  id_paciente: string;
  codigo?: string | null;
  descripcion: string;
  tipo: DiagnosticoTipo;
  fecha_diagnostico: string;
  observaciones?: string | null;
  estado: DiagnosticoEstado;
  id_profesional_autor: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface EvolucionClinica {
  id_evolucion: string;
  id_consulta: string;
  id_historia_clinica: string;
  id_paciente: string;
  evolucion: string;
  observaciones?: string | null;
  id_profesional_responsable: string;
  fecha_evolucion: string;
  version: number;
  es_correccion: boolean;
  id_evolucion_origen?: string | null;
  motivo_correccion?: string | null;
  estado: EvolucionEstado;
  firmada_en?: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface TratamientoClinico {
  id_tratamiento: string;
  id_consulta: string;
  id_historia_clinica: string;
  id_paciente: string;
  medicacion: string;
  dosis: string;
  frecuencia: string;
  duracion?: string | null;
  indicaciones?: string | null;
  fecha_inicio: string;
  fecha_fin?: string | null;
  estado: TratamientoEstado;
  id_profesional_responsable: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface EstudioClinico {
  id_estudio: string;
  id_consulta: string;
  id_historia_clinica: string;
  id_paciente: string;
  tipo_estudio: string;
  descripcion: string;
  fecha_solicitud: string;
  resultado?: string | null;
  fecha_resultado?: string | null;
  estado: EstudioEstado;
  id_profesional_solicitante: string;
  id_profesional_informa?: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface ConsultaMedicaItem {
  id_consulta: string;
  id_historia_clinica: string;
  id_paciente: string;
  id_profesional: string;
  id_especialidad: string;
  id_salita: string;
  id_turno?: string | null;
  id_autorizacion_clinica?: string | null;
  fecha_atencion: string;
  motivo_consulta: string;
  sintomas?: string | null;
  examen_fisico?: string | null;
  observaciones?: string | null;
  estado: ConsultaEstado;
  firmada_en?: string | null;
  motivo_anulacion?: string | null;
  anulada_en?: string | null;
  id_profesional_autor: string;
  version: number;
  fecha_creacion: string;
  fecha_actualizacion: string;
  especialidad?: string;
  salita?: string;
  profesional?: string;
  diagnosticos: DiagnosticoClinico[];
  evoluciones: EvolucionClinica[];
  tratamientos: TratamientoClinico[];
  estudios: EstudioClinico[];
}

export interface HistoriaClinicaDossier {
  historia_clinica: HistoriaClinicaCabecera | null;
  paciente: HistoriaClinicaPacienteResumen;
  via_acceso: 'SALITA_ASIGNADA' | 'DERIVACION_AUTORIZADA';
  alcance: string;
  id_derivacion: string | null;
  contenido_restringido_por_alcance: boolean;
  antecedentes: AntecedenteClinico[];
  alergias: AlergiaPaciente[];
  consultas: ConsultaMedicaItem[];
}

export interface ConsultaMedicaDetalle extends ConsultaMedicaItem {
  via_acceso: string;
  alcance: string;
  id_derivacion: string | null;
}

export interface DerivacionClinica {
  id_derivacion: string;
  tipo: DerivacionTipo;
  alcance: DerivacionAlcance;
  id_paciente: string;
  id_salita_origen: string;
  id_salita_destino: string;
  id_profesional_destino?: string | null;
  id_especialidad_destino?: string | null;
  motivo: string;
  fecha_desde: string;
  fecha_hasta: string;
  estado: DerivacionEstado;
  id_usuario_solicita: string;
  id_profesional_solicita?: string | null;
  id_usuario_autoriza?: string | null;
  fecha_resolucion?: string | null;
  motivo_resolucion?: string | null;
  id_usuario_revoca?: string | null;
  fecha_revocacion?: string | null;
  motivo_revocacion?: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface AuditoriaClinicaRecord {
  id_auditoria_clinica: number;
  id_usuario: string;
  id_profesional?: string | null;
  id_paciente: string;
  id_historia_clinica?: string | null;
  id_salita: string;
  tipo_operacion: 'CONSULTA' | 'CREACION' | 'MODIFICACION' | 'CORRECCION' | 'EXPORTACION';
  recurso: string;
  id_recurso?: string | null;
  alcance_acceso?: string | null;
  fecha_acto_clinico?: string | null;
  motivo_acceso: string;
  id_derivacion?: string | null;
  ip_origen?: string | null;
  fecha_hora: string;
}

export interface RegistrarConsultaPayload {
  id_paciente: string;
  id_salita: string;
  id_especialidad: string;
  id_turno?: string | null;
  fecha_atencion?: string;
  fecha_preparacion?: string;
  motivo_consulta: string;
  sintomas?: string | null;
  examen_fisico?: string | null;
  observaciones?: string | null;
  firmar: boolean;
  acompanante_tutor_id?: string | null;
  motivo_acceso?: string;
  antecedentes?: Array<{
    tipo: AntecedenteTipo;
    categoria?: string | null;
    descripcion: string;
    fecha_antecedente?: string;
  }>;
  alergias?: Array<{
    alergeno: string;
    tipo_reaccion: string;
    gravedad: AlergiaGravedad;
    observaciones?: string | null;
    fecha_deteccion?: string | null;
  }>;
  diagnosticos?: Array<{
    codigo?: string | null;
    descripcion: string;
    tipo?: DiagnosticoTipo;
    fecha_diagnostico?: string;
    observaciones?: string | null;
  }>;
  evoluciones?: Array<{
    evolucion: string;
    observaciones?: string | null;
  }>;
  tratamientos?: Array<{
    medicacion: string;
    dosis: string;
    frecuencia: string;
    duracion?: string | null;
    indicaciones?: string | null;
    fecha_inicio?: string;
    fecha_fin?: string | null;
  }>;
  estudios?: Array<{
    tipo_estudio: string;
    descripcion: string;
  }>;
}

export interface ConsultaMutationResponse {
  id_historia_clinica?: string;
  id_consulta: string;
  estado: ConsultaEstado | string;
  fecha_preparacion?: string;
  id_profesional?: string;
  id_turno?: string | null;
  turno_actualizado?: boolean;
  turno_estado?: string | null;
  via_acceso?: string;
  alcance?: string;
  id_derivacion?: string | null;
}

export type ActualizarConsultaBorradorPayload = Omit<
  RegistrarConsultaPayload,
  'id_paciente' | 'id_salita' | 'id_especialidad' | 'antecedentes' | 'alergias'
> & {
  id_paciente?: string;
  id_salita: string;
  id_especialidad?: string;
};

export interface SolicitarDerivacionPayload {
  id_paciente: string;
  id_salita_origen: string;
  id_salita_destino: string;
  tipo: DerivacionTipo;
  alcance: DerivacionAlcance;
  id_profesional_destino?: string | null;
  id_especialidad_destino?: string | null;
  motivo: string;
  fecha_desde: string;
  fecha_hasta: string;
}

export interface ResolverDerivacionPayload {
  id_salita: string;
  estado: 'AUTORIZADA' | 'RECHAZADA' | 'REVOCADA';
  motivo?: string | null;
}

export interface BorradorFormularioClinico {
  id_borrador: string;
  id_paciente: string;
  id_salita: string;
  id_especialidad?: string | null;
  id_turno?: string | null;
  datos_formulario: Record<string, unknown>;
  version: number;
  fecha_preparacion: string;
  expira_en?: string;
  fecha_actualizacion: string;
}

export interface BorradorTemporalResponse {
  available: boolean;
  borrador: BorradorFormularioClinico | null;
}

export interface GuardarBorradorTemporalPayload {
  id_paciente: string;
  id_salita: string;
  id_especialidad?: string | null;
  id_turno?: string | null;
  version_esperada?: number | null;
  datos_formulario: Record<string, unknown>;
}

export interface PatientClinicalSignedConsulta {
  id_consulta: string;
  fecha_atencion: string;
  fecha_firma: string | null;
  motivo_consulta: string;
  anamnesis_cuadro_clinico?: string | null;
  examen_fisico?: string | null;
  plan_terapeutico?: string | null;
  especialidad: string;
  salita: string;
  salita_direccion?: string | null;
  profesional: string;
  matricula_profesional?: string | null;
  diagnosticos: {
    id_diagnostico: string;
    codigo_cie10?: string | null;
    descripcion: string;
    tipo: string;
    es_principal: boolean;
    cronico?: boolean;
  }[];
  evoluciones: {
    id_evolucion: string;
    fecha_evolucion: string;
    nota_evolucion: string;
    version: number;
    profesional?: string;
  }[];
  tratamientos: {
    id_tratamiento: string;
    medicamento: string;
    dosis?: string | null;
    frecuencia?: string | null;
    duracion_dias?: number | null;
    instrucciones?: string | null;
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
  }[];
  estudios: {
    id_estudio: string;
    tipo_estudio: string;
    descripcion_pedido: string;
    estado: string;
    resultado_informe?: string | null;
    fecha_solicitud: string;
    fecha_resultado?: string | null;
  }[];
}

export interface PatientClinicalDerivacion {
  id_autorizacion_clinica: string;
  motivo_derivacion: string;
  resumen_clinico?: string | null;
  alcance: string;
  estado: string;
  fecha_solicitud: string;
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
  salita_origen?: string;
  salita_destino?: string;
  especialidad_destino?: string;
  profesional_destino?: string;
}

export interface PatientHistoriaClinicaData {
  paciente: {
    id_paciente: string;
    nombres: string;
    apellidos: string;
    dni: string;
    fecha_nacimiento: string | null;
    sexo: string | null;
    obra_social: string | null;
    numero_afiliado: string | null;
    id_salita_asignada: string;
    salita_nombre?: string;
    id_barrio?: string;
  };
  historia_clinica: {
    id_historia_clinica: string;
    numero_historia_clinica: string;
    fecha_apertura: string;
    grupo_sanguineo?: string | null;
    factor_rh?: string | null;
  } | null;
  consultas: PatientClinicalSignedConsulta[];
  derivaciones: PatientClinicalDerivacion[];
  antecedentes: {
    id_antecedente: string;
    tipo: string;
    descripcion: string;
    fecha_antecedente?: string | null;
    estado?: string;
  }[];
  alergias: {
    id_alergia: string;
    sustancia_alergeno: string;
    tipo_reaccion?: string | null;
    severidad?: string | null;
    estado?: string;
  }[];
}

