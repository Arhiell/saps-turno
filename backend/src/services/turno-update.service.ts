
import { patchTurno } from "../repositories/turno-update.repository.js";

import {
  getTurno,
  getTurnoState,
} from "./turno-read.service.js";

import {
  getTurnoScope,
  assertTurnoScope,
} from "./turno-access.service.js";

import { validateTurnoAgenda } from "./turno-agenda.service.js";
import { AppError } from "../utils/app-error.js";

import type { TurnoRow } from "../types/turno.types.js";
import type { AuthenticatedUser } from "../types/auth.types.js";

import { agendaDateTime } from "../utils/turno-time.js";

import type {
  UpdateTurnoInput,
  TurnoStatusInput,
} from "../validators/turno-update.validator.js";

import {
  notifyTurnoReprogramado,
  notifyTurnoCancelado,
  notifyCambioProfesional,
} from "./notificacion-turno.service.js";

import { findPatientById } from "../repositories/patient-read.repository.js";
import { emitirCambioAgenda } from "./socket.service.js";

// Verifica que el turno permita modificaciones.
const assertEditable = (turno: TurnoRow) => {
  // Respeta los estados finales definidos en el catálogo.
  if (turno.estado.es_estado_final) {
    throw new AppError(
      "El turno tiene un estado final y no admite modificaciones",
      409
    );
  }
};

// Verifica que la actualización se haya realizado correctamente.
const requireUpdated = (turno: TurnoRow | null) => {
  if (!turno) {
    throw new AppError(
      "El turno cambió; vuelva a consultar antes de modificarlo",
      409
    );
  }

  return turno;
};

const getPatientName = async (patientId: string): Promise<string> => {
  try {
    const p = await findPatientById(patientId);
    if (!p) return 'Paciente';
    return `${p.apellidos ?? ''} ${p.nombres ?? ''}`.trim() || 'Paciente';
  } catch {
    return 'Paciente';
  }
};

