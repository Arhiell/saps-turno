
import { obtenerDisponibilidad } from './disponibilidad.service.js';
import { validateTurnoAgenda } from './turno-agenda.service.js';
import { getAgendaImpact } from './agenda-impacto.service.js';

import { agendaDateTime } from '../utils/turno-time.js';
import { AppError } from '../utils/app-error.js';
import { timeToSeconds } from '../utils/time.js';

import type { AgendaChange } from '../validators/agenda-impacto.validator.js';
import type { AuthenticatedUser } from '../types/auth.types.js';

// Verifica si el destino es compatible con el cambio de agenda.
export const destinationAllowed = (
  change: AgendaChange,
  horario: string,
  inicio: string,
  fin: string
) => {
  // Evita utilizar el horario modificado antes de aplicar su configuración.
  if (change.tipo === 'horario') {
    return horario !== change.id;
  }

  const b = change.datos;

  const start = agendaDateTime(inicio);
  const end = agendaDateTime(fin);

  // Comprueba que el destino no coincida con el bloqueo o cierre.
  return (
    b.activo === false ||
    (
      change.tipo === 'cierre'
        ? start.date < change.datos.fecha_inicio ||
          start.date > change.datos.fecha_fin
        : start.date !== change.datos.fecha
    ) ||
    (
      !b.dia_completo &&
      (
        timeToSeconds(end.time) <= timeToSeconds(b.hora_inicio!) ||
        timeToSeconds(start.time) >= timeToSeconds(b.hora_fin!)
      )
    )
  );
};

// Genera propuestas de reprogramación para los turnos afectados.
export const generateAgendaProposal = async (
  change: AgendaChange,
  dias: number,
  user: AuthenticatedUser
) => {
  // Obtiene los turnos afectados por el cambio de agenda.
  const { afectados } = await getAgendaImpact(change, user);

  // Almacena la disponibilidad consultada para evitar solicitudes repetidas.
  const availability = new Map<
    string,
    Awaited<ReturnType<typeof obtenerDisponibilidad>>
  >();

  // Registra los cambios de cupo de los horarios.
  const capacityChanges = new Map<string, number>();

  // Registra las asignaciones para evitar superposiciones.
  const assigned: {
    profesional: string;
    paciente: string;
    inicio: number;
    fin: number;
  }[] = [];

  const propuestas = [];

  // Procesa hasta 100 turnos y mantiene el resto como pendientes.
  for (const turno of afectados.slice(0, 100)) {
    let destino: {
      id_horario: string;
      fecha_hora_inicio: string;
      fecha_hora_fin: string;
    } | null = null;

    // Considera únicamente turnos futuros que no estén finalizados.
    if (
      Date.parse(turno.fecha_hora_inicio) > Date.now() &&
      !turno.estado.es_estado_final
    ) {
      const first = agendaDateTime(
        turno.fecha_hora_inicio
      ).date;

      // Busca disponibilidad dentro del período solicitado.
      search: for (let day = 0; day < dias; day++) {
        const fecha = new Date(
          Date.parse(`${first}T12:00:00Z`) + day * 86400000
        ).toISOString().slice(0, 10);

        const exclude = day === 0
          ? turno.id_turno
          : undefined;

        // Identifica la consulta de disponibilidad.
        const key = `${turno.id_profesional}/${turno.id_especialidad}/${turno.id_salita}/${fecha}/${exclude ?? ''}`;

        let available = availability.get(key);

        // Consulta la disponibilidad si todavía no está almacenada.
        if (!available) {
          try {
            available = await obtenerDisponibilidad(
              {
                fecha,
                id_profesional: turno.id_profesional,
                id_especialidad: turno.id_especialidad,
                id_salita: turno.id_salita,
              },
              exclude
            );
          } catch (error) {
            // Omite fechas con errores de validación o acceso.
            if (
              error instanceof AppError &&
              error.statusCode < 500
            ) {
              continue;
            }

            throw error;
          }

          availability.set(key, available);
        }

        // Recorre las franjas disponibles en orden cronológico.
        for (
          const slot of [...available.slots].sort(
            (a, b) =>
              a.hora_inicio.localeCompare(b.hora_inicio)
          )
        ) {
          if (slot.estado !== 'DISPONIBLE') {
            continue;
          }

          const inicio = `${fecha}T${slot.hora_inicio}:00-03:00`;
          const fin = `${fecha}T${slot.hora_fin}:00-03:00`;

          // Descarta destinos anteriores a la finalización original.
          if (
            Date.parse(inicio) < Date.parse(turno.fecha_hora_fin)
          ) {
            continue;
          }

          // Identifica el horario correspondiente a la franja.
          const horario = available.horarios_utilizados.find(
            (h) =>
              h.hora_inicio.slice(0, 5) <= slot.hora_inicio &&
              h.hora_fin.slice(0, 5) >= slot.hora_fin
          );

          // Verifica que el horario exista y permita la reprogramación.
          if (
            !horario ||
            !destinationAllowed(
              change,
              horario.id_horario,
              inicio,
              fin
            )
          ) {
            continue;
          }

          // Evita superposiciones del profesional o paciente.
          if (
            assigned.some(
              (a) =>
                (
                  a.profesional === turno.id_profesional ||
                  a.paciente === turno.id_paciente
                ) &&
                a.inicio < Date.parse(fin) &&
                a.fin > Date.parse(inicio)
            )
          ) {
            continue;
          }

          // Verifica el cupo disponible del horario.
          const capacityKey = `${horario.id_horario}/${fecha}`;
          const count = capacityChanges.get(capacityKey) ?? 0;

          if (
            horario.cupo_disponible !== null &&
            count >= horario.cupo_disponible
          ) {
            continue;
          }

          // Valida el destino antes de incorporarlo a la propuesta.
          try {
            destino = await validateTurnoAgenda(
              {
                id_paciente: turno.id_paciente,
                id_profesional: turno.id_profesional,
                id_especialidad: turno.id_especialidad,
                id_salita: turno.id_salita,
                id_horario: horario.id_horario,
                fecha_hora_inicio: inicio,
              },
              turno.id_turno
            );
          } catch (error) {
            // Descarta destinos que no superen las validaciones.
            if (
              error instanceof AppError &&
              error.statusCode < 500
            ) {
              continue;
            }

            throw error;
          }

          // Registra el cupo utilizado en el nuevo horario.
          capacityChanges.set(
            capacityKey,
            count + 1
          );

          // Libera el cupo del horario original.
          if (turno.id_horario) {
            const sourceKey = `${turno.id_horario}/${first}`;

            capacityChanges.set(
              sourceKey,
              (capacityChanges.get(sourceKey) ?? 0) - 1
            );
          }

          // Registra la asignación para evitar conflictos posteriores.
          assigned.push({
            profesional: turno.id_profesional,
            paciente: turno.id_paciente,
            inicio: Date.parse(inicio),
            fin: Date.parse(fin),
          });

          // Finaliza la búsqueda al encontrar un destino válido.
          break search;
        }
      }
    }

    // Guarda el resultado de la búsqueda para cada turno.
    propuestas.push({
      id_turno: turno.id_turno,
      version: turno.version,
      destino,
    });
  }

  // Devuelve las propuestas y la cantidad de turnos pendientes.
  return {
    propuestas,
    pendientes: afectados.length - propuestas.filter(
      (p) => p.destino
    ).length,
    dias,
  };
};
