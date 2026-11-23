import { getSalitasByProfesional } from '../repositories/profesional-salita.repository.js';
import { agendaDateTime } from '../utils/turno-time.js';

import type {
  CreateAdminInput,
  CreatePatientAccountInput,
  CreateProfessionalAccountInput,
} from '../validators/user.validator.js';

import type {
  AuthenticatedUser,
} from '../types/auth.types.js';

import { findAccountByPersonId } from '../repositories/account.repository.js';
import { getProfesionalById } from '../repositories/profesional.repository.js';

import {
  assignUserToSalita,
  createUser,
  findActiveSalitaById,
  findRoleByCode,
  findUserByEmail,
  findUserByUsername,
} from '../repositories/user.repository.js';

import { getTurnoScope } from './turno-access.service.js';
import { createVerificationCodeForNewUser } from './email-verification.service.js';
import { hashPassword } from './password.service.js';

import { duplicateMessages } from '../utils/duplicate-error.js';
import { AppError } from '../utils/app-error.js';

// Verifica que el correo y el nombre de usuario no estén registrados.
const ensureUserDoesNotExist = async (
  email: string,
  username: string
) => {
  if (await findUserByEmail(email)) {
    throw new AppError(duplicateMessages.email, 409);
  }

  if (await findUserByUsername(username)) {
    throw new AppError(duplicateMessages.username, 409);
  }
};

// Crea una cuenta administrativa o de recepción y asigna una salita si corresponde.
export const createAdminAccount = async (
  input: CreateAdminInput
) => {
  // Normaliza las credenciales del usuario.
  const email = input.email.toLowerCase();
  const username = input.nombre_usuario.trim();

  // Comprueba que la cuenta no exista.
  await ensureUserDoesNotExist(email, username);

  // Obtiene el rol administrativo o de recepción solicitado.
  const role = await findRoleByCode(input.rol);

  if (!role) {
    throw new AppError('Rol administrativo no encontrado', 500);
  }

  // Verifica la salita cuando el rol requiere asignación (ADMIN_SALITA o RECEPCION).
  const requiresSalita = input.rol === 'ADMIN_SALITA' || input.rol === 'RECEPCION';
  const salita = requiresSalita && input.id_salita
    ? await findActiveSalitaById(input.id_salita)
    : null;

  if (requiresSalita && !salita) {
    throw new AppError(
      'La salita indicada no existe o está inactiva',
      404
    );
  }

  // Genera el hash de la contraseña.
  const passwordHash = await hashPassword(input.password);

  // Registra la cuenta administrativa.
  const user = await createUser({
    id_rol: role.id_rol,
    nombre_usuario: username,
    email,
    password_hash: passwordHash,
  });

  // Asocia la cuenta a la salita correspondiente.
  if (salita) {
    await assignUserToSalita(
      user.id_usuario,
      salita.id_salita
    );
  }

  // Devuelve la cuenta con su rol y salita asignada.
  return {
    ...user,
    rol: role.codigo,
    salita: salita
      ? {
          id_salita: salita.id_salita,
          nombre: salita.nombre,
        }
      : null,
  };
};

// Crea una cuenta de usuario con el rol PACIENTE.
export const createPatientAccount = async (
  input: CreatePatientAccountInput
) => {
  // Normaliza las credenciales del paciente.
  const email = input.email.toLowerCase();
  const username = input.nombre_usuario.trim();

  // Verifica que el correo y el usuario estén disponibles.
  await ensureUserDoesNotExist(email, username);

  // Obtiene el rol PACIENTE.
  const role = await findRoleByCode('PACIENTE');

  if (!role) {
    throw new AppError('Rol PACIENTE no encontrado', 500);
  }

  // Genera el hash de la contraseña.
  const passwordHash = await hashPassword(input.password);

  // Registra la cuenta del paciente.
  const user = await createUser({
    id_rol: role.id_rol,
    nombre_usuario: username,
    email,
    password_hash: passwordHash,
  });

  // Devuelve la cuenta creada con su rol.
  return {
    ...user,
    rol: role.codigo,
  };
};

// Crea una cuenta para un profesional previamente registrado.
export const createProfessionalAccount = async (
  input: CreateProfessionalAccountInput,
  actor: AuthenticatedUser,
  ip: string | null = null
) => {
  // Comprueba que el profesional exista y esté activo.
  const professional = await getProfesionalById(
    input.id_profesional
  );

  if (!professional?.activo) {
    throw new AppError(
      'Profesional no encontrado o inactivo',
      404
    );
  }

  // Obtiene las salitas autorizadas para el usuario que realiza el registro.
  const scope = await getTurnoScope(actor);

  if (scope !== null) {
    // Verifica que el profesional pertenezca a una salita autorizada.
    const data = await getSalitasByProfesional(
      input.id_profesional, scope, agendaDateTime(new Date()).date
    );

    if (!data?.length) {
      throw new AppError(
        'El profesional no pertenece a tus salitas',
        403
      );
    }
  }

  // Comprueba que la persona no tenga una cuenta asociada.
  const existingAccount = await findAccountByPersonId(
    professional.id_persona
  );

  if (existingAccount) {
    throw new AppError(
      'La persona ya tiene una cuenta asociada',
      409
    );
  }

  // Normaliza las credenciales del profesional.
  const email = input.email.toLowerCase();
  const username = input.nombre_usuario.trim();

  // Verifica que el correo y el usuario estén disponibles.
  await ensureUserDoesNotExist(email, username);

  // Obtiene el rol PROFESIONAL.
  const role = await findRoleByCode('PROFESIONAL');

  if (!role) {
    throw new AppError(
      'Rol PROFESIONAL no encontrado',
      500
    );
  }

  // Genera el hash de la contraseña.
  const passwordHash = await hashPassword(input.password);

  // Registra la cuenta vinculada a la persona del profesional.
  const user = await createUser({
    id_persona: professional.id_persona,
    id_rol: role.id_rol,
    nombre_usuario: username,
    email,
    password_hash: passwordHash,
  });

  // Genera y envía el código de verificación del correo.
  const verificationExpiresAt = await createVerificationCodeForNewUser(
    user.id_usuario,
    email,
    ip
  );

  // Devuelve la cuenta y el vencimiento de la verificación.
  return {
    ...user,
    rol: role.codigo,
    verificationExpiresAt,
  };
};
