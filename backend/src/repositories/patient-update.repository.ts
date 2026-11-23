import { supabase } from "../config/supabase.js";
import type { UpdatePatientProfileInput } from "../validators/patient.validator.js";
import { patientSelect, flattenPatient, type PatientRow } from "./patient-select.js";

export const updatePatient = async (idPatient: string, input: UpdatePatientProfileInput) => {
  const { data, error } = await supabase.from("pacientes").update(input)
    .eq("id_paciente", idPatient).select(patientSelect).returns<PatientRow[]>().single();
  if (error) throw error;
  return flattenPatient(data);
};

export const updatePatientStatus = async (idPatient: string, active: boolean) => {
  const { data, error } = await supabase.from("pacientes").update({ activo: active })
    .eq("id_paciente", idPatient).select(patientSelect).returns<PatientRow[]>().single();
  if (error) throw error;
  return flattenPatient(data);
};