import {
  findActivePatientTutorRelation,
  findCurrentPrincipalTutor,
  findTutorsByPatientId,
  findPatientTutorHistory,
  findPatientsByTutorId,
  updatePatientTutorRelation,
  endPatientTutorRelation
} from "../repositories/patient-tutor.repository.js";

import {
  getPatientById
} from "./patient-read.service.js";

import {
  getTutorById
} from "./tutor-read.service.js";

import type { UpdatePatientTutorInput } from "../validators/patient-tutor.validator.js";

import {
  AppError
} from "../utils/app-error.js";

import { agendaDateTime } from '../utils/turno-time.js';
import { supabase } from '../config/supabase.js';
import { emitirCambioPaciente } from './socket.service.js';


/**
 * Lista las vinculaciones actuales e históricas de un paciente.
 */
export const getPatientTutors = async (
  patientId: string
) => {
  await getPatientById(patientId);

  const relations = await findTutorsByPatientId(patientId);
  const users = [...new Set(relations.flatMap(relation => [
    relation.id_usuario_creo,
    relation.id_usuario_modifico,
  ]).filter((id): id is string => typeof id === 'string'))];
  const { data: accounts, error } = users.length
    ? await supabase.from('usuarios')
      .select('id_usuario,nombre_usuario,persona:personas(nombres,apellidos)')
      .in('id_usuario', users)
    : { data: [], error: null };
  if (error) throw error;
  const accountById = new Map((accounts ?? []).map(account => [
    account.id_usuario,
    account,
  ]));
  const historyRows = await findPatientTutorHistory(
    patientId,
    relations.map(relation => relation.id_tutor),
  );
  const historyByTutor = new Map<string, typeof historyRows>();
  for (const history of historyRows) {
    const current = historyByTutor.get(history.id_tutor) ?? [];
    current.push(history);
    historyByTutor.set(history.id_tutor, current);
  }
  return Promise.all(relations.map(async relation => {
    const tutor = await getTutorById(relation.id_tutor);
    return {
      ...relation,
      nombres: tutor.nombres,
      apellidos: tutor.apellidos,
      dni: tutor.dni,
      creado_por: relation.id_usuario_creo ? accountById.get(relation.id_usuario_creo) ?? null : null,
      modificado_por: relation.id_usuario_modifico ? accountById.get(relation.id_usuario_modifico) ?? null : null,
      historial: historyByTutor.get(relation.id_tutor) ?? [],
    };
  }));
};


/**
 * Lista los pacientes vigentes asociados a un tutor.
 */
export const getTutorPatients = async (
  tutorId: string
) => {
  await getTutorById(tutorId);

  return await findPatientsByTutorId(tutorId);
};


/**
 * Modifica datos de una relación vigente.
 */
export const editPatientTutorRelation = async (
  patientId: string,
  tutorId: string,
  input: UpdatePatientTutorInput,
  userId: string,
) => {
  const patient = await getPatientById(patientId);
  await getTutorById(tutorId);

  const current =
    await findActivePatientTutorRelation(
      patientId,
      tutorId
    );

  if (!current) {
    throw new AppError(
      "La relación paciente-tutor no existe o ya fue finalizada",
      404
    );
  }
  if (
    input.es_principal === true &&
    current.es_principal !== true
  ) {
    const principal =
      await findCurrentPrincipalTutor(patientId);

    if (
      principal &&
      principal.id_tutor !== tutorId
    ) {
      throw new AppError(
        "El paciente ya posee un tutor principal vigente",
        409
      );
    }
  }

  const updated =
    await updatePatientTutorRelation(
      patientId,
      tutorId,
      input,
      userId,
    );

  if (!updated) {
    throw new AppError(
      "La relación paciente-tutor cambió; vuelva a consultar",
      409
    );
  }

  emitirCambioPaciente({
    tipo: 'TUTOR_VINCULACION_ACTUALIZADA',
    mensaje: `Se actualizó la relación de tutoría para ${patient.nombres} ${patient.apellidos}.`,
    id_paciente: patientId,
    id_salita: patient.id_salita_asignada ?? undefined,
    nombre_paciente: `${patient.nombres} ${patient.apellidos}`,
    dni_paciente: patient.dni ?? undefined,
  });

  return updated;
};


/**
 * Finaliza una relación vigente.
 */
export const finishPatientTutorRelation = async (
  patientId: string,
  tutorId: string,
  userId: string,
) => {
  const patient = await getPatientById(patientId);
  await getTutorById(tutorId);

  const relation =
    await findActivePatientTutorRelation(
      patientId,
      tutorId
    );

  if (!relation) {
    throw new AppError(
      "La relación paciente-tutor no existe o ya fue finalizada",
      404
    );
  }
  if (!relation.puede_gestionar_turnos) {
    throw new AppError('La autorización ya fue revocada.', 409);
  }

  const today = agendaDateTime(new Date()).date;

  const updated =
    await endPatientTutorRelation(
    patientId,
    tutorId,
    relation.fecha_desde > today ? relation.fecha_desde : today,
    userId,
  );

  if (!updated) {
    throw new AppError(
      "La relación paciente-tutor cambió; vuelva a consultar",
      409
    );
  }

  emitirCambioPaciente({
    tipo: 'TUTOR_VINCULACION_ACTUALIZADA',
    mensaje: `Se actualizó la relación de tutoría para ${patient.nombres} ${patient.apellidos}.`,
    id_paciente: patientId,
    id_salita: patient.id_salita_asignada ?? undefined,
    nombre_paciente: `${patient.nombres} ${patient.apellidos}`,
    dni_paciente: patient.dni ?? undefined,
  });

  return updated;
};
