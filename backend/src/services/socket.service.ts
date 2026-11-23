import { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { randomUUID } from 'node:crypto';
import { verifyAccessToken } from './jwt.service.js';
import { findUserById, findRoleById } from '../repositories/user.repository.js';
import { getOwnEntity } from './auth-profile.service.js';
import { supabase } from '../config/supabase.js';
import {
  findTurnoSalitasForUser,
  findTurnoSalitasForProfesional,
} from '../repositories/turno-access.repository.js';
import type { AuthenticatedUser } from '../types/auth.types.js';

export interface EventoAgenda {
  id: string;
  tipo:
    | 'TURNO_CREADO'
    | 'TURNO_CONFIRMADO'
    | 'TURNO_REPROGRAMADO'
    | 'TURNO_CANCELADO'
    | 'TURNO_ACTUALIZADO'
    | 'BLOQUEO_AGENDA'
    | 'HORARIO_ATENCION_ACTUALIZADO';
  mensaje: string;
  id_turno?: string | undefined;
  id_paciente?: string | undefined;
  id_horario?: string | undefined;
  dia_semana?: number | undefined;
  id_profesional?: string | undefined;
  id_salita?: string | undefined;
  estado?: string | undefined;
  paciente?: string | undefined;
  fecha_anterior?: string | undefined;
  horario_anterior?: string | undefined;
  nueva_fecha?: string | undefined;
  nuevo_horario?: string | undefined;
  motivo?: string | undefined;
  timestamp: string;
}

export interface EventoPaciente {
  id: string;
  tipo:
    | 'PACIENTE_CREADO'
    | 'PACIENTE_ACTUALIZADO'
    | 'PACIENTE_ESTADO_CAMBIADO'
    | 'TUTOR_VINCULACION_ACTUALIZADA';
  mensaje: string;
  id_paciente: string;
  id_salita?: string | undefined;
  activo?: boolean | undefined;
  nombre_paciente?: string | undefined;
  dni_paciente?: string | undefined;
  timestamp: string;
}

export interface EventoProfesional {
  id: string;
  tipo:
    | 'PROFESIONAL_CREADO'
    | 'PROFESIONAL_ACTUALIZADO'
    | 'HORARIO_ATENCION_ACTUALIZADO'
    | 'BLOQUEO_AGENDA';
  mensaje: string;
  id_profesional: string;
  id_salita?: string | undefined;
  matricula?: string | undefined;
  activo?: boolean | undefined;
  timestamp: string;
}

export interface EventoSalita {
  id: string;
  tipo:
    | 'SALITA_CREADA'
    | 'SALITA_ACTUALIZADA'
    | 'SALITA_ESTADO_CAMBIADO'
    | 'SALITA_ELIMINADA'
    | 'SALITA_CONFIGURACION_ACTUALIZADA'
    | 'HORARIO_SALITA_ACTUALIZADO'
    | 'DISPONIBILIDAD_ACTUALIZADA'
    | 'BLOQUEO_SALITA';
  mensaje: string;
  id_salita: string;
  activo?: boolean | undefined;
  timestamp: string;
}

export interface EventoTerritorial {
  id: string;
  tipo:
    | 'ZONA_CREADA'
    | 'ZONA_ACTUALIZADA'
    | 'ZONA_ELIMINADA'
    | 'BARRIO_CREADO'
    | 'BARRIO_ACTUALIZADO'
    | 'BARRIO_ELIMINADO'
    | 'COBERTURA_ACTUALIZADA';
  mensaje: string;
  id_zona?: string | undefined;
  id_barrio?: string | undefined;
  id_salita?: string | undefined;
  timestamp: string;
}

export interface EventoClinico {
  id: string;
  tipo:
    | 'CONSULTA_FIRMADA'
    | 'EVOLUCION_REGISTRADA'
    | 'ESTUDIO_INFORMADO'
    | 'DERIVACION_ACTUALIZADA';
  mensaje: string;
  id_paciente: string;
  id_salita: string;
  id_profesional?: string | undefined;
  id_consulta?: string | undefined;
  id_derivacion?: string | undefined;
  timestamp: string;
}

let io: SocketIOServer | null = null;

export const getSocketIO = () => io;

export const closeSocketServer = async () => {
  if (io) {
    await io.close();
    io = null;
  }
};

export const initSocketServer = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: true,
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Middleware de autenticación con JWT
  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization;
      const token =
        socket.handshake.auth?.token ||
        (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

      if (!token) {
        return next(new Error('Token de autenticación requerido'));
      }

      const payload = await verifyAccessToken(token);
      if (!payload.sub) {
        return next(new Error('Token inválido'));
      }

      const user = await findUserById(payload.sub);
      if (!user || !user.activo) {
        return next(new Error('Usuario inactivo o no autorizado'));
      }

      const role = await findRoleById(user.id_rol);
      if (!role || !role.activo) {
        return next(new Error('Rol de usuario inválido'));
      }

      const authUser: AuthenticatedUser = {
        id_usuario: user.id_usuario,
        email: user.email,
        nombre_usuario: user.nombre_usuario,
        rol: role.codigo,
        id_persona: user.id_persona,
        email_verificado: user.email_verificado,
        perfil_completo: Boolean(user.id_persona),
      };

      socket.data.user = authUser;

      // Si es profesional, resolvemos su ID de profesional
      if (authUser.rol === 'PROFESIONAL') {
        const own = await getOwnEntity(authUser);
        if (own.key === 'id_profesional') {
          socket.data.idProfesional = own.id;
        }
      }

      next();
    } catch (err: any) {
      next(new Error(err?.message || 'Error en autenticación WebSocket'));
    }
  });

  io.on('connection', async (socket) => {
    const user: AuthenticatedUser | undefined = socket.data.user;
    const idProf: string | undefined = socket.data.idProfesional;

    if (!user) return;

    // Canal privado de usuario
    socket.join(`user:${user.id_usuario}`);

    const today = new Date().toISOString().slice(0, 10);

    // Si es profesional, se une a su sala privada y a las salitas donde presta servicios
    if (user.rol === 'PROFESIONAL' && idProf) {
      socket.join(`profesional:${idProf}`);
      try {
        const salitasProf = await findTurnoSalitasForProfesional(idProf, today);
        for (const salitaId of salitasProf) {
          socket.join(`salita:${salitaId}`);
        }
      } catch {
        // Conexión continúa si no se pudieron cargar salitas del profesional
      }
    }

    // Si es administración o recepción, se une a sus salitas asignadas
    if (['ADMIN_SALITA', 'RECEPCION'].includes(user.rol)) {
      try {
        const salitas = await findTurnoSalitasForUser(user.id_usuario, today);
        for (const salitaId of salitas) {
          socket.join(`salita:${salitaId}`);
        }
      } catch {
        // Conexión continúa
      }
    }

    // Si es paciente, se une a su canal privado de paciente y al de las personas a su cargo
    if (user.rol === 'PACIENTE') {
      try {
        const own = await getOwnEntity(user);
        if (own && own.key === 'id_paciente' && own.id) {
          socket.join(`paciente:${own.id}`);
          socket.data.idPaciente = own.id;
        }
      } catch {
        // El usuario puede no tener aún perfil de paciente vinculado
      }

      // Si es tutor de personas a cargo con permiso para gestionar turnos, unirse a sus canales
      try {
        if (user.id_persona) {
          const { data: tutor } = await supabase
            .from('tutores')
            .select('id_tutor')
            .eq('id_persona', user.id_persona)
            .eq('activo', true)
            .maybeSingle();

          if (tutor) {
            const todayDate = today;
            const { data: relations } = await supabase
              .from('paciente_tutores')
              .select('id_paciente, fecha_desde, fecha_hasta')
              .eq('id_tutor', tutor.id_tutor)
              .eq('puede_gestionar_turnos', true)
              .eq('identidad_verificada', true)
              .eq('documentacion_verificada', true)
              .eq('autorizacion_verificada', true)
              .lte('fecha_desde', todayDate)
              .or(`fecha_hasta.is.null,fecha_hasta.gte.${todayDate}`);

            if (relations && Array.isArray(relations)) {
              for (const rel of relations) {
                if (rel.id_paciente) {
                  socket.join(`paciente:${rel.id_paciente}`);
                }
              }
            }
          }
        }
      } catch {
        // Conexión continúa si falla la búsqueda de dependientes
      }
    }

    // Super admin se une al canal global de supervisión
    if (user.rol === 'SUPER_ADMIN') {
      socket.join('super_admin');
    }

    socket.on('disconnect', () => {
      // Desconexión limpia
    });
  });

  return io;
};

