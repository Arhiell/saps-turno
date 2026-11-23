import { useEffect, useRef, useState } from 'react';

import { getPatientProfessionals } from '../../services/profesionales.service';
import { getPatientAvailableDates, type PatientAvailableDates } from '../../services/turnos.service';

import type { PatientProfessional } from '../../types/profesional.types';

import PatientBookingSlots from './PatientBookingSlots';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import { authError } from '../../utils/auth-errors';

// Formatea las fechas utilizando la zona horaria argentina.
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T12:00:00-03:00`));

// Permite seleccionar especialidad, profesional y fecha para reservar un turno.
export default function PatientBookingForm({
  clinic,
  patientId,
  onBusyChange,
}: {
  clinic: string;
  patientId?: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  // Almacena los profesionales y las opciones seleccionadas.
  const [professionals, setProfessionals] = useState<
    PatientProfessional[]
  >([]);

  const [specialty, setSpecialty] = useState('');
  const [professional, setProfessional] = useState('');
  const [date, setDate] = useState('');
  const [dates, setDates] = useState<string[]>([]);
  const [calendar, setCalendar] = useState<PatientAvailableDates['dias']>([]);

  // Controla los estados de carga y las solicitudes.
  const [loading, setLoading] = useState(true);
  const [loadingDates, setLoadingDates] = useState(false);
  const [busy, setBusy] = useState(false);

  // Almacena los mensajes de error.
  const [error, setError] = useState('');
  const [datesError, setDatesError] = useState('');

  // Permite actualizar la información de la agenda.
  const [revision, setRevision] = useState(0);

  // Sincronización en segundo plano con WebSockets
  const { ultimoEvento, ultimoEventoSalita, resyncTick } = useAgendaSocket();
  const lastEventKeyRef = useRef<string>(
    `${ultimoEvento?.id ?? ''}|${ultimoEventoSalita?.id ?? ''}`
  );
  const lastResyncTickRef = useRef<number>(resyncTick);

  useEffect(() => {
    if (busy) return;
    if (!ultimoEvento && !ultimoEventoSalita) return;
    const eventKey = `${ultimoEvento?.id ?? ''}|${ultimoEventoSalita?.id ?? ''}`;
    if (lastEventKeyRef.current === eventKey) return;
    lastEventKeyRef.current = eventKey;
    setRevision((v) => v + 1);
  }, [ultimoEvento, ultimoEventoSalita, busy]);

  useEffect(() => {
    if (busy) return;
    if (resyncTick > 0 && resyncTick !== lastResyncTickRef.current) {
      lastResyncTickRef.current = resyncTick;
      setRevision((v) => v + 1);
    }
  }, [resyncTick, busy]);

  // Actualiza al recuperar el foco de la ventana como salvaguarda
  useEffect(() => {
    if (busy) return;

    const refresh = () => {
      setRevision((value) => value + 1);
    };

    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
    };
  }, [busy]);

  // Obtiene los profesionales y especialidades disponibles.
  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');

    void getPatientProfessionals(undefined, patientId)
      .then((rows) => {
        if (!active) {
          return;
        }

        setProfessionals(rows);

        // Conserva la especialidad si continúa disponible.
        setSpecialty((current) =>
          rows.some((p) =>
            p.especialidades.some(
              (s) => s.id_especialidad === current
            )
          )
            ? current
            : ''
        );

        // Conserva el profesional si continúa disponible.
        setProfessional((current) =>
          rows.some(
            (p) => p.id_profesional === current
          )
            ? current
            : ''
        );
      })
      .catch((cause) => {
        if (active) {
          setError(authError(cause));
          setProfessionals([]);
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
  }, [clinic, patientId, revision]);

  // Consulta las fechas disponibles para la atención seleccionada.
  useEffect(() => {
    let active = true;

    setDatesError('');
    setCalendar([]);

    // Limpia las fechas cuando falta seleccionar una atención.
    if (!professional || !specialty) {
      setDates([]);
      setDate('');
      setLoadingDates(false);
      return;
    }

    setLoadingDates(true);

    void getPatientAvailableDates(
      professional,
      specialty,
      clinic,
      patientId
    )
      .then((result) => {
        if (!active) {
          return;
        }

        setDates(result.fechas);
        setCalendar(result.dias ?? []);

        // Conserva la fecha seleccionada si sigue disponible.
        setDate((current) =>
          result.fechas.includes(current)
            ? current
            : result.fechas[0] ?? ''
        );
      })
      .catch((cause) => {
        if (active) {
          setDate('');
          setDates([]);
          setCalendar([]);
          setDatesError(authError(cause));
        }
      })
      .finally(() => {
        if (active) {
          setLoadingDates(false);
        }
      });

    return () => {
      active = false;
    };
  }, [professional, specialty, clinic, patientId, revision]);

  // Obtiene las especialidades sin duplicados.
  const specialties = [
    ...new Map(
      professionals
        .flatMap((p) => p.especialidades)
        .map((s) => [s.id_especialidad, s])
    ).values(),
  ];

  // Filtra los profesionales que atienden la especialidad seleccionada.
  const eligible = professionals.filter((p) =>
    p.especialidades.some(
      (s) => s.id_especialidad === specialty
    )
  );

  return (
    <section className="patient-section">
      <h2 className="h5">
        Elegí tu atención
      </h2>

      <p className="small text-muted">
        Podés reservar los días habilitados de esta semana.
        Cada sábado a las 12:00 se abre la semana siguiente
        (hora argentina). El paciente seleccionado puede tener un turno pendiente
        por especialidad, independientemente de los turnos de otras personas a cargo.
      </p>

      {/* Muestra el estado de carga de la agenda. */}
      {loading && (
        <p role="status">
          Actualizando la agenda de tu salita…
        </p>
      )}

      {/* Muestra los errores y permite reintentar la operación. */}
      {(error || datesError) && (
        <div
          className="alert alert-danger d-flex align-items-center justify-content-between gap-2"
          role="alert"
        >
          <span>{error || datesError}</span>

          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            disabled={busy}
            onClick={() =>
              setRevision((value) => value + 1)
            }
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Informa cuando no existen atenciones habilitadas. */}
      {!loading &&
        !error &&
        !professionals.length && (
          <p>
            No hay atenciones habilitadas en el período
            disponible. Consultá en tu salita.
          </p>
        )}

      {/* Formulario de selección de la atención. */}
      {!error && professionals.length > 0 && (
        <fieldset disabled={busy || loading}>
          {/* Selección de especialidad. */}
          <label className="form-label w-100">
            Especialidad

            <select
              className="form-select mt-1"
              value={specialty}
              onChange={(event) => {
                const nextSpecialty = event.target.value;
                setSpecialty(nextSpecialty);
                const nextEligible = professionals.filter((p) =>
                  p.especialidades.some((s) => s.id_especialidad === nextSpecialty)
                );
                // Si el profesional seleccionado actualmente también atiende esta especialidad, conservarlo
                const stillEligible = nextEligible.some((p) => p.id_profesional === professional);
                if (!stillEligible) {
                  if (nextEligible.length === 1) {
                    setProfessional(nextEligible[0].id_profesional);
                  } else {
                    setProfessional('');
                    setDate('');
                    setDates([]);
                  }
                }
              }}
            >
              <option value="">
                Seleccioná una especialidad
              </option>

              {specialties.map((s) => (
                <option
                  key={s.id_especialidad}
                  value={s.id_especialidad}
                >
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>

          {/* Selección del profesional. */}
          {specialty && (
            <label className="form-label w-100 mt-2">
              Profesional

              <select
                className="form-select mt-1"
                value={professional}
                onChange={(event) => {
                  setProfessional(event.target.value);
                  // No limpiar date si el nuevo profesional también atiende ese día (el efecto ajustará)
                }}
              >
                <option value="">
                  Seleccioná un profesional
                </option>

                {eligible.map((p) => (
                  <option
                    key={p.id_profesional}
                    value={p.id_profesional}
                  >
                    {p.persona.apellidos}{' '}
                    {p.persona.nombres} · Matrícula{' '}
                    {p.matricula}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Selección de una fecha con turnos disponibles. */}
          {professional && (
            <label className="form-label w-100 mt-2">
              Días de atención

              <select
                className="form-select mt-1"
                value={date}
                disabled={
                  loadingDates || !dates.length
                }
                onChange={(event) =>
                  setDate(event.target.value)
                }
              >
                <option value="">
                  {loadingDates
                    ? 'Buscando días con turnos libres…'
                    : 'Seleccioná un día'}
                </option>

                {(calendar.length ? calendar.map(d => d.fecha) : dates).map((day) => (
                  <option
                    value={day}
                    key={day}
                    disabled={!dates.includes(day)}
                  >
                    {dateLabel(day)}{calendar.find(d => d.fecha === day)?.cierre ? ` · ${calendar.find(d => d.fecha === day)!.cierre}${dates.includes(day) ? ' (parcial)' : ' · No disponible'}` : !dates.includes(day) ? ' · No disponible' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          {professional && !loadingDates && !datesError && calendar.some(d => d.cierre) && (
            <div className="alert alert-warning py-2 px-3 small mt-2 mb-0" role="status">
              <i className="bi bi-exclamation-triangle me-1" aria-hidden="true" />
              Algunos días presentan cierres programados que se detallan en el selector.
            </div>
          )}

          {/* Informa cuando no quedan fechas disponibles. */}
          {professional &&
            !loadingDates &&
            !datesError &&
            !dates.length && (
              <p>
                No quedan turnos disponibles para esta
                atención en el período habilitado.
              </p>
            )}
        </fieldset>
      )}

      {/* Muestra los horarios disponibles para la fecha seleccionada. */}
      {!error &&
        !datesError &&
        dates.includes(date) &&
        professional &&
        specialty && (
          <PatientBookingSlots
            key={`${clinic}-${professional}-${specialty}-${date}`}
            date={date}
            professional={professional}
            specialty={specialty}
            clinic={clinic}
            patientId={patientId}
            refreshKey={revision}
            onBusyChange={value => { setBusy(value); onBusyChange?.(value); }}
          />
        )}
    </section>
  );
}
