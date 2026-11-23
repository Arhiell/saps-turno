
import { AppError } from "./app-error.js";
import { hasDatabaseCode } from "./profile-error.js";

// Traduce los errores conocidos de los triggers de turnos.
const triggerErrors: Record<string, number> = {
  "El estado del turno no existe o esta inactivo": 400,
  "El horario seleccionado no existe o esta inactivo": 400,
  "El turno no coincide con el profesional, especialidad o salita del horario": 400,
  "El turno esta fuera de la vigencia o franja del horario": 400,
  "La duracion del turno no coincide con el horario configurado": 400,
  "La hora de inicio no coincide con un bloque valido de la agenda": 400,
  "Se alcanzo el cupo maximo diario del horario": 409,
  "El profesional no esta habilitado para esa especialidad o salita": 400,
  "La agenda esta bloqueada para la fecha y horario solicitados": 409,
  "El paciente posee una restriccion vigente para esta especialidad": 409,
};

// Convierte errores específicos de la base de datos en errores de aplicación.
export const rethrowTurnoError = (error: unknown): never => {
  // Extrae el mensaje del error cuando está disponible.
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error
      ? String(error.message)
      : "";

  if (hasDatabaseCode(error, 'P0001') && message === 'INSTITUTIONAL_CLOSURE') {
    throw new AppError('La salita está cerrada en la fecha o franja solicitada. Actualizá la disponibilidad.', 409, 'INSTITUTIONAL_CLOSURE');
  }
  // Verifica errores de permisos sobre la agenda o salita.
  if (hasDatabaseCode(error, '42501')) {
    throw new AppError(
      'No tiene permisos sobre esta agenda o salita',
      403
    );
  }

  // Detecta conflictos al modificar la agenda.
  if (
    hasDatabaseCode(error, 'P0001') &&
    message === 'AGENDA_CONFLICT'
  ) {
    throw new AppError(
      'La agenda cambi? o todav?a existen turnos afectados. Revis? la propuesta antes de guardar.',
      409,
      'AGENDA_CONFLICT'
    );
  }

  // Detecta restricciones por sanciones vigentes del paciente.
  if (
    hasDatabaseCode(error, 'P0001') &&
    message === 'PATIENT_SANCTIONED'
  ) {
    throw new AppError(
      'Tenés una sanción vigente que impide reservar en todas las especialidades. Consultá en tu salita para conocer el vencimiento.',
      409,
      'PATIENT_SANCTIONED'
    );
  }

  // Traduce los errores de validación definidos en los triggers.
  if (
    hasDatabaseCode(error, "P0001") &&
    triggerErrors[message]
  ) {
    throw new AppError(
      message,
      triggerErrors[message]
    );
  }

  // Detecta superposiciones de turnos del paciente o profesional.
  if (hasDatabaseCode(error, "23P01")) {
    throw new AppError(
      message.includes("paciente")
        ? "El paciente ya posee un turno en ese horario"
        : "El profesional ya posee un turno asignado en ese horario",
      409
    );
  }

  // Detecta registros duplicados o turnos abiertos existentes.
  if (hasDatabaseCode(error, "23505")) {
    throw new AppError(
      "Ya existe un turno abierto para el paciente y la especialidad o un código duplicado",
      409
    );
  }

  // Delega los errores de FK, CHECK y fallos inesperados al middleware.
  throw error;
};
