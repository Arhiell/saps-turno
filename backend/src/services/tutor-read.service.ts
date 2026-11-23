import { 
  findTutors, 
  findTutorById, 
  findTutorByDni 
} from "../repositories/tutor-read.repository.js";

import type { 
  TutorListQuery 
} from "../validators/tutor-query.validator.js";

import { 
  AppError 
} from "../utils/app-error.js";

export const getTutors = async ({ page, limit }: TutorListQuery) => {
  const from = (page - 1) * limit;
  const result = await findTutors(from, from + limit - 1);
  return { tutors: result.tutors,
    pagination: { 
      page, 
      limit,
      total: result.total, totalPages: Math.ceil(result.total / limit) 
    } 
  };
};

export const getTutorById = async (id: string) => {
  const tutor = await findTutorById(id);
  if (!tutor) throw new AppError("Tutor no encontrado", 404);
  return tutor;
};
export const getTutorByDni = async (dni: string) => {
  const tutor = await findTutorByDni(dni);
  if (!tutor) throw new AppError("Tutor no encontrado", 404);
  return tutor;
};
