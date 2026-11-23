import { personSelect } from "./person-read.repository.js";
import type { CreatePersonInput } from "../validators/person.validator.js";

export type TutorRow = {
  id_tutor: string;
  id_persona: string;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
  persona: { [K in keyof CreatePersonInput]-?: Exclude<CreatePersonInput[K], undefined> | null };
};
export const tutorSelect = `id_tutor, id_persona, activo, fecha_creacion,
  fecha_actualizacion, persona:personas!inner(${personSelect})`;

// El estado y las fechas expuestos pertenecen al perfil de tutor.
export const flattenTutor = ({ persona, ...tutor }: TutorRow) => ({ ...persona, ...tutor });
