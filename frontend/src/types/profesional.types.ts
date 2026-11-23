// SEXO DEL PROFESIONAL

export type ProfessionalSex =
  | 'FEMENINO'
  | 'MASCULINO'
  | 'X'
  | 'NO_INFORMA';


// DATOS PERSONALES DEL PROFESIONAL

// Información personal asociada
// al registro del profesional.
export interface ProfessionalPerson {
  cuenta?: import('./account-display.types').AccountDisplay | null;
  id_persona: string;
  dni: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string | null;
  sexo: ProfessionalSex | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  localidad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  activo: boolean;
}


// PROFESIONAL

// Representa un profesional registrado
// junto con sus datos personales.
export interface Professional {
  id_profesional: string;
  id_persona: string;
  matricula: string;
  activo: boolean;
  fecha_alta: string;
  fecha_baja: string | null;
  fecha_actualizacion: string;
  persona: ProfessionalPerson;
  salitas?: {
    id_salita: string;
    activo: boolean;
    fecha_desde: string;
    fecha_hasta: string | null;
    salita: { id_salita: string; nombre: string; activo: boolean } | null;
  }[];
}


// RESPUESTAS DE PROFESIONALES

// Respuesta para un único profesional.
export interface ProfessionalResponse {
  success: boolean;
  message?: string;
  data: Professional;
}

// Respuesta para un listado de profesionales.
export interface ProfessionalsResponse {
  success: boolean;
  message?: string;
  data: Professional[];
}


// CREAR PROFESIONAL

// Datos enviados para registrar
// un nuevo profesional.
export interface CreateProfessionalRequest {
  dni: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento?: string | null;
  sexo?: ProfessionalSex | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  localidad?: string;
  provincia?: string;
  codigo_postal?: string | null;
  matricula: string;
}


// ACTUALIZAR PROFESIONAL

// Campos permitidos al modificar
// un profesional existente.
export interface UpdateProfessionalRequest {
  dni?: string;
  nombres?: string;
  apellidos?: string;
  fecha_nacimiento?: string | null;
  sexo?: ProfessionalSex | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  localidad?: string;
  provincia?: string;
  codigo_postal?: string | null;
  matricula?: string;
  activo?: boolean;
  fecha_alta?: string;
  fecha_baja?: string | null;
}


// ESPECIALIDADES DEL PROFESIONAL

// Relación entre un profesional
// y una especialidad.
export interface ProfessionalSpecialty {
  id_profesional: string;
  id_especialidad: string;
  fecha_desde: string;
  fecha_hasta: string | null;
  activo: boolean;

  especialidad: {
    id_especialidad: string;
    nombre: string;
    descripcion: string | null;
    activo: boolean;
  };
}

// Respuesta con las especialidades
// asignadas a un profesional.
export interface ProfessionalSpecialtiesResponse {
  success: boolean;
  message?: string;
  data: ProfessionalSpecialty[];
}

// Datos para asignar una especialidad.
export interface CreateProfessionalSpecialtyRequest {
  id_especialidad: string;
  fecha_desde?: string;
  fecha_hasta?: string | null;
}

// Datos para modificar una asignación existente.
export interface UpdateProfessionalSpecialtyRequest {
  fecha_desde?: string;
  fecha_hasta?: string | null;
  activo?: boolean;
}


// SALITAS DEL PROFESIONAL

// Relación entre un profesional
// y una salita.
export interface ProfessionalClinic {
  id_profesional: string;
  id_salita: string;
  fecha_desde: string;
  fecha_hasta: string | null;
  activo: boolean;

  salita: {
    id_salita: string;
    codigo: string;
    nombre: string;
    direccion: string;
    id_barrio: string;
    telefono: string | null;
    email: string | null;
    latitud: number | null;
    longitud: number | null;
    horario_apertura: string | null;
    horario_cierre: string | null;
    activo: boolean;
  };
}

// Respuesta con las salitas
// asignadas a un profesional.
export interface ProfessionalClinicsResponse {
  success: boolean;
  message?: string;
  data: ProfessionalClinic[];
}

// Datos para asignar una salita.
export interface CreateProfessionalClinicRequest {
  id_salita: string;
  fecha_desde?: string;
  fecha_hasta?: string | null;
}

// Datos para modificar una asignación
// de salita existente.
export interface UpdateProfessionalClinicRequest {
  fecha_desde?: string;
  fecha_hasta?: string | null;
  activo?: boolean;
}


// CATÁLOGO DE ESPECIALIDADES

// Representa una especialidad disponible
// dentro del sistema.
export interface Specialty {
  id_especialidad: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  requiere_profesional: boolean;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

// Respuesta con el catálogo
// de especialidades.
export interface SpecialtiesResponse {
  success: boolean;
  message?: string;
  data: Specialty[];
}


// PROFESIONAL VISIBLE PARA PACIENTES

// Datos públicos del equipo habilitado
// para solicitar un turno.
export interface PatientProfessional {
  id_profesional: string;
  matricula: string;

  persona: {
    nombres: string;
    apellidos: string;
  };

  especialidades: {
    id_especialidad: string;
    nombre: string;
  }[];
}
