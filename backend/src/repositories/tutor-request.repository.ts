import { supabase } from '../config/supabase.js';
import type { CreateTutorRequestInput } from '../validators/tutor-request.validator.js';

export const createTutorRequest = async (
  userId: string,
  patientId: string,
  clinicId: string,
  input: CreateTutorRequestInput,
) => {
  const { data, error } = await supabase
    .from('solicitudes_vinculacion')
    .insert({
      id_usuario_solicitante: userId,
      id_paciente_solicitante: patientId,
      id_salita_contexto: clinicId,
      ...input,
    })
    .select('id_solicitud,direccion,dni_persona_destino,parentesco,estado,fecha_creacion')
    .single();

  if (error) throw error;
  return data;
};

export const findTutorRequestsByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('solicitudes_vinculacion')
    .select('id_solicitud,direccion,dni_persona_destino,parentesco,estado,motivo_rechazo,fecha_creacion,fecha_resolucion')
    .eq('id_usuario_solicitante', userId)
    .order('fecha_creacion', { ascending: false });

  if (error) throw error;
  return data ?? [];
};

export const findTutorRequestsForAdmin = async (scope: string[] | null) => {
  if (scope !== null && scope.length === 0) return [];

  let query = supabase
    .from('solicitudes_vinculacion')
    .select(`
      id_solicitud,direccion,dni_persona_destino,parentesco,estado,motivo_rechazo,
      fecha_creacion,fecha_resolucion,id_salita_contexto,id_paciente_destino,
      id_tutor_destino,id_usuario_resolvio,
      resolutor:usuarios!solicitudes_vinculacion_id_usuario_resolvio_fkey(
        nombre_usuario,persona:personas(nombres,apellidos)
      ),
      solicitante:pacientes!solicitudes_vinculacion_id_paciente_solicitante_fkey(
        id_paciente, id_salita_asignada,
        persona:personas!pacientes_id_persona_fkey(dni,nombres,apellidos,fecha_nacimiento)
      )
    `)
    .order('fecha_creacion', { ascending: false });

  if (scope !== null) query = query.in('id_salita_contexto', scope);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(request => ({
    ...request,
    solicitante: Array.isArray(request.solicitante)
      ? request.solicitante[0] ?? null
      : request.solicitante,
  }));
};

export const findTutorRequestById = async (requestId: string) => {
  const { data, error } = await supabase
    .from('solicitudes_vinculacion')
    .select('id_solicitud,id_salita_contexto,estado,id_paciente_solicitante')
    .eq('id_solicitud', requestId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const approveTutorRequest = async (
  requestId: string,
  userId: string,
  verification: {
    identidad_verificada: true;
    documentacion_verificada: true;
    autorizacion_verificada: true;
  },
) => {
  const { data, error } = await supabase.rpc('aprobar_solicitud_vinculacion', {
    p_id_solicitud: requestId,
    p_id_usuario_admin: userId,
    p_identidad_verificada: verification.identidad_verificada,
    p_documentacion_verificada: verification.documentacion_verificada,
    p_autorizacion_verificada: verification.autorizacion_verificada,
  });

  if (error) throw error;
  return data;
};

export const rejectTutorRequest = async (
  requestId: string,
  userId: string,
  reason: string,
) => {
  const { data, error } = await supabase
    .from('solicitudes_vinculacion')
    .update({
      estado: 'RECHAZADA',
      motivo_rechazo: reason,
      id_usuario_resolvio: userId,
      fecha_resolucion: new Date().toISOString(),
    })
    .eq('id_solicitud', requestId)
    .eq('estado', 'PENDIENTE')
    .select('id_solicitud,estado,motivo_rechazo,fecha_resolucion,id_usuario_resolvio')
    .maybeSingle();

  if (error) throw error;
  return data;
};
