import type { 
  CreateTutorInput 
} from "../validators/tutor.validator.js";

import { 
  createTutor, 
  findTutorByPersonId 
} from "../repositories/tutor.repository.js";

import { 
  findOrCreatePerson 
} from "./person.service.js";

import { 
  AppError 
} from "../utils/app-error.js";
import { 
  hasDatabaseCode 
} from "../utils/profile-error.js";

import { 
  findTutorPersonState 
} from "../repositories/tutor-read.repository.js";

import {
  rethrowTutorError
} from "../utils/tutor-error.js";
import { findPersonByDni } from '../repositories/person-read.repository.js';

export const validateTutorPerson = async (idPerson: string) => {
  const person = await findTutorPersonState(idPerson);

  if (!person?.activo || !person.telefono?.trim()) {
    throw new AppError("La persona del tutor debe estar activa y tener telefono", 400);
  }
};

export const registerTutor = async (input: CreateTutorInput) => {
  const person = await findOrCreatePerson(input);
  
  const duplicate = () => new AppError("Ya existe un tutor registrado para esta persona", 409);

  if (await findTutorByPersonId(person.id_persona)) throw duplicate();
  await validateTutorPerson(person.id_persona);
  try {
    const tutor = await createTutor(person.id_persona);
    return { ...person, ...tutor };
  } catch (error) {
    if (hasDatabaseCode(error, "23505") &&
        await findTutorByPersonId(person.id_persona)) throw duplicate();
    rethrowTutorError(error);
  }
};

// Reutiliza la identidad de una persona ya registrada; no crea cuentas duplicadas.
export const registerExistingTutor = async (dni: string) => {
  const person = await findPersonByDni(dni);
  if (!person) throw new AppError('El responsable debe tener su ficha de persona registrada. Registralo primero en Pacientes.', 404);
  await validateTutorPerson(person.id_persona);
  let tutor = await findTutorByPersonId(person.id_persona);
  if (!tutor) {
    try { tutor = await createTutor(person.id_persona); }
    catch (error) {
      if (!hasDatabaseCode(error, '23505')) throw error;
      tutor = await findTutorByPersonId(person.id_persona);
      if (!tutor) throw error;
    }
  }
  if (!tutor.activo) throw new AppError('El tutor está inactivo. Reactivalo antes de asociarlo.', 409);
  return tutor;
};
