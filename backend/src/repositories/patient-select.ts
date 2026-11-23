import type { CreatePersonInput } from "../validators/person.validator.js";
import type { PatientProfileInput } from "../validators/patient.validator.js";
import { personSelect } from "./person-read.repository.js";
import { personAccountSelect, type AccountDisplay } from "./account-display.select.js";

type PersonDetails = {
  [K in keyof CreatePersonInput]-?: Exclude<CreatePersonInput[K], undefined> | null;
} & { id_persona: string; cuenta?: AccountDisplay | null };

export type PatientRow = PatientProfileInput & {
  id_paciente: string;
  id_persona: string;
  activo: boolean;
  fecha_registro: string;
  fecha_actualizacion: string;
  persona: PersonDetails;
};

export const patientSelect = `
  id_paciente, id_persona, id_barrio, id_salita_asignada,
  obra_social, numero_afiliado, contacto_emergencia_nombre,
  contacto_emergencia_telefono, activo, fecha_registro, fecha_actualizacion,
  persona:personas!inner(${personSelect})
`;

// La cuenta se incluye solo en consultas administrativas autorizadas.
export const patientAdminSelect = patientSelect.replace(personSelect, `${personSelect}, ${personAccountSelect}`);

// El estado y las fechas expuestos pertenecen al perfil de paciente.
export const flattenPatient = ({ persona, ...patient }: PatientRow) => ({
  ...persona, ...patient
});
