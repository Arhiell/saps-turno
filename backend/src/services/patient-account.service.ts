import { supabase } from '../config/supabase.js';
import { findUserByEmail, findUserById, findRoleByCode } from '../repositories/user.repository.js';
import { findAccountByPersonId } from '../repositories/account.repository.js';
import { getPatientById } from './patient-read.service.js';
import { getTurnoScope, assertTurnoScope } from './turno-access.service.js';
import { AppError } from '../utils/app-error.js';
import { hasDatabaseCode } from '../utils/profile-error.js';
import type { AuthenticatedUser } from '../types/auth.types.js';

// Vinculación administrativa: conocer un DNI o verificar un correo no permite
// apropiarse por autoservicio de una ficha previamente registrada.
export async function linkPatientAccount(patientId: string, email: string, actor: AuthenticatedUser) {
  if (!['SUPER_ADMIN', 'ADMIN_SALITA'].includes(actor.rol)) throw new AppError('No tenés permisos para vincular cuentas.', 403);
  const patient = await getPatientById(patientId);
  assertTurnoScope(await getTurnoScope(actor), patient.id_salita_asignada);
  if (!patient.activo) throw new AppError('El paciente debe estar activo.', 409);
  if (await findAccountByPersonId(patient.id_persona)) throw new AppError('El paciente ya tiene una cuenta. Usá la recuperación de acceso de esa cuenta.', 409);
  const found = await findUserByEmail(email);
  const account = found ? await findUserById(found.id_usuario) : null;
  const role = await findRoleByCode('PACIENTE');
  if (!account || !role || account.id_rol !== role.id_rol) throw new AppError('Primero registrá una cuenta de paciente con el correo propio de esta persona.', 400);
  if (!account.activo || !account.email_verificado) throw new AppError('La cuenta propia debe estar activa y tener su correo verificado. Esto no se exige para ser una persona a cargo.', 409);
  if (account.id_persona) throw new AppError('Esta cuenta ya pertenece a otra persona. No uses la cuenta del tutor para el paciente a cargo.', 409);
  const { data, error } = await supabase.from('usuarios').update({ id_persona: patient.id_persona })
    .eq('id_usuario', account.id_usuario).is('id_persona', null)
    .eq('id_rol', role.id_rol).eq('activo', true).eq('email_verificado', true)
    .select('id_usuario').maybeSingle();
  if (error) {
    if (hasDatabaseCode(error, '23505')) throw new AppError('La ficha ya fue vinculada a una cuenta. Actualizá la página.', 409);
    throw error;
  }
  if (!data) throw new AppError('La cuenta cambió. Actualizá los datos antes de continuar.', 409);
  // Conserva el mismo paciente, su historial, cobertura y vínculos autorizados.
}
