import {
  getOwnEntity,
} from './auth-profile.service.js';

import {
  findPatientById,
} from '../repositories/patient-read.repository.js';

import {
  getSalitasByBarrio,
} from '../repositories/salita-barrio.repository.js';

import {
  getSalitaById,
} from '../repositories/salita.repository.js';

import {
  getBarrioById,
} from '../repositories/barrio.repository.js';

import {
  agendaDateTime,
} from '../utils/turno-time.js';

import {
  AppError,
} from '../utils/app-error.js';

import type {
  AuthenticatedUser,
} from '../types/auth.types.js';
import { resolveManagedPatient } from './patient-managed.service.js';

// ========================================
// COBERTURA DE SALITAS
// ========================================

// Obtiene las salitas con cobertura vigente
// para un barrio y una fecha determinada.
export const getCoveredSalitas = async (
  barrio: string,
  date: string
) => {
  // Verifica que el barrio exista y esté activo.
  if (
    !(await getBarrioById(barrio))?.activo
  ) {
    return [];
  }

  // Obtiene las relaciones entre el barrio y las salitas.
  const rows = await getSalitasByBarrio(
    barrio
  );

  // Conserva solamente las coberturas activas
  // y vigentes para la fecha indicada.
  const current = rows.filter(
    (row) =>
      row.activo &&
      row.fecha_desde <= date &&
      (
        !row.fecha_hasta ||
        row.fecha_hasta >= date
      )
  );

  // Obtiene los datos de cada salita con cobertura.
  const clinics = await Promise.all(
    current.map(
      (row) =>
        getSalitaById(row.id_salita)
    )
  );

  // Devuelve únicamente salitas activas.
  return clinics
    .filter(
      (clinic) => clinic?.activo
    )
    .map(
      (clinic) => clinic!
    );
};

// ========================================
// PACIENTE AUTENTICADO
// ========================================

// Obtiene el paciente asociado al usuario autenticado.
export const getOwnPatient = async (
  user: AuthenticatedUser
) => {
  // Solo las cuentas de pacientes pueden acceder.
  if (user.rol !== 'PACIENTE') {
    throw new AppError(
      'Solo pacientes',
      403
    );
  }

  // Obtiene la entidad vinculada a la cuenta.
  const own = await getOwnEntity(
    user
  );

  // Busca el perfil completo del paciente.
  const patient = await findPatientById(
    own.id
  );

  // Verifica que el perfil continúe activo.
  if (!patient?.activo) {
    throw new AppError(
      'No tenés un perfil activo',
      403
    );
  }

  return patient;
};

// ========================================
// RESOLUCIÓN DE SALITA
// ========================================

// Conserva la asignación si es válida;
// nunca elige arbitrariamente entre salitas.
export const resolvePatientSalita = async (
  barrio: string,
  current: string
) => {
  // Obtiene las salitas con cobertura vigente actualmente.
  const clinics = await getCoveredSalitas(
    barrio,
    agendaDateTime(
      new Date()
    ).date
  );

  // Conserva la salita actual si todavía tiene cobertura.
  if (
    clinics.some(
      (clinic) =>
        clinic.id_salita === current
    )
  ) {
    return current;
  }

  // Si existe una única opción, utiliza esa salita.
  if (clinics.length === 1) {
    return clinics[0]!.id_salita;
  }

  // Si hay múltiples opciones o ninguna,
  // requiere una revisión administrativa.
  throw new AppError(
    'El barrio requiere revisión de cobertura. Contactá a tu salita para actualizarlo.',
    409
  );
};

// ========================================
// VALIDACIÓN DE COBERTURA
// ========================================

// Verifica que la salita solicitada corresponda
// a la cobertura vigente del paciente.
export const assertOwnCoverage = async (
  user: AuthenticatedUser,
  salita: string,
  date: string,
  patientId?: string
) => {
  // Obtiene el paciente autenticado.
  const patient = await resolveManagedPatient(user, patientId, date);

  // Obtiene las salitas cubiertas por su barrio.
  const clinics = await getCoveredSalitas(
    patient.id_barrio,
    date
  );

  // Verifica la asignación y la cobertura vigente.
  if (
    patient.id_salita_asignada !== salita ||
    !clinics.some(
      (clinic) =>
        clinic.id_salita === salita
    )
  ) {
    throw new AppError(
      'La salita no corresponde a tu cobertura vigente. Consultá tu perfil o contactá a administración.',
      403
    );
  }

  return patient;
};
