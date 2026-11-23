
import { getAgendaImpact } from './agenda-impacto.service.js';
import { destinationAllowed } from './agenda-propuesta.service.js';
import { updateTurno } from './turno-update.service.js';
import { getHorarioById } from '../repositories/horario-atencion.repository.js';
import { AppError } from '../utils/app-error.js';
import type { AgendaConfirmation } from '../validators/agenda-impacto.validator.js';
import type { AuthenticatedUser } from '../types/auth.types.js';

// Confirma la reprogramación de los turnos afectados por un cambio de agenda.
export const confirmAgendaProposal = async (
  input: AgendaConfirmation,
  user: AuthenticatedUser
) => {
  // Obtiene los turnos afectados y los organiza por identificador.
  const { afectados } = await getAgendaImpact(input.cambio, user);

  const byId = new Map(
    afectados.map((t) => [t.id_turno, t])
  );

  const resultados: {
    id_turno: string;
    confirmado: boolean;
    mensaje: string;
  }[] = [];

  // Procesa individualmente cada turno de la propuesta.
  for (const item of input.turnos) {
    try {
      const original = byId.get(item.id_turno);

      // Verifica que el turno siga vigente y conserve su versión.
      if (
        !original ||
        original.version !== item.version ||
        Date.parse(original.fecha_hora_inicio) <= Date.now()
      ) {
        throw new AppError(
          'El turno cambió, ya comenzó o dejó de estar afectado. Generá otra propuesta.',
          409
        );
      }

      // Obtiene el horario de destino.
      const horario = await getHorarioById(item.id_horario);

      if (!horario) {
        throw new AppError('Horario no encontrado', 409);
      }

      // Calcula la finalización del turno según su duración.
      const fin = new Date(
        Date.parse(item.fecha_hora_inicio) +
          horario.duracion_turno_minutos * 60000
      ).toISOString();

      // Valida que el destino resuelva el cambio de agenda.
      if (
        Date.parse(item.fecha_hora_inicio) <
          Date.parse(original.fecha_hora_fin) ||
        !destinationAllowed(
          input.cambio,
          item.id_horario,
          item.fecha_hora_inicio,
          fin
        )
      ) {
        throw new AppError(
          'El destino no resuelve el cambio de agenda solicitado',
          409
        );
      }

      // Actualiza el turno con la nueva fecha y horario.
      await updateTurno(
        item.id_turno,
        {
          id_horario: item.id_horario,
          fecha_hora_inicio: item.fecha_hora_inicio,
        },
        user,
        {
          version: item.version,
          motivo: input.motivo,
        }
      );

      resultados.push({
        id_turno: item.id_turno,
        confirmado: true,
        mensaje: 'Reprogramado',
      });
    } catch (error) {
      // Cada turno es una transacción independiente, sin rollback del lote.
      resultados.push({
        id_turno: item.id_turno,
        confirmado: false,
        mensaje:
          error instanceof AppError
            ? error.message
            : 'No se pudo confirmar. Consultá el turno antes de reintentar.',
      });
    }
  }

  return { resultados };
};
