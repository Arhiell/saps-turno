import type { AuthenticatedUser } from '../types/auth.types.js';
import { AppError } from '../utils/app-error.js';
import { resolveManagedPatient } from './patient-managed.service.js';
import {
  findPatientHistoriaClinica,
  type PatientHistoriaClinicaData,
} from '../repositories/patient-clinical.repository.js';

export const getOwnHistoriaClinica = async (
  user: AuthenticatedUser,
  patientId?: string
): Promise<PatientHistoriaClinicaData> => {
  if (user.rol !== 'PACIENTE') {
    throw new AppError('Acceso restringido al portal del paciente', 403);
  }

  // Resuelve con estricta validación si es el titular o un tutelado autorizado
  const patient = await resolveManagedPatient(user, patientId);

  if (!patient || !patient.activo) {
    throw new AppError('El paciente no tiene un perfil activo', 403);
  }

  return await findPatientHistoriaClinica(patient.id_paciente);
};
