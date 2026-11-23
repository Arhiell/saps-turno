
import { assertNoAgendaAffected } from './agenda-impacto.service.js';
import { saveAgenda } from '../repositories/agenda-impacto.repository.js';
import { timeToSeconds } from "../utils/time.js";
import { emitirCambioAgenda } from "./socket.service.js";

import {
  getAllBloqueos,
  getBloqueoById,
} from "../repositories/bloqueo-agenda.repository.js";

import {
  createBloqueoAgendaSchema,
  updateBloqueoAgendaSchema,
  type CreateBloqueoAgendaInput,
  type UpdateBloqueoAgendaInput,
} from "../validators/bloqueo-agenda.validator.js";

type Bloqueo = NonNullable<Awaited<ReturnType<typeof getBloqueoById>>>;

// Obtiene los bloqueos de agenda según las salitas autorizadas.
export const getBloqueos = async (
  scope: string[] | null = null
) => {
  return await getAllBloqueos(scope);
};

// Obtiene un bloqueo de agenda por su identificador.
export const getBloqueo = async (id: string) => {
  return await getBloqueoById(id);
};

// Crea un nuevo bloqueo de agenda.
export const crearBloqueo = async (
  input: CreateBloqueoAgendaInput,
  usuario: string
) => {
  // Valida los datos recibidos.
  const validated = createBloqueoAgendaSchema.parse(input);

  // Prepara los datos del nuevo bloqueo.
  const data: {
    id_profesional?: string | null;
    id_salita: string;
    id_especialidad?: string | null;
    fecha: string;
    hora_inicio?: string | null;
    hora_fin?: string | null;
    dia_completo: boolean;
    motivo: string;
    activo?: boolean;
  } = {
    id_salita: validated.id_salita,
    fecha: validated.fecha,
    dia_completo: validated.dia_completo ?? false,
    motivo: validated.motivo,
  };

  // Incorpora únicamente los campos opcionales definidos.
  if (validated.id_profesional !== undefined) {
    data.id_profesional = validated.id_profesional;
  }

  if (validated.id_especialidad !== undefined) {
    data.id_especialidad = validated.id_especialidad;
  }

  if (validated.hora_inicio !== undefined) {
    data.hora_inicio = validated.hora_inicio;
  }

  if (validated.hora_fin !== undefined) {
    data.hora_fin = validated.hora_fin;
  }

  if (validated.activo !== undefined) {
    data.activo = validated.activo;
  }

  // Comprueba el impacto y guarda con el actor antes de emitir el evento.
  await assertNoAgendaAffected('bloqueo', {
    activo: true,
    ...data,
  });

  const nuevoBloqueo = await saveAgenda<Bloqueo>('bloqueo', null, data, usuario);

  if (nuevoBloqueo?.id_profesional) {
    try {
      emitirCambioAgenda({
        tipo: 'BLOQUEO_AGENDA',
        mensaje: `Se registró un bloqueo de horario en tu agenda: ${nuevoBloqueo.motivo}`,
        id_profesional: nuevoBloqueo.id_profesional,
        id_salita: nuevoBloqueo.id_salita,
        nueva_fecha: nuevoBloqueo.fecha,
        nuevo_horario: nuevoBloqueo.hora_inicio ? nuevoBloqueo.hora_inicio.slice(0, 5) : undefined,
        motivo: nuevoBloqueo.motivo,
      });
    } catch (err) {
      console.error('Error al emitir evento de bloqueo:', err);
    }
  }

  return nuevoBloqueo;
};

// Actualiza un bloqueo de agenda existente.
export const actualizarBloqueo = async (
  id: string,
  input: UpdateBloqueoAgendaInput,
  usuario: string
) => {
  // Valida los datos de actualización.
  const validated = updateBloqueoAgendaSchema.parse(input);

  const bloqueoActual = await getBloqueoById(id);

  if (!bloqueoActual) {
    return null;
  }

  // Obtiene los valores actuales o los nuevos valores enviados.
  const diaCompleto =
    validated.dia_completo ?? bloqueoActual.dia_completo;

  const horaInicio =
    validated.hora_inicio !== undefined
      ? validated.hora_inicio
      : bloqueoActual.hora_inicio;

  const horaFin =
    validated.hora_fin !== undefined
      ? validated.hora_fin
      : bloqueoActual.hora_fin;

  // Valida las horas según el tipo de bloqueo.
  if (diaCompleto) {
    if (horaInicio !== null || horaFin !== null) {
      throw new Error(
        "Un bloqueo de día completo no puede tener horario"
      );
    }
  } else {
    if (horaInicio === null || horaInicio === undefined) {
      throw new Error(
        "Debe indicar la hora de inicio para un bloqueo parcial"
      );
    }

    if (horaFin === null || horaFin === undefined) {
      throw new Error(
        "Debe indicar la hora de fin para un bloqueo parcial"
      );
    }

    if (timeToSeconds(horaInicio) >= timeToSeconds(horaFin)) {
      throw new Error(
        "La hora de inicio debe ser menor que la hora de fin"
      );
    }
  }

  // Prepara únicamente los campos que serán actualizados.
  const data: {
    id_profesional?: string | null;
    id_salita?: string;
    id_especialidad?: string | null;
    fecha?: string;
    hora_inicio?: string | null;
    hora_fin?: string | null;
    dia_completo?: boolean;
    motivo?: string;
    activo?: boolean;
  } = {};

  if (validated.id_profesional !== undefined) {
    data.id_profesional = validated.id_profesional;
  }

  if (validated.id_salita !== undefined) {
    data.id_salita = validated.id_salita;
  }

  if (validated.id_especialidad !== undefined) {
    data.id_especialidad = validated.id_especialidad;
  }

  if (validated.fecha !== undefined) {
    data.fecha = validated.fecha;
  }

  if (validated.hora_inicio !== undefined) {
    data.hora_inicio = validated.hora_inicio;
  }

  if (validated.hora_fin !== undefined) {
    data.hora_fin = validated.hora_fin;
  }

  if (validated.dia_completo !== undefined) {
    data.dia_completo = validated.dia_completo;
  }

  if (validated.motivo !== undefined) {
    data.motivo = validated.motivo;
  }

  if (validated.activo !== undefined) {
    data.activo = validated.activo;
  }

  // Verifica que los cambios no afecten turnos vigentes.
  await assertNoAgendaAffected('bloqueo', {
    ...bloqueoActual,
    ...data,
  });

  return await saveAgenda(
    'bloqueo',
    id,
    data,
    usuario
  );
};

// Desactiva un bloqueo de agenda existente.
export const eliminarBloqueo = async (
  id: string,
  usuario: string
) => {
  const bloqueo = await getBloqueoById(id);

  if (!bloqueo) {
    return null;
  }

  return await saveAgenda(
    'bloqueo',
    id,
    { activo: false },
    usuario
  );
};
