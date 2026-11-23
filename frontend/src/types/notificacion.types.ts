// Representa una notificación visible para el usuario.
export interface Notificacion {
  // Identificador único de la notificación.
  id_notificacion: string;

  // Turno relacionado, si corresponde.
  id_turno: string | null;

  // Tipo de evento que generó la notificación.
  tipo: string;

  // Título mostrado al usuario.
  titulo: string;

  // Contenido principal de la notificación.
  mensaje: string;

  // Remitente de la notificación, si está disponible.
  remitente?: string | null;

  // Fecha y hora de creación.
  fecha_creacion: string;

  // Fecha y hora efectiva de envío.
  fecha_envio?: string | null;

  // Indica si el usuario ya leyó la notificación.
  leida: boolean;
}

// Respuesta paginada de las notificaciones del usuario.
export interface NotificacionesResponse {
  notificaciones: Notificacion[];
  total: number;
  totalPages: number;
  page: number;
}

// Define los filtros utilizados para seleccionar destinatarios.
export interface Audiencia {
  tipo:
    | 'USUARIOS'
    | 'PACIENTES'
    | 'PROFESIONALES'
    | 'ADMINISTRADORES'
    | 'ROL';

  id_salita?: string;
  id_especialidad?: string;
  id_usuario?: string;
  rol?: string;
}

// Representa un posible destinatario de una notificación.
export interface Destinatario {
  id_usuario: string;
  nombre: string;
  email: string;
  rol: string;
}

// Resultado de la vista previa de destinatarios.
export interface PreviewEnvio {
  cantidad: number;
  confirmacion: string;
  usuarios: Destinatario[];
}

// Opciones disponibles para configurar la audiencia.
export interface OpcionesEnvio {
  salitas: {
    id_salita: string;
    nombre: string;
  }[];

  especialidades: {
    id_especialidad: string;
    nombre: string;
  }[];
}

// Datos necesarios para crear o programar un envío.
export interface NuevoEnvio {
  audiencia: Audiencia;
  titulo: string;
  mensaje: string;
  email: boolean;
  fecha_programada: string | null;
  confirmacion: string;
  clave: string;
}

// Representa un envío administrativo registrado en el sistema.
export interface EnvioAdministrativo {
  id_envio: string;

  audiencia: Audiencia;

  remitente: string;
  rol_remitente: string;
  destinatarios: string;

  titulo: string;
  mensaje: string;

  cantidad: number;
  email: boolean;

  fecha_creacion: string;
  fecha_programada: string | null;
  fecha_envio: string | null;

  estado:
    | 'PENDIENTE'
    | 'ENVIADA'
    | 'FALLIDA'
    | 'CANCELADA';

  // Cantidades registradas según el resultado de las entregas.
  sistema_enviadas: number;
  email_enviados: number;
  pendientes: number;
  fallidas: number;
  canceladas: number;

  // Resumen de los motivos de las entregas fallidas o canceladas.
  fallas?: {
    motivo: string;
    cantidad: number;
  }[];
}

// Conserva los datos originales necesarios al editar una programación.
export type ProgramacionOriginal =
  Pick<
    EnvioAdministrativo,
    | 'audiencia'
    | 'titulo'
    | 'mensaje'
    | 'email'
    | 'fecha_programada'
  >;

// Respuesta paginada del historial de envíos administrativos.
export interface HistorialEnvios {
  envios: EnvioAdministrativo[];
  total: number;
  totalPages: number;
  page: number;
}