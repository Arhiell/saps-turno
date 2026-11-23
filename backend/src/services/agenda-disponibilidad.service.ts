import { getAgendaImpact } from './agenda-impacto.service.js';
import { obtenerDisponibilidad } from './disponibilidad.service.js';
import { destinationAllowed } from './agenda-propuesta.service.js';
import { validateTurnoAgenda } from './turno-agenda.service.js';
import { AppError } from '../utils/app-error.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import type { AgendaChange } from '../validators/agenda-impacto.validator.js';

// Usa la disponibilidad existente y considera el cambio todavía no guardado.
export const getAgendaAvailability = async (
  cambio: AgendaChange, id: string, fecha: string, user: AuthenticatedUser,
) => {
  const { afectados } = await getAgendaImpact(cambio, user);
  const turno = afectados.find(t => t.id_turno === id);
  if (!turno || turno.estado.es_estado_final || Date.parse(turno.fecha_hora_inicio) <= Date.now()) {
    throw new AppError('El turno cambió o ya comenzó. Actualizá los afectados.', 409);
  }
  const disponible = await obtenerDisponibilidad({
    fecha, id_profesional: turno.id_profesional,
    id_especialidad: turno.id_especialidad, id_salita: turno.id_salita,
  }, id);
  const opciones: { id_horario: string; fecha_hora_inicio: string; fecha_hora_fin: string }[] = [];
  for (const slot of disponible.slots) {
    if (slot.estado !== 'DISPONIBLE') continue;
    const inicio = `${fecha}T${slot.hora_inicio}:00-03:00`;
    const fin = `${fecha}T${slot.hora_fin}:00-03:00`;
    const horario = disponible.horarios_utilizados.find(h =>
      h.hora_inicio.slice(0, 5) <= slot.hora_inicio && h.hora_fin.slice(0, 5) >= slot.hora_fin);
    if (!horario || Date.parse(inicio) < Date.parse(turno.fecha_hora_fin) ||
      !destinationAllowed(cambio, horario.id_horario, inicio, fin)) continue;
    try {
      opciones.push(await validateTurnoAgenda({
        id_paciente: turno.id_paciente, id_profesional: turno.id_profesional,
        id_especialidad: turno.id_especialidad, id_salita: turno.id_salita,
        id_horario: horario.id_horario, fecha_hora_inicio: inicio,
      }, id));
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) throw error;
    }
  }
  return { opciones, version: turno.version };
};
