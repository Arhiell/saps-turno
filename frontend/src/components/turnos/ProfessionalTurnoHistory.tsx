import { useEffect, useState } from 'react';
import { getTurnoHistory } from '../../services/turnos.service';
import { authError } from '../../utils/auth-errors';
import type { AppointmentHistory } from '../../types/turno.types';

const formatDate = (date: string) => new Date(date).toLocaleString('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
});
const actions: Record<string, string> = {
  CREACION: 'Turno creado', CREADO: 'Turno creado', REPROGRAMACION: 'Reprogramado',
  REPROGRAMADO: 'Reprogramado', CAMBIO_PROFESIONAL: 'Cambio de profesional',
  CANCELACION: 'Cancelado', CANCELADO: 'Cancelado', CAMBIO_ESTADO: 'Cambio de estado',
  ATENDIDO: 'Atendido', NO_ASISTIO: 'No asistió', ACTUALIZACION: 'Datos actualizados',
};

export default function ProfessionalTurnoHistory({ turnoId, revision }: { turnoId: string; revision: number }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<AppointmentHistory[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError('');
    setEvents([]);
    void getTurnoHistory(turnoId).then(rows => { if (active) setEvents(rows); })
      .catch(cause => { if (active) setError(authError(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, turnoId, revision]);
  return <div className="mb-2">
    <button type="button" className="btn btn-sm btn-outline-secondary" aria-expanded={open}
      aria-controls={`history-${turnoId}`} onClick={() => setOpen(value => !value)}>
      {open ? 'Ocultar historial' : 'Ver historial'}
    </button>
    {open && <div id={`history-${turnoId}`} className="mt-2 small">
      {loading && <p role="status">Cargando historial…</p>}
      {error && <p className="text-danger" role="alert">{error}</p>}
      {!loading && !error && !events.length && <p>Sin cambios registrados.</p>}
      <ul className="ps-3">{events.map(event => <li key={event.id_historial} className="mb-2">
        <strong>{actions[event.accion] ?? event.accion.replaceAll('_', ' ')}</strong>
        <div>{formatDate(event.fecha)}</div>
        {event.estado_nombre && <div>Estado: {event.estado_nombre}</div>}
        {event.fecha_hora_anterior && <div>Antes: {formatDate(event.fecha_hora_anterior)}</div>}
        {event.fecha_hora_nueva && <div>Nuevo horario: {formatDate(event.fecha_hora_nueva)}</div>}
      </li>)}</ul>
    </div>}
  </div>;
}
