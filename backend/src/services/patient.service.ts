import {
  createPatient,
} from '../repositories/patient.repository.js';

import {
  findPatientByPersonId,
} from '../repositories/patient-read.repository.js';

import {
  AppError,
} from '../utils/app-error.js';

import {
  duplicateMessages,
} from '../utils/duplicate-error.js';

import {
  hasDatabaseCode,
  rethrowPatientError,
} from '../utils/profile-error.js';

import {
  patientProfileSchema,
  type CreatePatientInput,
} from '../validators/patient.validator.js';

import {
  createPersonSchema,
} from '../validators/person.validator.js';

import {
  splitPatientInput,
} from './patient-data.js';

import {
  findOrCreatePerson,
} from './person.service.js';

import {
  emitirCambioPaciente,
} from './socket.service.js';

// Genera el error utilizado cuando el paciente ya existe.
const duplicatePatient = () =>
  new AppError(
    duplicateMessages.dni,
    409
  );

// Registra una persona como paciente en el sistema.
export const registerPatient = async (
  input: CreatePatientInput
) => {
  // Separa los datos personales de los datos del paciente.
  const parts =
    splitPatientInput(input);

  // Busca o crea la persona asociada al paciente.
  const person =
    await findOrCreatePerson(
      createPersonSchema.parse({
        ...parts.person,
        localidad:
          parts.person.localidad ??
          'Goya',
        provincia:
          parts.person.provincia ??
          'Corrientes',
      })
    );

  // Evita registrar dos pacientes para la misma persona.
  if (
    await findPatientByPersonId(
      person.id_persona
    )
  ) {
    throw duplicatePatient();
  }

  try {
    // Valida y crea el perfil del paciente.
    const created = await createPatient({
      ...patientProfileSchema.parse(
        parts.patient
      ),
      id_persona:
        person.id_persona,
    });

    try {
      emitirCambioPaciente({
        tipo: 'PACIENTE_CREADO',
        mensaje: `Nuevo paciente registrado: ${person.apellidos}, ${person.nombres}`,
        id_paciente: created.id_paciente,
        id_salita: created.id_salita_asignada,
        activo: created.activo,
        nombre_paciente: `${person.nombres} ${person.apellidos}`,
        dni_paciente: person.dni,
      });
    } catch {
      // Notificación en tiempo real es complementaria
    }

    return created;
  } catch (error) {
    // Comprueba nuevamente el duplicado ante una restricción única.
    if (
      hasDatabaseCode(
        error,
        '23505'
      ) &&
      await findPatientByPersonId(
        person.id_persona
      )
    ) {
      throw duplicatePatient();
    }

    // Convierte los errores de base de datos en errores del dominio.
    rethrowPatientError(error);
  }
};