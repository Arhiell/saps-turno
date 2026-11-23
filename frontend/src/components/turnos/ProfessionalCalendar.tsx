import { useEffect, useState, useRef } from 'react';
import { getTurnos } from '../../services/turnos.service';
import { authError } from '../../utils/auth-errors';
import { useAutoDismiss } from '../../utils/useAutoDismiss';

const dateKey = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date);

export default function ProfessionalCalendar({
  revision,
  selected,
  onSelect,
}: {
  revision: number;
  selected: string;
  onSelect: (day: string) => void;
}) {
  const [month, setMonth] = useState(() => dateKey(new Date()).slice(0, 7));
  const [days, setDays] = useState<Record<string, Record<string, { name: string; count: number }>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [year, number] = month.split('-').map(Number);
  const count = new Date(Date.UTC(year!, number!, 0)).getUTCDate();
  const offset = (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7;
  const requestIdRef = useRef(0);

  useAutoDismiss(error, setError);

  useEffect(() => {
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setError('');

    void (async () => {
      const firstResponse = await getTurnos({
        fecha_desde: `${month}-01`,
        fecha_hasta: `${month}-${count}`,
        page: 1,
        limit: 100,
      });

      if (currentRequestId !== requestIdRef.current) return;

      const allTurnos = [...(firstResponse?.data?.turnos ?? [])];
      const totalPages = firstResponse?.data?.pagination?.totalPages || 1;
      let hasPartialError = false;

      if (totalPages > 1) {
        const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
        // Concurrencia limitada: procesamiento por lotes de a 3 solicitudes en paralelo
        const CHUNK_SIZE = 3;

        for (let i = 0; i < remainingPages.length; i += CHUNK_SIZE) {
          if (currentRequestId !== requestIdRef.current) return;
          const chunk = remainingPages.slice(i, i + CHUNK_SIZE);

          const chunkResponses = await Promise.allSettled(
            chunk.map((p) =>
              getTurnos({
                fecha_desde: `${month}-01`,
                fecha_hasta: `${month}-${count}`,
                page: p,
                limit: 100,
              })
            )
          );

          if (currentRequestId !== requestIdRef.current) return;

          for (const res of chunkResponses) {
            if (res.status === 'fulfilled' && res.value?.data?.turnos) {
              allTurnos.push(...res.value.data.turnos);
            } else {
              hasPartialError = true;
            }
          }
        }
      }

      const result: typeof days = {};
      for (const turno of allTurnos) {
        const key = dateKey(new Date(turno.fecha_hora_inicio));
        const day = (result[key] ??= {});
        const status = (day[turno.estado.codigo] ??= {
          name: turno.estado.nombre,
          count: 0,
        });
        status.count++;
      }

      if (currentRequestId === requestIdRef.current) {
        setDays(result);
        if (hasPartialError && allTurnos.length === 0) {
          setError('No se pudo cargar la totalidad de los turnos del mes.');
        }
      }
    })()
      .catch((cause) => {
        if (currentRequestId === requestIdRef.current) {
          setError(authError(cause));
        }
      })
      .finally(() => {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      });
  }, [month, count, revision]);

  const move = (delta: number) => {
    const date = new Date(Date.UTC(year!, number! - 1 + delta, 1, 12));
    setMonth(date.toISOString().slice(0, 7));
  };

  const monthDate = new Date(year!, number! - 1, 1);
  const rawMonthName = new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
  }).format(monthDate);
  const capitalizedMonth = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);

  return (
    <section className="professional-calendar" aria-label="Calendario de actividad">
      {/* Navegación del mes estilo CORA */}
      <div className="professional-calendar__navigation mb-3">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center"
          onClick={() => move(-1)}
          aria-label="Mes anterior"
          title="Mes anterior"
          style={{ width: '32px', height: '32px', borderRadius: '8px' }}
        >
          <i className="bi bi-chevron-left" aria-hidden="true" />
        </button>
        <span className="fw-bold text-dark text-center flex-grow-1 user-select-none" style={{ fontSize: '0.95rem' }}>
          {capitalizedMonth}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center"
          onClick={() => move(1)}
          aria-label="Mes siguiente"
          title="Mes siguiente"
          style={{ width: '32px', height: '32px', borderRadius: '8px' }}
        >
          <i className="bi bi-chevron-right" aria-hidden="true" />
        </button>
      </div>

      {/* Grilla semanal: Lun, Mar, Mié, Jue, Vie, Sáb, Dom */}
      <div className="professional-calendar__grid" aria-busy={loading}>
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
          <strong key={day} className="text-center small">
            {day}
          </strong>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const key = `${month}-${String(i + 1).padStart(2, '0')}`;
          const states = Object.entries(days[key] ?? {});
          const summary = states.map(([, status]) => `${status.name}: ${status.count}`).join(', ');
          const isSelected = selected === key;
          const isToday = key === dateKey(new Date());

          return (
            <button
              key={key}
              type="button"
              disabled={loading || !!error}
              className={`professional-calendar__day${states.length ? ' has-activity' : ''}${
                isSelected ? ' is-selected' : ''
              }`}
              aria-pressed={isSelected}
              aria-label={`${key}: ${summary || 'Sin turnos'}`}
              title={`${key}: ${summary || 'Sin turnos'}`}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => onSelect(key)}
            >
              <strong>{i + 1}</strong>
            </button>
          );
        })}
      </div>

      {loading && <p className="text-muted small text-center mt-2 mb-0" role="status">Cargando...</p>}
      {error && <p className="alert alert-danger small p-2 mt-2 mb-0" role="alert">{error}</p>}
    </section>
  );
}
