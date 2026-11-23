import { createPersonSchema } from "../validators/person.validator.js";
import { updatePatientProfileSchema } from "../validators/patient.validator.js";
import type { UpdatePatientInput } from "../validators/patient-update.validator.js";

// Las listas de campos provienen de los schemas, sin mantener una segunda copia.
export const splitPatientInput = (input: UpdatePatientInput) => ({
  person: createPersonSchema.partial().strip().parse(input),
  patient: updatePatientProfileSchema.strip().parse(input)
});