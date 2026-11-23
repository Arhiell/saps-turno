import { z } from "zod";

export const updatePatientTutorSchema = z.object({
  parentesco: z.string().trim().min(1).max(50).optional(),
  es_principal: z.boolean().optional(),
})
.strict()
.refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  {
    message: "Debe enviar al menos un campo para actualizar"
  }
);

export const patientTutorParamsSchema = z.object({
  patientId: z.string().uuid(),
  tutorId: z.string().uuid()
}).strict();

export const patientIdParamSchema = z.object({
  patientId: z.string().uuid()
}).strict();

export const tutorIdParamSchema = z.object({
  tutorId: z.string().uuid()
}).strict();

export type UpdatePatientTutorInput =
  z.infer<typeof updatePatientTutorSchema>;