// Actualiza los datos o reprograma un turno existente.
export const updateTurno = async (
  id: string,
  request: UpdateTurnoInput,
  user: AuthenticatedUser,
  context?: {
    version: number;
    motivo: string;
  }
) => {
  const {
    motivo_reprogramacion,
    version,
    ...input
  } = request;

  const expectedVersion = context?.version ?? version;

  // Restringe la reprogramación según el rol del usuario.
  if (["PACIENTE", "PROFESIONAL"].includes(user.rol)) {
    throw new AppError(
      "No tiene permisos para reprogramar turnos",
      403
    );
  }

  const current = await getTurno(id, user);

  assertEditable(current);

  // Comprueba que el turno conserve la versión esperada.
  if (
    expectedVersion !== undefined &&
    current.version !== expectedVersion
  ) {
    throw new AppError(
      'El turno cambió; volvé a consultarlo antes de confirmar',
      409
    );
  }

  // Identifica si se modifican datos relacionados con la agenda.
  const scheduleChanged = [
    "id_profesional",
    "id_especialidad",
    "id_salita",
    "id_horario",
    "fecha_hora_inicio",
  ].some((key) => key in input);

  // Actualiza la información y avisa al profesional después de guardar.
  if (!scheduleChanged) {
    const updatedNoSchedule = requireUpdated(
      await patchTurno(id, current.version, input)
    );

    try {
      const pacienteNombre = await getPatientName(current.id_paciente);

      emitirCambioAgenda({
        tipo: 'TURNO_ACTUALIZADO',
        mensaje: 'Se modificó la información de un turno en tu agenda',
        id_turno: updatedNoSchedule.id_turno,
        id_paciente: current.id_paciente,
        id_profesional: updatedNoSchedule.id_profesional,
        id_salita: updatedNoSchedule.id_salita,
        paciente: pacienteNombre,
        nueva_fecha: agendaDateTime(updatedNoSchedule.fecha_hora_inicio).date,
        nuevo_horario: agendaDateTime(updatedNoSchedule.fecha_hora_inicio).time.slice(0, 5),
      });
    } catch (err) {
      console.error('Error al emitir evento de turno actualizado:', err);
    }

    return updatedNoSchedule;
  }

  // Construye los datos del turno que será reprogramado.
  const candidate = {
    id_paciente: current.id_paciente,
    id_profesional: input.id_profesional ?? current.id_profesional,
    id_especialidad: input.id_especialidad ?? current.id_especialidad,
    id_salita: input.id_salita ?? current.id_salita,
    fecha_hora_inicio: input.fecha_hora_inicio ?? current.fecha_hora_inicio,
    ...(input.id_horario
      ? { id_horario: input.id_horario }
      : {}),
  };

  const motivo = context?.motivo ?? motivo_reprogramacion;

  // Exige un motivo para realizar la reprogramación.
  if (!motivo) {
    throw new AppError(
      'Indicá el motivo de la reprogramación',
      400
    );
  }

  // Verifica el acceso a la salita de destino.
  assertTurnoScope(
    await getTurnoScope(user),
    candidate.id_salita
  );

  // Revalida la agenda excluyendo únicamente el turno actual.
  const agenda = await validateTurnoAgenda(
    candidate,
    id
  );

  // Guarda la reprogramación con control de versión.
  const updated = requireUpdated(
    await patchTurno(
      id,
      current.version,
      {
        ...input,
        ...agenda,
      },
      {
        usuario: user.id_usuario,
        motivo,
      }
    )
  );

  const reprogramado =
    Date.parse(current.fecha_hora_inicio) !== Date.parse(updated.fecha_hora_inicio) ||
    Date.parse(current.fecha_hora_fin) !== Date.parse(updated.fecha_hora_fin);

  // Notifica después de guardar; compara instantes para evitar avisos por formato de fecha.
  if (reprogramado) {
    await notifyTurnoReprogramado(
      updated.id_turno,
      current.fecha_hora_inicio
    );
  }

  // Notifica cuando cambia el profesional asignado.
  if (current.id_profesional !== updated.id_profesional) {
    await notifyCambioProfesional(updated.id_turno);
  }

  // Emisión en tiempo real vía WebSocket
  try {
    const pacienteNombre = await getPatientName(current.id_paciente);
    const fechaAnt = agendaDateTime(current.fecha_hora_inicio);
    const fechaNueva = agendaDateTime(updated.fecha_hora_inicio);

    if (reprogramado) {
      emitirCambioAgenda({
        tipo: 'TURNO_REPROGRAMADO',
        mensaje: 'Se reprogramó un turno en tu agenda',
        id_turno: updated.id_turno,
        id_paciente: current.id_paciente,
        id_profesional: updated.id_profesional,
        id_salita: updated.id_salita,
        paciente: pacienteNombre,
        fecha_anterior: fechaAnt.date,
        horario_anterior: fechaAnt.time.slice(0, 5),
        nueva_fecha: fechaNueva.date,
        nuevo_horario: fechaNueva.time.slice(0, 5),
      });

      // Si cambió de profesional, también avisar al profesional anterior
      if (current.id_profesional !== updated.id_profesional) {
        emitirCambioAgenda({
          tipo: 'TURNO_CANCELADO',
          mensaje: 'Un turno de tu agenda fue reasignado a otro profesional',
          id_turno: updated.id_turno,
          id_paciente: current.id_paciente,
          id_profesional: current.id_profesional,
          id_salita: current.id_salita,
          paciente: pacienteNombre,
          fecha_anterior: fechaAnt.date,
          horario_anterior: fechaAnt.time.slice(0, 5),
        });
      }
    } else {
      emitirCambioAgenda({
        tipo: 'TURNO_ACTUALIZADO',
        mensaje: 'Se modificó un turno en tu agenda',
        id_turno: updated.id_turno,
        id_paciente: current.id_paciente,
        id_profesional: updated.id_profesional,
        id_salita: updated.id_salita,
        paciente: pacienteNombre,
        nueva_fecha: fechaNueva.date,
        nuevo_horario: fechaNueva.time.slice(0, 5),
      });
    }
  } catch (err) {
    console.error('Error al emitir evento de turno modificado:', err);
  }

  return updated;
};

