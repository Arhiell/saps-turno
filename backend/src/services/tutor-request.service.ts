import { getOwnPatient } from './patient-coverage.service.js';
import { emitirCambioPaciente } from './socket.service.js';
import {
  approveTutorRequest,
  createTutorRequest,
  findTutorRequestById,
  findTutorRequestsByUser,
  findTutorRequestsForAdmin,
  rejectTutorRequest,
} from '../repositories/tutor-request.repository.js';
import { findPatientDetailsByDni } from '../repositories/patient-read.repository.js';
import { getTurnoScope, assertTurnoScope } from './turno-access.service.js';
import { AppError } from '../utils/app-error.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import type { CreateTutorRequestInput, ResolveTutorRequestInput } from '../validators/tutor-request.validator.js';
import { agendaDateTime } from '../utils/turno-time.js';
import { isAdultOnDate } from '../utils/person-age.js';

export const requestTutorLink = async (
  user: AuthenticatedUser,
  input: CreateTutorRequestInput,
) => {
  const patient = await getOwnPatient(user);
  if (!patient.fecha_nacimiento) {
    throw new AppError('Tu fecha de nacimiento debe estar registrada y verificada en la salita.', 409);
  }
  const today = agendaDateTime(new Date()).date;
  if (!isAdultOnDate(patient.fecha_nacimiento, today)) {
    throw new AppError(
      input.direccion === 'DELEGAR_MI_GESTION'
        ? 'Solo una persona adulta puede delegar la gestión de sus turnos.'
        : 'Solo una persona adulta puede solicitar gestionar los turnos de otra persona.',
      403,
    );
  }
  let clinicId = patient.id_salita_asignada;

  if (input.direccion === 'GESTIONAR_A_OTRO') {
    const target = await findPatientDetailsByDni(input.dni_persona_destino);
    if (target?.activo) clinicId = target.id_salita_asignada;
  }

  try {
    return await createTutorRequest(
      user.id_usuario,
      patient.id_paciente,
      clinicId,
      input,
    );
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new AppError('Ya existe una solicitud pendiente para esos datos.', 409);
    }
    throw error;
  }
};

export const getOwnTutorRequests = (user: AuthenticatedUser) =>
  findTutorRequestsByUser(user.id_usuario);

export const getAdminTutorRequests = async (user: AuthenticatedUser) => {
  const scope = await getTurnoScope(user);
  const rows = await findTutorRequestsForAdmin(scope);
  const enriched = await Promise.all(rows.map(async request => {
    const patient = request.direccion === 'GESTIONAR_A_OTRO'
      ? await findPatientDetailsByDni(request.dni_persona_destino)
      : null;
    if (scope !== null &&
      ((request.direccion === 'DELEGAR_MI_GESTION' &&
        !scope.includes(request.solicitante?.id_salita_asignada ?? '')) ||
       (patient && !scope.includes(patient.id_salita_asignada)))) return null;
    return {
      ...request,
      solicitante: scope !== null &&
        request.direccion === 'GESTIONAR_A_OTRO' &&
        !scope.includes(request.solicitante?.id_salita_asignada ?? '')
        ? null
        : request.solicitante,
      paciente_asociado: patient ? {
        id_paciente: patient.id_paciente,
        id_salita_asignada: patient.id_salita_asignada,
        nombres: patient.nombres,
        apellidos: patient.apellidos,
        dni: patient.dni,
        fecha_nacimiento: patient.fecha_nacimiento,
      } : null,
    };
  }));
  return enriched.filter(request => request !== null);
};

export const resolveTutorRequest = async (
  user: AuthenticatedUser,
  requestId: string,
  input: ResolveTutorRequestInput,
) => {
  const request = await findTutorRequestById(requestId);
  if (!request) throw new AppError('Solicitud no encontrada.', 404);
  if (request.estado !== 'PENDIENTE') throw new AppError('La solicitud ya fue resuelta.', 409);

  const scope = await getTurnoScope(user);
  assertTurnoScope(scope, request.id_salita_contexto);

  if (input.accion === 'APROBAR') {
    try {
      const res = await approveTutorRequest(requestId, user.id_usuario, input);
      try {
        if (request.id_paciente_solicitante) {
          emitirCambioPaciente({
            tipo: 'TUTOR_VINCULACION_ACTUALIZADA',
            mensaje: 'Se aprobó la solicitud de vinculación familiar',
            id_paciente: request.id_paciente_solicitante,
            id_salita: request.id_salita_contexto,
          });
        }
      } catch {
        // La notificación websocket es secundaria
      }
      return res;
    } catch (error) {
      const message = typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message) : '';
      if (message.includes('ya fue resuelta')) throw new AppError('La solicitud ya fue resuelta.', 409);
      if (message.includes('círculo') || message.includes('circular')) throw new AppError('La vinculación generaría una relación circular.', 409);
      if (message.includes('vigente')) throw new AppError('Ya existe una autorización vigente para esta persona.', 409);
      if (message.includes('cuenta propia') || message.includes('cuenta de paciente')) {
        throw new AppError('Para aprobar, ambas personas deben tener un perfil activo y quien gestionará necesita una cuenta de paciente activa.', 409);
      }
      if (message.includes('autorizada')) throw new AppError('La solicitud no pertenece a una salita autorizada.', 403);
      if (message.includes('otra salita')) throw new AppError('El paciente pertenece a otra salita; debe revisarse allí.', 403);
      if (message.includes('adulto')) throw new AppError('Quien gestionará los turnos debe ser una persona adulta con cuenta de paciente activa.', 409);
      if (message.includes('telefono') || message.includes('teléfono')) throw new AppError('La persona autorizada debe tener un teléfono de contacto registrado en su perfil.', 409);
      throw error;
    }
  }

  const updated = await rejectTutorRequest(requestId, user.id_usuario, input.motivo_rechazo);
  if (!updated) throw new AppError('La solicitud cambió; actualizá la lista antes de continuar.', 409);
  try {
    if (request.id_paciente_solicitante) {
      emitirCambioPaciente({
        tipo: 'TUTOR_VINCULACION_ACTUALIZADA',
        mensaje: 'Se rechazó la solicitud de vinculación familiar',
        id_paciente: request.id_paciente_solicitante,
        id_salita: request.id_salita_contexto,
      });
    }
  } catch {
    // La notificación websocket es secundaria
  }
  return updated;
};
