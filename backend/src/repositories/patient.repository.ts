import { supabase } from "../config/supabase.js";
import type { PatientProfileInput } from "../validators/patient.validator.js";
import { patientSelect, flattenPatient, type PatientRow } from "./patient-select.js";

export const createPatient = async (input: PatientProfileInput & { id_persona: string }) => {
  const { data, error } = await supabase.from("pacientes").insert(input)
    .select(patientSelect).returns<PatientRow[]>().single();
  if (error) throw error;
  return flattenPatient(data);
};