// Modifica el estado de un turno según los permisos del usuario.
export const changeTurnoStatus = async (
  id: string,
  input: TurnoStatusInput,
  user: AuthenticatedUser
) => {
  // Restringe los estados permitidos para profesionales.
  if (
    user.rol === "PROFESIONAL" &&
    !["ATENDIDO", "NO_ASISTIO"].includes(input.estado)
  ) {
    throw new AppError(
      "Solo puede marcar ATENDIDO o NO_ASISTIO",
      403
    );
  }

  // Los pacientes únicamente pueden cancelar sus turnos.
  if (
    user.rol === "PACIENTE" &&
    input.estado !== 'CANCELADO'
  ) {
    throw new AppError(
      'Solo podés cancelar tus turnos',
      403
    );
  }

  const current = await getTurno(id, user);

  // Impide registrar atención o inasistencia antes del turno.
  if (
    ['ATENDIDO', 'NO_ASISTIO'].includes(input.estado) &&
    Date.parse(current.fecha_hora_inicio) > Date.now()
  ) {
    throw new AppError(
      'No se puede registrar atención o inasistencia antes del inicio del turno.',
      409
    );
  }

  // Impide que el paciente cancele un turno que ya comenzó.
  if (
    user.rol === 'PACIENTE' &&
    Date.parse(current.fecha_hora_inicio) <= Date.now()
  ) {
    throw new AppError(
      'El turno ya comenzó. Contactá a tu salita.',
      409
    );
  }

  assertEditable(current);

  // Obtiene el estado solicitado desde el catálogo.
  const state = await getTurnoState(input.estado);

  if (state.id_estado === current.id_estado) {
    throw new AppError(
      "El turno ya tiene ese estado",
      409
    );
  }

  // Revalida la disponibilidad cuando el nuevo estado ocupa agenda.
  if (state.ocupa_agenda) {
    const agenda = await validateTurnoAgenda(
      {
        id_paciente: current.id_paciente,
        id_profesional: current.id_profesional,
        id_especialidad: current.id_especialidad,
        id_salita: current.id_salita,
        fecha_hora_inicio: current.fecha_hora_inicio,
        ...(current.id_horario
          ? { id_horario: current.id_horario }
          : {}),
      },
      id,
      current.ocupa_agenda,
      !current.ocupa_agenda
    );

    // Verifica que la duración del turno no haya cambiado.
    if (
      Date.parse(agenda.fecha_hora_fin) !==
      Date.parse(current.fecha_hora_fin)
    ) {
      throw new AppError(
        "La duración del horario cambió; debe reprogramar el turno",
        409
      );
    }
  }

  // Actualiza el estado y registra los datos de cancelación.
  const updated = requireUpdated(
    await patchTurno(
      id,
      current.version,
      {
        id_estado: state.id_estado,
        ...(state.codigo === "CANCELADO"
          ? {
              motivo_cancelacion: input.motivo_cancelacion ?? null,
              cancelado_por: user.id_usuario,
              fecha_cancelacion: new Date().toISOString(),
            }
          : {}),
      }
    )
  );

  // Notifica la cancelación utilizando el código del catálogo.
  if (
    current.estado.codigo !== "CANCELADO" &&
    state.codigo === "CANCELADO"
  ) {
    await notifyTurnoCancelado(updated.id_turno);
  }

  // Emisión en tiempo real vía WebSocket
  try {
    const pacienteNombre = await getPatientName(current.id_paciente);
    const fechaInfo = agendaDateTime(current.fecha_hora_inicio);

    if (state.codigo === 'CANCELADO') {
      emitirCambioAgenda({
        tipo: 'TURNO_CANCELADO',
        mensaje: 'Se canceló un turno de tu agenda',
        id_turno: updated.id_turno,
        id_paciente: current.id_paciente,
        id_profesional: current.id_profesional,
        id_salita: current.id_salita,
        estado: 'CANCELADO',
        paciente: pacienteNombre,
        nueva_fecha: fechaInfo.date,
        nuevo_horario: fechaInfo.time.slice(0, 5),
        motivo: input.motivo_cancelacion ?? undefined,
      });
    } else {
      emitirCambioAgenda({
        tipo: 'TURNO_ACTUALIZADO',
        mensaje: `Un turno de tu agenda cambió a estado ${state.nombre}`,
        id_turno: updated.id_turno,
        id_paciente: current.id_paciente,
        id_profesional: current.id_profesional,
        id_salita: current.id_salita,
        estado: state.codigo,
        paciente: pacienteNombre,
        nueva_fecha: fechaInfo.date,
        nuevo_horario: fechaInfo.time.slice(0, 5),
      });
    }
  } catch (err) {
    console.error('Error al emitir evento de cambio de estado:', err);
  }

  // Oculta determinados datos cuando la respuesta es para un paciente.
  return user.rol === 'PACIENTE'
    ? {
        ...updated,
        observaciones: null,
        cancelado_por: null,
      }
    : updated;
};