export const getSocketServer = (): SocketIOServer | null => io;

/**
 * Emite una notificación de cambio de agenda a la sala del profesional y de la salita.
 */
export const emitirCambioAgenda = (
  evento: Omit<EventoAgenda, 'id' | 'timestamp'>
) => {
  if (!io) return;

  const payload: EventoAgenda = {
    ...evento,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };

  const rooms: string[] = ['super_admin'];
  if (evento.id_profesional) {
    rooms.push(`profesional:${evento.id_profesional}`);
  }
  if (evento.id_salita) {
    rooms.push(`salita:${evento.id_salita}`);
  }
  if (evento.id_paciente) {
    rooms.push(`paciente:${evento.id_paciente}`);
  }

  io.to(rooms).emit('agenda:cambio', payload);
};

/**
 * Emite una notificación de horario de atención actualizado.
 */
export const emitirHorarioAtencionActualizado = (
  evento: Omit<EventoAgenda, 'id' | 'timestamp' | 'tipo'> & {
    tipo?: 'HORARIO_ATENCION_ACTUALIZADO' | undefined;
  }
) => {
  if (!io) return;

  const payload: EventoAgenda = {
    ...evento,
    tipo: 'HORARIO_ATENCION_ACTUALIZADO',
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };

  const rooms: string[] = ['super_admin'];
  if (evento.id_profesional) {
    rooms.push(`profesional:${evento.id_profesional}`);
  }
  if (evento.id_salita) {
    rooms.push(`salita:${evento.id_salita}`);
  }

  io.to(rooms).emit('agenda:cambio', payload);
};

