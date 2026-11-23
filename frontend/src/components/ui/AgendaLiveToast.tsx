import { useEffect, useRef } from 'react';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import type { EventoAgenda } from '../../types/socket.types';
import { PROFESSIONAL_MESSAGE_TIMEOUT_MS } from '../../utils/useAutoDismiss';
import '../../styles/agenda-socket.css';

interface ToastItemProps {
  evento: EventoAgenda;
  onClose: (id: string) => void;
}

function ToastItem({ evento, onClose }: ToastItemProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Auto-cierre estricto a los 15 segundos sin reinicios espurios por re-renders del padre
  useEffect(() => {
    const timer = setTimeout(() => {
      onCloseRef.current(evento.id);
    }, PROFESSIONAL_MESSAGE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [evento.id]);

  const getTipoInfo = (tipo: EventoAgenda['tipo']) => {
    switch (tipo) {
      case 'TURNO_CREADO':
        return {
          icon: 'bi-calendar-plus-fill text-success',
          label: 'Nuevo turno',
          badgeClass: 'text-success',
        };
      case 'TURNO_REPROGRAMADO':
        return {
          icon: 'bi-calendar-range-fill text-primary',
          label: 'Turno reprogramado',
          badgeClass: 'text-primary',
        };
      case 'TURNO_CANCELADO':
        return {
          icon: 'bi-calendar-x-fill text-danger',
          label: 'Turno cancelado',
          badgeClass: 'text-danger',
        };
      case 'BLOQUEO_AGENDA':
        return {
          icon: 'bi-slash-circle-fill text-warning',
          label: 'Bloqueo de agenda',
          badgeClass: 'text-warning',
        };
      case 'HORARIO_ATENCION_ACTUALIZADO':
        return {
          icon: 'bi-clock-history text-primary',
          label: 'Horario de atención',
          badgeClass: 'text-primary',
        };
      default:
        return {
          icon: 'bi-bell-fill text-info',
          label: 'Actualización de turno',
          badgeClass: 'text-info',
        };
    }
  };

  const info = getTipoInfo(evento.tipo);

  return (
    <div className={`agenda-toast-card tipo-${evento.tipo.toLowerCase()}`} role="alert">
      <div className="agenda-toast-header">
        <span className={`agenda-toast-badge ${info.badgeClass}`}>
          <i className={`bi ${info.icon} me-1`} aria-hidden="true" />
          {info.label}
        </span>
        <button
          type="button"
          className="agenda-toast-close"
          onClick={() => onClose(evento.id)}
          aria-label="Cerrar notificación"
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      </div>

      <div className="agenda-toast-body">
        <div className="agenda-toast-title">{evento.mensaje}</div>

        {evento.paciente && (
          <div className="agenda-toast-patient">
            <i className="bi bi-person-fill text-secondary" aria-hidden="true" />
            <span>Paciente: <strong>{evento.paciente}</strong></span>
          </div>
        )}

        {/* Si es reprogramación, mostramos el detalle exacto: anterior vs nuevo */}
        {evento.tipo === 'TURNO_REPROGRAMADO' && (evento.nueva_fecha || evento.fecha_anterior) && (
          <div className="agenda-toast-reprogramacion-grid">
            <div className="reprogramacion-col">
              <span className="reprogramacion-label">Horario anterior</span>
              <span className="reprogramacion-val anterior">
                {evento.fecha_anterior ? evento.fecha_anterior.split('-').reverse().join('/') : '—'}{' '}
                {evento.horario_anterior ? `${evento.horario_anterior} hs` : ''}
              </span>
            </div>
            <div className="reprogramacion-col">
              <span className="reprogramacion-label">Nuevo horario</span>
              <span className="reprogramacion-val nuevo">
                {evento.nueva_fecha ? evento.nueva_fecha.split('-').reverse().join('/') : '—'}{' '}
                {evento.nuevo_horario ? `${evento.nuevo_horario} hs` : ''}
              </span>
            </div>
          </div>
        )}

        {evento.motivo && (
          <div className="small text-muted mt-2">
            Motivo: <em>{evento.motivo}</em>
          </div>
        )}

        <div className="agenda-toast-meta">
          {new Date(evento.timestamp).toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}

export function AgendaLiveToasts() {
  const { notificaciones, descartarNotificacion } = useAgendaSocket();

  if (!notificaciones.length) return null;

  return (
    <div className="agenda-toasts-container" aria-live="polite">
      {notificaciones.map((n) => (
        <ToastItem key={n.id} evento={n} onClose={descartarNotificacion} />
      ))}
    </div>
  );
}

/**
 * Componente pill para visualizar el estado de conexión WebSocket en vivo
 */
export function AgendaSocketStatusBadge() {
  const { estadoConexion } = useAgendaSocket();

  if (estadoConexion === 'conectado') {
    return null;
  }

  const getLabel = () => {
    switch (estadoConexion) {
      case 'reconectando':
        return 'Reconectando...';
      case 'desconectado':
        return 'Sin conexión en vivo';
    }
  };

  return (
    <span
      className={`socket-status-badge ${estadoConexion}`}
      title={
        estadoConexion === 'reconectando'
          ? 'Reconectando con el servidor en tiempo real...'
          : 'Sin conexión en tiempo real. Utilizá el botón Actualizar agenda.'
      }
    >
      <span className="socket-pulse-dot" />
      {getLabel()}
    </span>
  );
}
