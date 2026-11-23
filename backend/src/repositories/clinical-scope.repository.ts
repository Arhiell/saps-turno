import { supabase } from '../config/supabase.js';
import type {
  ClinicalPermissionCode,
  ClinicalScopeContext,
} from '../types/permission.types.js';

export interface VerifyClinicalAccessParams {
  idUsuario: string;
  idPaciente: string;
  idSalita: string;
  permiso: ClinicalPermissionCode;
  fechaActo?: string | null;
  idEspecialidad?: string | null;
  requiereLongitudinal?: boolean;
}

/**
 * Invoca la función RPC transaccional `verificar_acceso_clinico` en PostgreSQL
 * para validar identidad profesional, vigencia en salita/especialidad y
 * pertenencia del paciente o derivación/autorización clínica vigente.
 */
export const verifyClinicalAccessRpc = async (
  params: VerifyClinicalAccessParams
): Promise<ClinicalScopeContext> => {
  const { data, error } = await supabase.rpc('verificar_acceso_clinico', {
    p_usuario: params.idUsuario,
    p_paciente: params.idPaciente,
    p_salita: params.idSalita,
    p_permiso: params.permiso,
    p_fecha_acto: params.fechaActo ?? null,
    p_especialidad: params.idEspecialidad ?? null,
    p_requiere_longitudinal: params.requiereLongitudinal ?? false,
  });

  if (error) {
    throw error;
  }

  return data as ClinicalScopeContext;
};

/**
 * Verifica si una salita existe y está activa.
 */
export const findActiveClinicalSalita = async (
  idSalita: string
): Promise<{ id_salita: string } | null> => {
  const { data, error } = await supabase
    .from('salitas')
    .select('id_salita')
    .eq('id_salita', idSalita)
    .eq('activo', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Verifica si un profesional vinculado a `idPersona` posee asignación vigente
 * en `idSalita` para la fecha dada.
 */
export const hasActiveProfesionalSalitaScope = async (
  idPersona: string,
  idSalita: string,
  fecha: string
): Promise<boolean> => {
  const { data: profesional, error: profError } = await supabase
    .from('profesionales')
    .select('id_profesional')
    .eq('id_persona', idPersona)
    .eq('activo', true)
    .maybeSingle();

  if (profError) {
    throw profError;
  }

  if (!profesional) {
    return false;
  }

  const { data: salitaRel, error: relError } = await supabase
    .from('profesional_salita')
    .select('id_salita, salita:salitas!inner(activo)')
    .eq('id_profesional', profesional.id_profesional)
    .eq('id_salita', idSalita)
    .eq('activo', true)
    .eq('salita.activo', true)
    .lte('fecha_desde', fecha)
    .or(`fecha_hasta.is.null,fecha_hasta.gte.${fecha}`)
    .limit(1)
    .maybeSingle();

  if (relError) {
    throw relError;
  }

  return Boolean(salitaRel);
};

/**
 * Verifica si un usuario administrativo/recepción posee asignación vigente
 * en `idSalita` para la fecha dada.
 */
export const hasActiveUserSalitaScope = async (
  idUsuario: string,
  idSalita: string,
  fecha: string
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('usuario_salita')
    .select('id_salita, salita:salitas!inner(activo)')
    .eq('id_usuario', idUsuario)
    .eq('id_salita', idSalita)
    .eq('activo', true)
    .eq('salita.activo', true)
    .lte('fecha_desde', fecha)
    .or(`fecha_hasta.is.null,fecha_hasta.gte.${fecha}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
};
