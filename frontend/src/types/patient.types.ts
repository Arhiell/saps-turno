// SEXO DEL PACIENTE

export type PatientSex =
  | 'FEMENINO'
  | 'MASCULINO'
  | 'X'
  | 'NO_INFORMA';

export type PatientStatusFilter =
  | 'activo'
  | 'inactivo'
  | 'todos';


// ACTUALIZACIÓN DEL PERFIL PROPIO

// Campos que el paciente puede modificar
// desde su propio perfil.
export type OwnPatientUpdate = Pick<
  UpdatePatientRequest,
  | 'nombres'
  | 'apellidos'
  | 'telefono'
  | 'direccion'
  | 'id_barrio'
  | 'obra_social'
  | 'numero_afiliado'
  | 'contacto_emergencia_nombre'
  | 'contacto_emergencia_telefono'
>;


// PACIENTE

// Representa un paciente registrado
// dentro del sistema.
export interface Patient {
  cuenta?: import('./account-display.types').AccountDisplay | null;
  id_paciente: string;
  id_persona: string;

  // Datos personales.
  dni: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string | null;
  sexo: PatientSex | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  localidad?: string;
  provincia?: string;
  codigo_postal: string | null;

  // Cobertura territorial y salita asignada.
  id_barrio: string;
  id_salita_asignada: string;

  // Información de obra social.
  obra_social: string | null;
  numero_afiliado: string | null;

  // Contacto de emergencia.
  contacto_emergencia_nombre: string | null;
  contacto_emergencia_telefono: string | null;

  // Estado y fechas del registro.
  activo: boolean;
  fecha_registro: string;
  fecha_actualizacion: string;
}


// PAGINACIÓN DE PACIENTES

// Información utilizada para paginar
// el listado de pacientes.
export interface PatientPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}


// RESPUESTA DE LISTADO DE PACIENTES

export interface PatientsResponse {
  success: boolean;
  message?: string;

  data: {
    patients: Patient[];
    pagination: PatientPagination;
  };
}


// RESPUESTA DE UN PACIENTE

export interface PatientResponse {
  success: boolean;
  message?: string;

  data: {
    patient: Patient;
  };
}


// ACTUALIZAR PACIENTE

// Campos permitidos al modificar
// un paciente existente.
export interface UpdatePatientRequest {
  // Datos personales.
  nombres?: string;
  apellidos?: string;
  fecha_nacimiento?: string | null;
  sexo?: PatientSex | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  localidad?: string;
  provincia?: string;
  codigo_postal?: string | null;

  // Cobertura y salita.
  id_barrio?: string;
  id_salita_asignada?: string;

  // Obra social.
  obra_social?: string | null;
  numero_afiliado?: string | null;

  // Contacto de emergencia.
  contacto_emergencia_nombre?: string | null;
  contacto_emergencia_telefono?: string | null;
}


// CREAR PACIENTE

// Datos necesarios para registrar
// un nuevo paciente.
export interface CreatePatientRequest {
  // Datos personales obligatorios.
  dni: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  sexo: PatientSex;

  // Datos personales opcionales.
  telefono?: string | null;
  email?: string | null;
  direccion: string;
  localidad?: string;
  provincia?: string;
  codigo_postal?: string | null;

  // Cobertura y salita asignada.
  id_barrio: string;
  id_salita_asignada: string;

  // Obra social.
  obra_social?: string | null;
  numero_afiliado?: string | null;

  // Contacto de emergencia.
  contacto_emergencia_nombre?: string | null;
  contacto_emergencia_telefono?: string | null;
}