/**
 * Emite evento de cambios en pacientes (alta, edición administrativa, cambio de estado, tutor).
 */
export const emitirCambioPaciente = (
  evento: Omit<EventoPaciente, 'id' | 'timestamp'>
) => {
  if (!io) return;

  const payload: EventoPaciente = {
    ...evento,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };

  const rooms: string[] = ['super_admin'];
  if (evento.id_salita) {
    rooms.push(`salita:${evento.id_salita}`);
  }
  if (evento.id_paciente) {
    rooms.push(`paciente:${evento.id_paciente}`);
  }

  io.to(rooms).emit('paciente:cambio', payload);
};

/**
 * Emite evento de cambios en profesionales (alta, modificación, especialidad).
 */
export const emitirCambioProfesional = (
  evento: Omit<EventoProfesional, 'id' | 'timestamp'>
) => {
  if (!io) return;

  const payload: EventoProfesional = {
    ...evento,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };

  const rooms: string[] = ['super_admin'];
  if (evento.id_profesional) {
    rooms.push(`profesional:${evento.id_profesional}`);
  }
  if (evento.id_salita) {
    rooms.push(`salita:${evento.id_salita}`);
  }

  io.to(rooms).emit('profesional:cambio', payload);
};

/**
 * Emite evento de cambios en salita (configuración, disponibilidad, bloqueos).
 */
export const emitirCambioSalita = (
  evento: Omit<EventoSalita, 'id' | 'timestamp'>
) => {
  if (!io) return;

  const payload: EventoSalita = {
    ...evento,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };

  const rooms: string[] = ['super_admin'];
  if (evento.id_salita) {
    rooms.push(`salita:${evento.id_salita}`);
  }

  io.to(rooms).emit('salita:cambio', payload);
};

/**
 * Emite evento de cambios territoriales (zonas, barrios, coberturas).
 */
export const emitirCambioTerritorial = (
  evento: Omit<EventoTerritorial, 'id' | 'timestamp'>
) => {
  if (!io) return;

  const payload: EventoTerritorial = {
    ...evento,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };

  const rooms: string[] = ['super_admin'];
  if (evento.id_salita) {
    rooms.push(`salita:${evento.id_salita}`);
  }

  io.to(rooms).emit('territorio:cambio', payload);
};

/**
 * Emite evento de eventos clínicos mínimos (firma de consulta, evolución, estudio, derivación).
 * IMPORTANTE: No transmite datos clínicos sensibles, únicamente identificadores para invalidación.
 */
export const emitirCambioClinico = (
  evento: Omit<EventoClinico, 'id' | 'timestamp'>
) => {
  if (!io) return;

  const payload: EventoClinico = {
    ...evento,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };

  const rooms: string[] = ['super_admin'];
  if (evento.id_salita) {
    rooms.push(`salita:${evento.id_salita}`);
  }
  if (evento.id_profesional) {
    rooms.push(`profesional:${evento.id_profesional}`);
  }
  if (evento.id_paciente) {
    rooms.push(`paciente:${evento.id_paciente}`);
  }

  io.to(rooms).emit('clinica:cambio', payload);
};
