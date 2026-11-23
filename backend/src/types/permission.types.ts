export const GENERAL_PERMISSIONS = {
  GESTIONAR_ROLES: 'GESTIONAR_ROLES',
  GESTIONAR_USUARIOS: 'GESTIONAR_USUARIOS',
  GESTIONAR_ESTRUCTURA: 'GESTIONAR_ESTRUCTURA',
  GESTIONAR_PACIENTES: 'GESTIONAR_PACIENTES',
  GESTIONAR_PROFESIONALES: 'GESTIONAR_PROFESIONALES',
  GESTIONAR_AGENDAS: 'GESTIONAR_AGENDAS',
  GESTIONAR_TURNOS: 'GESTIONAR_TURNOS',
  GESTIONAR_SANCIONES: 'GESTIONAR_SANCIONES',
  VER_REPORTES: 'VER_REPORTES',
  VER_AUDITORIA: 'VER_AUDITORIA',
  GESTIONAR_CONFIGURACION: 'GESTIONAR_CONFIGURACION',
  GESTIONAR_PERFIL_PROPIO: 'GESTIONAR_PERFIL_PROPIO',
  GESTIONAR_TURNOS_PROPIOS: 'GESTIONAR_TURNOS_PROPIOS',
} as const;

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

export const PERMISSIONS = {
  ...GENERAL_PERMISSIONS,
  ...CLINICAL_PERMISSIONS,
} as const;

export type GeneralPermissionCode =
  (typeof GENERAL_PERMISSIONS)[keyof typeof GENERAL_PERMISSIONS];

export type ClinicalPermissionCode =
  (typeof CLINICAL_PERMISSIONS)[keyof typeof CLINICAL_PERMISSIONS];

export type PermissionCode = GeneralPermissionCode | ClinicalPermissionCode;

export type PermissionInput = PermissionCode | (string & {});

export interface RolePermissionsData {
  idRol: string;
  codigo: string;
  activo: boolean;
  permissions: Set<string>;
}

export interface ClinicalScopeContext {
  autorizado: boolean;
  id_profesional: string | null;
  id_salita_paciente: string;
  via: 'SALITA_ASIGNADA' | 'DERIVACION_AUTORIZADA';
  alcance: 'SALITA_ASIGNADA' | 'PROFESIONAL' | 'ESPECIALIDAD' | 'LONGITUDINAL';
  id_derivacion: string | null;
  id_especialidad_autorizada: string | null;
  fecha_acceso: string;
  fecha_desde_autorizada: string | null;
  fecha_hasta_autorizada: string | null;
}

export interface ClinicalAuditScopeContext {
  id_salita: string | null;
  via: 'GLOBAL' | 'SALITA_ASIGNADA';
}
