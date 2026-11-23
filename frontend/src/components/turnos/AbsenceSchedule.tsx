import { useEffect, useState } from 'react';
import { getHorarios } from '../../services/configuracion.service';
import type { BloqueoInput, Horario } from '../../types/configuracion.types';
import { agendaDate, agendaToday } from '../../utils/agenda-display';
import { authError } from '../../utils/auth-errors';

const move = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export default function AbsenceSchedule({ form, onDate }: { form: BloqueoInput; onDate: (date: string) => void }) {
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [cursor, setCursor] = useState(form.fecha || agendaToday());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void getHorarios().then(data => { if (active) setHorarios(data); })
      .catch(cause => { if (active) setError(authError(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => { if (form.fecha) setCursor(form.fecha); }, [form.fecha]);
  const weekday = new Date(`${cursor}T12:00:00Z`).getUTCDay() || 7;
  const monday = move(cursor, 1 - weekday);
  const matches = (date: string) => horarios.filter(h => h.activo && h.id_salita === form.id_salita &&
    (!form.id_profesional || h.id_profesional === form.id_profesional) &&
    (!form.id_especialidad || h.id_especialidad === form.id_especialidad) &&
    h.dia_semana === (new Date(`${date}T12:00:00Z`).getUTCDay() || 7) &&
    h.vigencia_desde <= date && (!h.vigencia_hasta || h.vigencia_hasta >= date));
  if (!form.id_salita) return <p className="text-muted">Seleccioná la salita para ver los días de atención.</p>;
  return <section className="border rounded p-3" aria-label="Días habituales de atención">
    <h3 className="h6">2. Elegí el día de la ausencia</h3>
    <p className="small">Las fechas con atención muestran los horarios habituales vigentes. No indican lugares libres ni descuentan otros bloqueos.</p>
    {!form.id_profesional && <p className="text-warning-emphasis">Seleccionaste todos los profesionales: el cierre afectará a todos los que coincidan con la salita y especialidad elegidas.</p>}
    {loading ? <p role="status">Cargando horarios habituales…</p> : error ? <div role="alert">{error} <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setRetry(v => v + 1)}>Recargar horarios</button></div> : <>
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setCursor(move(cursor, -7))}>Semana anterior</button>
        <span className="small">Desde {agendaDate(monday)}</span>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setCursor(move(cursor, 7))}>Semana siguiente</button>
      </div>
      <div className="row g-2">{Array.from({ length: 7 }, (_, index) => {
        const date = move(monday, index);
        const slots = matches(date);
        return <div className="col-12 col-sm-6 col-xl-3" key={date}>
          <button type="button" className={`btn w-100 h-100 text-start text-wrap ${date === form.fecha ? 'btn-saps' : 'btn-outline-secondary'}`}
            aria-pressed={date === form.fecha} onClick={() => onDate(date)}>
            <strong className="d-block">{agendaDate(date)}</strong>
            <span className="d-block small">{slots.length ? `Con atención: ${[...new Set(slots.map(h => `${h.hora_inicio.slice(0, 5)}–${h.hora_fin.slice(0, 5)}`))].join(', ')}` : 'Sin atención configurada'}</span>
          </button>
        </div>;
      })}</div>
      {form.fecha && <p className="mt-3 mb-0" role="status"><strong>Fecha elegida: {agendaDate(form.fecha)}.</strong>{' '}
        {!matches(form.fecha).length && 'No hay atención habitual configurada para esta selección. Revisá la fecha; podés consultar igualmente si existen turnos afectados.'}
      </p>}
    </>}
  </section>;
}
