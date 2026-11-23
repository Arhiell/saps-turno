import { supabase } from '../config/supabase.js';
import { getOwnEntity } from './auth-profile.service.js';
import { findPatientById } from '../repositories/patient-read.repository.js';
import { agendaDateTime } from '../utils/turno-time.js';
import { AppError } from '../utils/app-error.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import { resolveManagedKinship } from '../utils/kinship.util.js';

const currentRelations = async (user: AuthenticatedUser) => {
  if (user.rol !== 'PACIENTE') throw new AppError('Solo pacientes', 403);
  const own = await getOwnEntity(user);
  const patient = await findPatientById(own.id);
  if (!patient?.activo) throw new AppError('No tenés un perfil activo', 403);
  const { data: tutor, error } = await supabase.from('tutores').select('id_tutor')
    .eq('id_persona', patient.id_persona).eq('activo', true).maybeSingle();
  if (error) throw error;
  if (!tutor) return { patient, relations: [] };
  const today = agendaDateTime(new Date()).date;
  const { data, error: relationError } = await supabase.from('paciente_tutores')
    .select('id_paciente,parentesco,fecha_desde,fecha_hasta')
    .eq('id_tutor', tutor.id_tutor).eq('puede_gestionar_turnos', true)
    .eq('identidad_verificada', true).eq('documentacion_verificada', true)
    .eq('autorizacion_verificada', true)
    .lte('fecha_desde', today).or(`fecha_hasta.is.null,fecha_hasta.gte.${today}`);
  if (relationError) throw relationError;
  const relations = data ?? [];
  return { patient, relations };
};

// El titular sigue siendo el actor; el paciente atendido se resuelve por un vínculo autorizado.
export const resolveManagedPatient = async (user: AuthenticatedUser, patientId?: string, date?: string) => {
  const { patient, relations } = await currentRelations(user);
  if (!patientId || patientId === patient.id_paciente) return patient;
  const relation = relations.find(row => row.id_paciente === patientId);
  if (!relation) {
    throw new AppError('No tenés un vínculo vigente que permita gestionar los turnos de esta persona.', 403);
  }
  if (date && (relation.fecha_desde > date || (relation.fecha_hasta && relation.fecha_hasta < date))) {
    throw new AppError('La autorización del tutor no cubre la fecha del turno.', 400, 'TUTORSHIP_DATE_EXPIRED');
  }
  const dependent = await findPatientById(patientId);
  if (!dependent?.activo) throw new AppError('El paciente a cargo no tiene un perfil activo.', 403);
  return dependent;
};

export const getManagedPatients = async (user: AuthenticatedUser) => {
  const { patient: titular, relations } = await currentRelations(user);
  const rows = await Promise.all(relations.map(async relation => {
    const patient = await findPatientById(relation.id_paciente);
    if (!patient?.activo) return null;

    const parentescoRepresentado = resolveManagedKinship({
      storedRelationship: relation.parentesco,
      dependentSex: patient.sexo,
      dependentBirthDate: patient.fecha_nacimiento,
      userSex: titular?.sexo,
      userBirthDate: titular?.fecha_nacimiento,
    });

    return {
      id_paciente: patient.id_paciente,
      id_barrio: patient.id_barrio,
      id_salita_asignada: patient.id_salita_asignada,
      nombres: patient.nombres,
      apellidos: patient.apellidos,
      dni: patient.dni,
      telefono: patient.telefono ?? null,
      fecha_nacimiento: patient.fecha_nacimiento,
      sexo: patient.sexo,
      parentesco: parentescoRepresentado,
      parentesco_declarado: relation.parentesco,
      parentesco_representado: parentescoRepresentado,
      fecha_hasta: relation.fecha_hasta,
    };
  }));
  return rows.filter(row => row !== null);
};
