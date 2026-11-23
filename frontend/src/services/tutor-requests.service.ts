import api from './api';

export type TutorRequestDirection = 'GESTIONAR_A_OTRO' | 'DELEGAR_MI_GESTION';
export type TutorRequestStatus = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

export interface TutorRequest {
  id_solicitud: string;
  direccion: TutorRequestDirection;
  dni_persona_destino: string;
  parentesco: string;
  estado: TutorRequestStatus;
  motivo_rechazo: string | null;
  fecha_creacion: string;
  fecha_resolucion: string | null;
  id_usuario_resolvio?: string | null;
  solicitante?: {
    id_paciente: string;
    id_salita_asignada: string;
    persona: {
      dni: string;
      nombres: string;
      apellidos: string;
      fecha_nacimiento: string | null;
    } | null;
  } | null;
  resolutor?: { nombre_usuario: string; persona: { nombres: string; apellidos: string } | null } | null;
  paciente_asociado?: {
    id_paciente: string;
    id_salita_asignada: string;
    nombres: string;
    apellidos: string;
    dni: string;
    fecha_nacimiento: string | null;
  } | null;
}

export interface PatientTutor {
  id_tutor: string;
  nombres: string;
  apellidos: string;
  dni: string;
  parentesco: string;
  puede_gestionar_turnos: boolean;
  fecha_desde: string;
  fecha_hasta: string | null;
  fecha_modificacion: string | null;
  modificado_por: { nombre_usuario: string } | null;
  historial: {
    id_historial: number;
    accion: 'INSERT' | 'UPDATE' | 'DELETE';
    fecha: string;
    actor: { nombre_usuario: string; persona: { nombres: string; apellidos: string } | null } | null;
  }[];
}

export const getOwnPatientTutors = async () =>
  (await api.get<{ data: { tutors: PatientTutor[] } }>('/patients/mis-responsables')).data.data.tutors;

export const getOwnTutorRequests = async () =>
  (await api.get<{ data: { requests: TutorRequest[] } }>('/patients/solicitudes-vinculacion')).data.data.requests;

export const createTutorRequest = async (data: {
  direccion: TutorRequestDirection;
  dni_persona_destino: string;
  parentesco: string;
}) =>
  (await api.post<{ data: { request: TutorRequest } }>('/patients/solicitudes-vinculacion', data)).data.data.request;

export const getAdminTutorRequests = async () =>
  (await api.get<{ data: { requests: TutorRequest[] } }>('/tutor-requests')).data.data.requests;

export const resolveTutorRequest = async (
  id: string,
  data: {
    accion: 'APROBAR';
    identidad_verificada: true;
    documentacion_verificada: true;
    autorizacion_verificada: true;
  } | { accion: 'RECHAZAR'; motivo_rechazo: string },
) =>
  api.patch(`/tutor-requests/${id}`, data);
