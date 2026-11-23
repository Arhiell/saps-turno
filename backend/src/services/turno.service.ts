import { randomUUID } from 'node:crypto';

import { assertOwnCoverage } from './patient-coverage.service.js';
import { validateTurnoAgenda } from './turno-agenda.service.js';
import {
  getTurnoScope,
  assertTurnoScope,
} from './turno-access.service.js';
import { getTurnoState } from './turno-read.service.js';
import { notifyTurnoCreado } from './notificacion-turno.service.js';
import { emitirCambioAgenda } from './socket.service.js';

import { insertTurno } from '../repositories/turno.repository.js';
import { findPatientById } from '../repositories/patient-read.repository.js';

import { agendaDateTime } from '../utils/turno-time.js';
import { assertBookingDate } from '../utils/booking-window.js';
import { AppError } from '../utils/app-error.js';

import type { CreateTurnoInput } from '../validators/turno.validator.js';
import type { AuthenticatedUser } from '../types/auth.types.js';

// Crea un turno verificando los permisos y la disponibilidad.
export const createTurno = async (
  input: CreateTurnoInput,
  user: AuthenticatedUser
) => {
  // Impide crear reservas en horarios vencidos para cualquier rol
  const inicioTimestamp = new Date(input.fecha_hora_inicio).getTime();
  if (Number.isFinite(inicioTimestamp) && inicioTimestamp <= Date.now()) {
    throw new AppError(
      'No se pueden reservar turnos en fechas u horarios que ya han pasado',
      400
    );
  }

  // Valida la cobertura y la identidad del paciente.
  if (user.rol === 'PACIENTE') {
    assertBookingDate(
      agendaDateTime(input.fecha_hora_inicio).date
    );

    const patient = await assertOwnCoverage(
      user,
      input.id_salita,
      agendaDateTime(input.fecha_hora_inicio).date,
      input.id_paciente
    );

    if (patient.id_paciente !== input.id_paciente) {
      throw new AppError(
        'Paciente inválido',
        403
      );
    }
  } else {
    // Verifica que el usuario tenga acceso a la salita.
    assertTurnoScope(
      await getTurnoScope(user),
      input.id_salita
    );
  }

  // Obtiene el estado inicial del turno.
  const state = await getTurnoState('SOLICITADO');

  // Comprueba que el estado permita reservar agenda.
  if (
    !state.ocupa_agenda ||
    state.es_estado_final
  ) {
    throw new AppError(
      'El estado SOLICITADO no está configurado para reservar agenda',
      400
    );
  }

  // Valida el horario y la disponibilidad del turno.
  const agenda = await validateTurnoAgenda(input);

  // Genera un código público sin datos personales.
  // Respeta el límite VARCHAR(30) definido en SQL.
  const turno = await insertTurno({
    ...input,
    ...agenda,
    id_estado: state.id_estado,
    codigo_turno: `T-${randomUUID()
      .replaceAll('-', '')
      .slice(0, 28)}`,
    creado_por: user.id_usuario,
  });

  // Envía la notificación después de registrar el turno.
  await notifyTurnoCreado(turno.id_turno);

  // Emite evento en tiempo real para el profesional afectado
  try {
    const patientData = await findPatientById(input.id_paciente);
    const pacienteNombre = patientData
      ? `${patientData.apellidos ?? ''} ${patientData.nombres ?? ''}`.trim() || 'Paciente'
      : 'Paciente';

    const fechaInfo = agendaDateTime(turno.fecha_hora_inicio);

    emitirCambioAgenda({
      tipo: 'TURNO_CREADO',
      mensaje: 'Se agregó un nuevo turno a tu agenda',
      id_turno: turno.id_turno,
      id_paciente: turno.id_paciente,
      id_profesional: turno.id_profesional,
      id_salita: turno.id_salita,
      paciente: pacienteNombre,
      nueva_fecha: fechaInfo.date,
      nuevo_horario: fechaInfo.time.slice(0, 5),
    });
  } catch (err) {
    // La notificación WebSocket no debe impedir la creación del turno
    console.error('Error al emitir evento de turno creado:', err);
  }

  return turno;
};
