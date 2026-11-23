import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getAccessToken } from '../utils/auth-storage';
import { clearSalitasCache } from '../services/salitas.service';
import { clearProfessionalsCache } from '../services/profesionales.service';
import { clearTurnosCache } from '../services/turnos.service';
import type {
  EventoAgenda,
  EventoPaciente,
  EventoProfesional,
  EventoSalita,
  EventoTerritorial,
  EventoClinico,
  EstadoConexionSocket,
} from '../types/socket.types';

interface AgendaSocketContextType {
  estadoConexion: EstadoConexionSocket;
  ultimoEvento: EventoAgenda | null;
  ultimoEventoPaciente: EventoPaciente | null;
  ultimoEventoProfesional: EventoProfesional | null;
  ultimoEventoSalita: EventoSalita | null;
  ultimoEventoTerritorial: EventoTerritorial | null;
  ultimoEventoClinico: EventoClinico | null;
  resyncTick: number;
  notificaciones: EventoAgenda[];
  descartarNotificacion: (id: string) => void;
  limpiarNotificaciones: () => void;
  reconnect: () => void;
}

const AgendaSocketContext = createContext<AgendaSocketContextType>({
  estadoConexion: 'desconectado',
  ultimoEvento: null,
  ultimoEventoPaciente: null,
  ultimoEventoProfesional: null,
  ultimoEventoSalita: null,
  ultimoEventoTerritorial: null,
  ultimoEventoClinico: null,
  resyncTick: 0,
  notificaciones: [],
  descartarNotificacion: () => {},
  limpiarNotificaciones: () => {},
  reconnect: () => {},
});

export const useAgendaSocket = () => useContext(AgendaSocketContext);
export const useRealtimeSocket = () => useContext(AgendaSocketContext);

export function AgendaSocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexionSocket>('desconectado');
  const [ultimoEvento, setUltimoEvento] = useState<EventoAgenda | null>(null);
  const [ultimoEventoPaciente, setUltimoEventoPaciente] = useState<EventoPaciente | null>(null);
  const [ultimoEventoProfesional, setUltimoEventoProfesional] = useState<EventoProfesional | null>(null);
  const [ultimoEventoSalita, setUltimoEventoSalita] = useState<EventoSalita | null>(null);
  const [ultimoEventoTerritorial, setUltimoEventoTerritorial] = useState<EventoTerritorial | null>(null);
  const [ultimoEventoClinico, setUltimoEventoClinico] = useState<EventoClinico | null>(null);
  const [resyncTick, setResyncTick] = useState<number>(0);
  const [notificaciones, setNotificaciones] = useState<EventoAgenda[]>([]);
  const eventosProcesadosRef = useRef<Set<string>>(new Set());

  const registerEventId = (id: string): boolean => {
    if (!id || eventosProcesadosRef.current.has(id)) {
      return false;
    }
    eventosProcesadosRef.current.add(id);
    if (eventosProcesadosRef.current.size > 100) {
      const arr = Array.from(eventosProcesadosRef.current);
      eventosProcesadosRef.current = new Set(arr.slice(arr.length - 50));
    }
    return true;
  };

  useEffect(() => {
    // Conectamos WebSocket para todos los roles autorizados (incluyendo PACIENTE)
    if (!user || !['PROFESIONAL', 'ADMIN_SALITA', 'RECEPCION', 'SUPER_ADMIN', 'PACIENTE'].includes(user.rol)) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setEstadoConexion('desconectado');
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const socketBaseUrl = apiUrl.replace(/\/api\/?$/, '');

    const socket = io(socketBaseUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setEstadoConexion('conectado');
    });

    socket.on('disconnect', () => {
      setEstadoConexion('desconectado');
    });

    socket.on('connect_error', () => {
      setEstadoConexion('reconectando');
    });

    socket.io.on('reconnect_attempt', () => {
      setEstadoConexion('reconectando');
    });

    socket.io.on('reconnect', () => {
      setEstadoConexion('conectado');
      // Al reconectar, invalidamos cachés y aumentamos el tick para que las pantallas activas resincronicen
      clearSalitasCache();
      clearProfessionalsCache();
      clearTurnosCache();
      setResyncTick((prev) => prev + 1);
    });

    // 1. Escucha de eventos de cambio de agenda y turnos
    socket.on('agenda:cambio', (evento: EventoAgenda) => {
      if (!evento || !evento.id) return;
      if (!registerEventId(evento.id)) return;

      clearTurnosCache();
      setUltimoEvento(evento);

      const esFirmaClinicaPropia = Boolean(
        evento.mensaje && evento.mensaje.toLowerCase().includes('firmar la consulta')
      );

      if (!esFirmaClinicaPropia) {
        setNotificaciones((prev) => [evento, ...prev.slice(0, 4)]);
      }
    });

    // 2. Escucha de eventos de pacientes
    socket.on('paciente:cambio', (evento: EventoPaciente) => {
      if (!evento || !evento.id) return;
      if (!registerEventId(evento.id)) return;

      setUltimoEventoPaciente(evento);
    });

    // 3. Escucha de eventos de profesionales
    socket.on('profesional:cambio', (evento: EventoProfesional) => {
      if (!evento || !evento.id) return;
      if (!registerEventId(evento.id)) return;

      clearProfessionalsCache();
      setUltimoEventoProfesional(evento);
    });

    // 4. Escucha de eventos de salitas
    socket.on('salita:cambio', (evento: EventoSalita) => {
      if (!evento || !evento.id) return;
      if (!registerEventId(evento.id)) return;

      clearSalitasCache();
      setUltimoEventoSalita(evento);
    });

    // 5. Escucha de eventos territoriales (zonas, barrios, cobertura)
    socket.on('territorio:cambio', (evento: EventoTerritorial) => {
      if (!evento || !evento.id) return;
      if (!registerEventId(evento.id)) return;

      clearSalitasCache();
      setUltimoEventoTerritorial(evento);
    });

    // 6. Escucha de eventos clínicos mínimos
    socket.on('clinica:cambio', (evento: EventoClinico) => {
      if (!evento || !evento.id) return;
      if (!registerEventId(evento.id)) return;

      setUltimoEventoClinico(evento);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setEstadoConexion('desconectado');
    };
  }, [user?.id_usuario, user?.rol]);

  const descartarNotificacion = useCallback((id: string) => {
    setNotificaciones((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const limpiarNotificaciones = useCallback(() => {
    setNotificaciones([]);
  }, []);

  const reconnect = useCallback(() => {
    if (socketRef.current) {
      if (!socketRef.current.connected) {
        socketRef.current.connect();
      }
    }
  }, []);

  return (
    <AgendaSocketContext.Provider
      value={{
        estadoConexion,
        ultimoEvento,
        ultimoEventoPaciente,
        ultimoEventoProfesional,
        ultimoEventoSalita,
        ultimoEventoTerritorial,
        ultimoEventoClinico,
        resyncTick,
        notificaciones,
        descartarNotificacion,
        limpiarNotificaciones,
        reconnect,
      }}
    >
      {children}
    </AgendaSocketContext.Provider>
  );
}
