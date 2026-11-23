import type {
  UpdatePatientInput,
} from '../validators/patient-update.validator.js';

import type {
  AuthenticatedUser,
} from '../types/auth.types.js';

import {
  getOwnEntity,
} from './auth-profile.service.js';

import {
  ownPatientUpdateSchema,
} from '../validators/patient-update.validator.js';

import {
  resolvePatientSalita,
} from './patient-coverage.service.js';

import {
  findPatientById,
} from '../repositories/patient-read.repository.js';

import {
  updatePatient,
  updatePatientStatus,
} from '../repositories/patient-update.repository.js';

import {
  editPerson,
  validatePersonUpdate,
} from './person.service.js';

import {
  splitPatientInput,
} from './patient-data.js';

import {
  AppError,
} from '../utils/app-error.js';

import {
  rethrowPatientError,
} from '../utils/profile-error.js';

import {
  emitirCambioPaciente,
} from './socket.service.js';

// ========================================
// AUTOGESTIÓN DEL PACIENTE
// ========================================

// Permite al paciente autenticado actualizar
// los datos habilitados de su propio perfil.
export const editOwnPatient = async (
  body: unknown,
  user: AuthenticatedUser
) => {
  // Solo los pacientes pueden modificar su propio perfil.
  if (user.rol !== 'PACIENTE') {
    throw new AppError(
      'Solo pacientes',
      403
    );
  }

  // Valida únicamente los campos permitidos
  // para la autogestión del paciente.
  const input =
    ownPatientUpdateSchema.parse(
      body
    );

  // La identidad se resuelve desde la sesión,
  // nunca desde el formulario.
  const own = await getOwnEntity(
    user
  );

  // Obtiene los datos actuales del paciente.
  const current = await findPatientById(
    own.id
  );

  if (!current) {
    throw new AppError(
      'Paciente no encontrado',
      404
    );
  }

  // Si cambia el barrio, resuelve nuevamente
  // la salita correspondiente según cobertura.
  const salita = input.id_barrio
    ? await resolvePatientSalita(
        input.id_barrio,
        current.id_salita_asignada
      )
    : undefined;

  // Actualiza el paciente con los datos permitidos.
  return editPatient(
    own.id,
    {
      ...input,
      ...(salita
        ? {
            id_salita_asignada: salita,
          }
        : {}),
    }
  );
};

// ========================================
// ACTUALIZACIÓN DE PACIENTE
// ========================================

// Actualiza los datos personales y específicos
// asociados a un paciente.
export const editPatient = async (
  idPatient: string,
  input: UpdatePatientInput
) => {
  // Verifica que el paciente exista.
  const current = await findPatientById(
    idPatient
  );

  if (!current) {
    throw new AppError(
      'Paciente no encontrado',
      404
    );
  }

  // Separa los datos de persona
  // de los datos propios del paciente.
  const {
    person,
    patient,
  } = splitPatientInput(
    input
  );

  // Valida los cambios correspondientes a la persona.
  await validatePersonUpdate(
    current.id_persona,
    person
  );

  try {
    // El trigger de cobertura se ejecuta antes
    // de cambiar los datos compartidos.
    if (
      Object.values(patient).some(
        (value) => value !== undefined
      )
    ) {
      await updatePatient(
        idPatient,
        patient
      );
    }

    // Actualiza los datos personales si fueron enviados.
    if (
      Object.values(person).some(
        (value) => value !== undefined
      )
    ) {
      await editPerson(
        current.id_persona,
        person
      );
    }

    // Devuelve el paciente con sus datos actualizados.
    const updated = await findPatientById(
      idPatient
    );

    if (updated) {
      try {
        emitirCambioPaciente({
          tipo: 'PACIENTE_ACTUALIZADO',
          mensaje: `Paciente actualizado: ${updated.apellidos || ''}, ${updated.nombres || ''}`,
          id_paciente: updated.id_paciente,
          id_salita: updated.id_salita_asignada ?? undefined,
          activo: updated.activo,
          nombre_paciente: `${updated.nombres || ''} ${updated.apellidos || ''}`.trim(),
          dni_paciente: updated.dni ?? undefined,
        });
      } catch {
        // Notificación en tiempo real es complementaria
      }
    }

    return updated;
  } catch (error) {
    // Convierte errores de base de datos
    // en errores propios del dominio.
    rethrowPatientError(
      error
    );
  }
};

// ========================================
// ESTADO DEL PACIENTE
// ========================================

// Activa o desactiva un paciente.
export const changePatientStatus = async (
  idPatient: string,
  active: boolean
) => {
  // Verifica que el paciente exista.
  const patient = await findPatientById(
    idPatient
  );

  if (!patient) {
    throw new AppError(
      'Paciente no encontrado',
      404
    );
  }

  // Evita aplicar nuevamente el mismo estado.
  if (patient.activo === active) {
    throw new AppError(
      active
        ? 'El paciente ya está activo'
        : 'El paciente ya está inactivo',
      409
    );
  }

  // Actualiza el estado del paciente.
  const result = await updatePatientStatus(
    idPatient,
    active
  );

  try {
    emitirCambioPaciente({
      tipo: 'PACIENTE_ESTADO_CAMBIADO',
      mensaje: `Paciente ${active ? 'activado' : 'desactivado'}`,
      id_paciente: idPatient,
      id_salita: patient.id_salita_asignada ?? undefined,
      activo: active,
      nombre_paciente: `${patient.nombres || ''} ${patient.apellidos || ''}`.trim(),
      dni_paciente: patient.dni ?? undefined,
    });
  } catch {
    // Notificación en tiempo real es complementaria
  }

  return result;
};