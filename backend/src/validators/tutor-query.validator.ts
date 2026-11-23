import { z } from "zod";
import { 
  personDniSchema 
} from "./person.validator.js";

export const tutorIdSchema = z.object(
  { 
    id: z.string().uuid() 
  }
);


export const tutorDniSchema = z.object(
  { 
    dni: personDniSchema 
  }
);

export const tutorListQuerySchema = z.object(
  {
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  }
);

export type TutorListQuery = z.infer<typeof tutorListQuerySchema>;
