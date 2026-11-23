import { agendaDateTime } from '../utils/turno-time.js';
import { supabase } from "../config/supabase.js";

import type { UpdatePatientTutorInput } from "../validators/patient-tutor.validator.js";


/**
 * Busca una relación vigente entre un paciente y un tutor.
 */
export const findActivePatientTutorRelation = async (
  patientId: string,
  tutorId: string
) => {
  const { data, error } = await supabase
    .from("paciente_tutores")
    .select("*")
    .eq("id_paciente", patientId)
    .eq("id_tutor", tutorId)
    .or(`fecha_hasta.is.null,fecha_hasta.gte.${agendaDateTime(new Date()).date}`)
    .maybeSingle();

  if (error) throw error;

  return data;
};


/**
 * Busca el tutor principal vigente de un paciente.
 */
export const findCurrentPrincipalTutor = async (
  patientId: string
) => {
  const { data, error } = await supabase
    .from("paciente_tutores")
    .select("*")
    .eq("id_paciente", patientId)
    .eq("es_principal", true)
    .or(`fecha_hasta.is.null,fecha_hasta.gte.${agendaDateTime(new Date()).date}`)
    .maybeSingle();

  if (error) throw error;

  return data;
};


/**
 * Lista los tutores relacionados actualmente con un paciente.
 */
export const findTutorsByPatientId = async (
  patientId: string
) => {
  const { data, error } = await supabase
    .from("paciente_tutores")
    .select("*")
    .eq("id_paciente", patientId)
    .order("es_principal", { ascending: false })
    .order("fecha_desde", { ascending: false });

  if (error) throw error;

  return data ?? [];
};

export const findPatientTutorHistory = async (
  patientId: string,
  tutorIds: string[],
) => {
  if (tutorIds.length === 0) return [];
  const { data, error } = await supabase
    .from('paciente_tutores_historial')
    .select(`
      id_historial,id_paciente,id_tutor,accion,fecha,datos_anteriores,datos_nuevos,
      actor:usuarios!paciente_tutores_historial_id_usuario_fkey(
        nombre_usuario,persona:personas(nombres,apellidos)
      )
    `)
    .eq('id_paciente', patientId)
    .in('id_tutor', tutorIds)
    .order('fecha', { ascending: false });

  if (error) throw error;
  return data ?? [];
};


/**
 * Lista los pacientes relacionados actualmente con un tutor.
 */
export const findPatientsByTutorId = async (
  tutorId: string
) => {
  const today = agendaDateTime(new Date()).date;
  const { data, error } = await supabase
    .from("paciente_tutores")
    .select("*")
    .eq("id_tutor", tutorId)
    .eq("puede_gestionar_turnos", true)
    .eq("identidad_verificada", true)
    .eq("documentacion_verificada", true)
    .eq("autorizacion_verificada", true)
    .lte("fecha_desde", today)
    .or(`fecha_hasta.is.null,fecha_hasta.gte.${today}`)
    .order("fecha_desde", { ascending: true });

  if (error) throw error;

  return data ?? [];
};


/**
 * Actualiza datos propios de la relación.
 */
export const updatePatientTutorRelation = async (
  patientId: string,
  tutorId: string,
  input: UpdatePatientTutorInput,
  userId: string,
) => {
  const { data, error } = await supabase
    .from("paciente_tutores")
    .update({
      ...input,
      id_usuario_modifico: userId,
      fecha_modificacion: new Date().toISOString(),
    })
    .eq("id_paciente", patientId)
    .eq("id_tutor", tutorId)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  return data;
};


/**
 * Finaliza la relación sin eliminarla físicamente.
 */
export const endPatientTutorRelation = async (
  patientId: string,
  tutorId: string,
  endDate: string,
  userId: string,
) => {
  const { data, error } = await supabase
    .from("paciente_tutores")
    .update({
      fecha_hasta: endDate,
      puede_gestionar_turnos: false,
      id_usuario_modifico: userId,
      fecha_modificacion: new Date().toISOString(),
    })
    .eq("id_paciente", patientId)
    .eq("id_tutor", tutorId)
    .or(`fecha_hasta.is.null,fecha_hasta.gte.${agendaDateTime(new Date()).date}`)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  return data;
};
