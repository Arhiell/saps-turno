import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  createOwnTurno,
  getDisponibilidad,
} from '../../services/turnos.service';

import type {
  DisponibilidadSlot,
} from '../../types/turno.types';

import { useAgendaSocket } from '../../context/AgendaSocketContext';
import {
  authError,
} from '../../utils/auth-errors';

export default function PatientBookingSlots({
  date,
  professional,
  specialty,
  clinic,
  patientId,
  refreshKey = 0,
  onBusyChange,
}: {
  date: string;
  professional: string;
  specialty: string;
  clinic: string;
  patientId?: string;
  refreshKey?: number;
  onBusyChange: (busy: boolean) => void;
}) {
  // Horarios disponibles devueltos por la API.
  const [slots, setSlots] = useState<DisponibilidadSlot[]>([]);

  // Horario seleccionado por el paciente.
  const [selected, setSelected] = useState('');

  // Motivo opcional de la consulta.
  const [reason, setReason] = useState('');

  // Estados de carga y operación.
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Mensaje de error.
  const [error, setError] = useState('');

  // Permite volver a consultar los horarios.
  const [revision, setRevision] = useState(0);

  const navigate = useNavigate();

  // Actualización reactiva en tiempo real por WebSockets
  const { ultimoEvento, resyncTick } = useAgendaSocket();

  useEffect(() => {
    if (!ultimoEvento) return;
    if (
      (!ultimoEvento.id_profesional || ultimoEvento.id_profesional === professional) &&
      (!ultimoEvento.id_salita || ultimoEvento.id_salita === clinic)
    ) {
      setRevision((v) => v + 1);
    }
  }, [ultimoEvento, professional, clinic]);

  useEffect(() => {
    if (resyncTick > 0) {
      setRevision((v) => v + 1);
    }
  }, [resyncTick]);

  // ========================================
  // CARGA DE HORARIOS DISPONIBLES
  // ========================================

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');
    setSlots([]);

    void getDisponibilidad(
      date,
      professional,
      specialty,
      clinic,
      patientId
    )
      .then((response) => {
        if (!active) return;

        // Filtra los horarios que ya pasaron si la fecha seleccionada es hoy
        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
        const isToday = date === todayStr;
        const currentMinutes = isToday
          ? (() => {
              const arParts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Argentina/Buenos_Aires',
                hour: 'numeric',
                minute: 'numeric',
                hour12: false,
              }).formatToParts(now);
              const hour = Number(arParts.find((p) => p.type === 'hour')?.value ?? '0');
              const min = Number(arParts.find((p) => p.type === 'minute')?.value ?? '0');
              return hour * 60 + min;
            })()
          : -1;

        const availableSlots = response.slots.filter((s) => {
          if (s.estado !== 'DISPONIBLE') return false;
          if (isToday) {
            const [h, m] = s.hora_inicio.split(':').map(Number);
            if (h * 60 + m <= currentMinutes) return false;
          }
          return true;
        });

        setSlots(availableSlots);
        setSelected((current) =>
          availableSlots.some((slot) => slot.hora_inicio === current) ? current : ''
        );
      })
      .catch((cause) => {
        if (active) {
          setError(authError(cause));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    date,
    professional,
    specialty,
    clinic,
    patientId,
    revision,
    refreshKey,
  ]);

  // ========================================
  // RESERVA DEL TURNO
  // ========================================

  const book = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    // Evita solicitudes duplicadas o sin horario.
    if (
      busy ||
      !selected
    ) {
      return;
    }

    setBusy(true);
    onBusyChange(true);
    setError('');

    try {
      // El servidor resuelve el paciente
      // y revalida el horario al reservar.
      const response =
        await createOwnTurno({
          ...(patientId ? { id_paciente: patientId } : {}),
          id_profesional:
            professional,

          id_especialidad:
            specialty,

          id_salita:
            clinic,

          fecha_hora_inicio:
            `${date}T${selected.slice(0, 5)}:00-03:00`,

          ...(reason.trim()
            ? {
                motivo_consulta:
                  reason.trim(),
              }
            : {}),
        });

      // Redirige al detalle del turno creado.
      navigate(
        `/mis-turnos/${response.data.turno.id_turno}`,
        {
          state: {
            created: true,
          },
        }
      );
    } catch (cause) {
      setError(
        authError(cause)
      );

      // Limpia el horario seleccionado
      // para obligar a elegir uno nuevamente.
      setSelected('');
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  };

  // ========================================
  // INTERFAZ
  // ========================================

  return (
    <div className="mt-4">
      <h3 className="h6">
        Horarios disponibles
      </h3>

      {/* Estado de carga. */}
      {loading && (
        <div className="card border-0 shadow-sm p-3 text-center text-muted" role="status">
          <div>
            <div className="spinner-border spinner-border-sm text-success me-2" aria-hidden="true" />
            <span className="align-middle">Consultando disponibilidad…</span>
          </div>
        </div>
      )}

      {/* Mensaje de error y opción de reintento. */}
      {error && (
        <div
          className="alert alert-danger d-flex align-items-center justify-content-between gap-2"
          role="alert"
        >
          <span>{error}</span>

          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            disabled={busy}
            onClick={() =>
              setRevision(
                (v) => v + 1
              )
            }
          >
            Reintentar
          </button>
        </div>
      )}

      {/* No existen horarios disponibles. */}
      {!loading &&
        !error &&
        !slots.length && (
          <div className="alert alert-info d-flex align-items-center gap-2 mb-0" role="status">
            <i className="bi bi-info-circle flex-shrink-0" aria-hidden="true" />
            <span>No hay horarios disponibles para esta fecha. Probá seleccionando otro día o profesional.</span>
          </div>
        )}

      {/* Formulario de reserva. */}
      {!loading &&
        !error &&
        slots.length > 0 && (
          <form
            onSubmit={(event) =>
              void book(event)
            }
          >
            <fieldset disabled={busy}>
              <legend className="visually-hidden">
                Elegí un horario
              </legend>

              {/* Selección del horario en cuadrícula accesible. */}
              <div className="d-flex flex-wrap gap-2 mb-3" role="radiogroup" aria-label="Horarios disponibles">
                {slots.map(
                  (slot) => {
                    const isSelected = selected === slot.hora_inicio;
                    return (
                      <button
                        key={slot.hora_inicio}
                        type="button"
                        className={`btn btn-sm ${
                          isSelected ? 'btn-success fw-bold' : 'btn-outline-success'
                        } d-inline-flex align-items-center justify-content-center gap-1 px-3 py-2 text-nowrap`}
                        style={{ minWidth: '82px', minHeight: '40px' }}
                        onClick={() => setSelected(slot.hora_inicio)}
                        aria-pressed={isSelected}
                      >
                        <i className={`bi ${isSelected ? 'bi-check2-circle' : 'bi-clock'}`} aria-hidden="true" />
                        <span>{slot.hora_inicio.slice(0, 5)}</span>
                      </button>
                    );
                  }
                )}
              </div>

              {/* Motivo opcional de la consulta. */}
              <label className="form-label w-100">
                Motivo de consulta (opcional)

                <textarea
                  className="form-control mt-1"
                  maxLength={2000}
                  value={reason}
                  onChange={(event) =>
                    setReason(
                      event.target.value
                    )
                  }
                />
              </label>

              {/* Resumen antes de confirmar. */}
              {selected && (
                <p role="status">
                  Vas a solicitar un turno para el{' '}
                  {date
                    .split('-')
                    .reverse()
                    .join('/')}{' '}
                  a las{' '}
                  {selected.slice(0, 5)}.
                </p>
              )}

              {/* Confirmación de la reserva. */}
              <button
                className="btn btn-saps text-nowrap d-inline-flex align-items-center justify-content-center px-4"
                style={{ minHeight: '44px' }}
                disabled={!selected || busy}
              >
                {busy
                  ? 'Reservando…'
                  : 'Confirmar solicitud'}
              </button>
            </fieldset>
          </form>
        )}
    </div>
  );
}
