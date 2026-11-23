import { supabase } from '../config/supabase.js';

import { findUserById } from '../repositories/user.repository.js';
import { getRolePermissions } from './permission.service.js';

import {
  findPersonByDni,
  findPersonsByEmail,
  findPersonById,
} from '../repositories/person-read.repository.js';

import { createPerson } from '../repositories/person.repository.js';

import {
  findPatientByPersonId,
  findPatientById,
} from '../repositories/patient-read.repository.js';

import { createPatient } from '../repositories/patient.repository.js';

import {
  createPatientSchema,
  patientProfileSchema,
} from '../validators/patient.validator.js';

import { createPersonSchema } from '../validators/person.validator.js';

import { splitPatientInput } from './patient-data.js';

import { AppError } from '../utils/app-error.js';
import { rethrowPatientError } from '../utils/profile-error.js';
import { getProfileRoleInfo } from './profile-role.service.js';

import type {
  AuthenticatedUser,
} from '../types/auth.types.js';

// Obtiene el perfil completo del usuario autenticado.
export const getOwnProfile = async (
  user: AuthenticatedUser
) => {
  // Busca la cuenta del usuario.
  const account = await findUserById(user.id_usuario);

  if (!account) {
    throw new AppError('Usuario no encontrado', 401);
  }

  // Obtiene el paciente asociado si corresponde.
  const patient = user.rol === 'PACIENTE' && account.id_persona
    ? await findPatientByPersonId(account.id_persona)
    : null;

  // Resuelve los permisos activos asignados al rol del usuario desde PostgreSQL.
  const rolePermissions = await getRolePermissions({
    codigo: user.rol,
    ...(user.id_rol ? { idRol: user.id_rol } : {}),
  });

  const permisos = rolePermissions?.activo
    ? Array.from(rolePermissions.permissions).sort()
    : [];

  // Devuelve los datos de cuenta, rol, persona y paciente.
  return {
    user: {
      ...user,
      id_persona: account.id_persona,
      activo: account.activo,
      email_verificado: account.email_verificado,
      perfil_completo: Boolean(account.id_persona),
      permisos,
    },
    roleInfo: await getProfileRoleInfo(
      user.rol,
      user.id_usuario,
      account.id_persona
    ),
    person: account.id_persona
      ? await findPersonById(account.id_persona)
      : null,
    patient: patient
      ? await findPatientById(patient.id_paciente)
      : null,
  };
};

// Completa los datos personales y clínicos del paciente autenticado.
export const completeOwnProfile = async (
  body: unknown,
  user: AuthenticatedUser
) => {
  // Verifica que el usuario tenga el rol de paciente.
  if (user.rol !== 'PACIENTE') {
    throw new AppError('Solo pacientes', 403);
  }

  // Valida los datos recibidos.
  const input = createPatientSchema
    .omit({ email: true })
    .parse(body);

  // Obtiene la cuenta del usuario.
  const account = await findUserById(user.id_usuario);

  if (!account) {
    throw new AppError('Usuario no encontrado', 401);
  }

  // Evita completar un perfil de paciente existente.
  if (
    account.id_persona &&
    await findPatientByPersonId(account.id_persona)
  ) {
    throw new AppError('El perfil ya está completo', 409);
  }

  // Comprueba si el DNI ya pertenece a una persona registrada.
  const existing = await findPersonByDni(input.dni);

  if (existing && existing.id_persona !== account.id_persona) {
    throw new AppError(
      'El DNI ya está registrado. Contactá a tu salita para vincular tu cuenta sin duplicar el paciente.',
      409
    );
  }

  // Verifica que el DNI coincida con la persona vinculada.
  if (
    account.id_persona &&
    existing?.id_persona !== account.id_persona
  ) {
    throw new AppError(
      'El DNI no coincide con tu persona registrada',
      409
    );
  }

  // Comprueba que el correo no pertenezca a otra persona.
  const emailPersons = await findPersonsByEmail(account.email);

  if (
    emailPersons.some(
      person => person.id_persona !== account.id_persona
    )
  ) {
    throw new AppError(
      'Tu correo ya está asociado a una persona. Contactá a tu salita para vincular tu cuenta.',
      409
    );
  }

  // Separa los datos personales de los datos del paciente.
  const parts = splitPatientInput({
    ...input,
    email: account.email,
  });

  // Utiliza la persona existente o registra una nueva.
  const person = existing ?? await createPerson(
    createPersonSchema.parse(parts.person)
  );

  // Vincula la persona a la cuenta si todavía no tiene una.
  if (!account.id_persona) {
    const { data, error } = await supabase
      .from('usuarios')
      .update({
        id_persona: person.id_persona,
      })
      .eq('id_usuario', user.id_usuario)
      .is('id_persona', null)
      .select('id_usuario')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new AppError(
        'La cuenta cambió. Volvé a consultar tu perfil',
        409
      );
    }
  }

  // Registra el perfil del paciente con sus datos validados.
  try {
    await createPatient({
      ...patientProfileSchema.parse(parts.patient),
      id_persona: person.id_persona,
    });
  } catch (error) {
    rethrowPatientError(error);
  }

  // Devuelve el perfil actualizado.
  return getOwnProfile(user);
};

// Obtiene el identificador del paciente o profesional autenticado.
export const getOwnEntity = async (
  user: AuthenticatedUser
) => {
  // Comprueba que la cuenta tenga una persona vinculada.
  const account = await findUserById(user.id_usuario);

  if (!account?.id_persona) {
    throw new AppError(
      'Completá o vinculá tu perfil en la salita',
      403
    );
  }

  // Determina la entidad correspondiente según el rol.
  const professional = user.rol === 'PROFESIONAL';

  const key = professional
    ? 'id_profesional'
    : 'id_paciente';

  // Busca la entidad activa asociada a la persona.
  const { data, error } = await supabase
    .from(professional ? 'profesionales' : 'pacientes')
    .select(key)
    .eq('id_persona', account.id_persona)
    .eq('activo', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  // Obtiene el identificador de la entidad.
  const id = (
    data as unknown as Record<string, string> | null
  )?.[key];

  if (!id) {
    throw new AppError(
      'No tenés un perfil activo asociado',
      403
    );
  }

  return { key, id };
};