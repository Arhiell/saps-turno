import { 
  getTutorById 
} from "./tutor-read.service.js";

import { 
  editPerson 
} from "./person.service.js";

import { 
  validateTutorPerson 
} from "./tutor.service.js";

import { 
  updateTutorStatus 
} from "../repositories/tutor-update.repository.js";
import type { 
  UpdateTutorInput 
} from "../validators/tutor-update.validator.js";
import { 
  AppError 
} from "../utils/app-error.js";

import { 
  rethrowTutorError 
} from "../utils/tutor-error.js";

export const editTutor = async (id: string, input: UpdateTutorInput) => {
  const tutor = await getTutorById(id);
  try {
    await editPerson(tutor.id_persona, input);
    return await getTutorById(id);
  } catch (error) {
    rethrowTutorError(error);
  }
};
export const changeTutorStatus = async (id: string, active: boolean) => {
  const tutor = await getTutorById(id);
  if (tutor.activo === active) 
    throw new AppError("El tutor ya tiene ese estado", 409);
  
  if (active) await validateTutorPerson(tutor.id_persona);
  try {
    const updated = await updateTutorStatus(id, active);
    if (!updated) throw new AppError("El estado del tutor cambio; vuelva a consultar", 409);
    return updated;
  } catch (error) {
    rethrowTutorError(error);
  }
};
