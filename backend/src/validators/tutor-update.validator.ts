import { z } from "zod";
import { 
  createTutorSchema 
} from "./tutor.validator.js";

export const updateTutorSchema = createTutorSchema.partial().refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { message: "Debe enviar al menos un campo para actualizar" }
);

export const tutorStatusSchema = z.object(
  { 
    activo: z.boolean() }
  ).strict();
  
export type UpdateTutorInput = z.infer<typeof updateTutorSchema>;
