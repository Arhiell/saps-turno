
import { useEffect, useState } from 'react';

import {
  getAgendaAvailability,
  type AgendaChange,
  type AgendaProposal,
  type AffectedTurno,
} from '../../services/agenda-impacto.service';

import {
  agendaDateTime,
  agendaToday,
} from '../../utils/agenda-display';

import { authError } from '../../utils/auth-errors';
import { useAuth } from '../../context/AuthContext';

// Define las propiedades de la fila de reprogramación.
interface Props {
  turno: AffectedTurno;
  cambio: AgendaChange;
  propuesta?: AgendaProposal;
  busy: boolean;
  revision: number;
  onChoose: (proposal: AgendaProposal) => void;
}

// Permite seleccionar una nueva fecha y horario para un turno afectado.
export default function AgendaQuickRow({
  turno,
  cambio,
  propuesta,
  busy,
  revision,
  onChoose,
}: Props) {
  const { user } = useAuth();

  // Almacena la fecha seleccionada y los horarios disponibles.
  const [fecha, setFecha] = useState('');
  const [options, setOptions] = useState<
    NonNullable<AgendaProposal['destino']>[]
  >([]);

  // Controla la carga, los errores y los reintentos.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  // Conserva la versión del turno utilizada en la propuesta.
  const [version, setVersion] = useState(turno.version);

  // Permite reprogramar únicamente turnos futuros no finalizados.
  const editable =
    !turno.estado.es_estado_final &&
    Date.parse(turno.fecha_hora_inicio) > Date.now();

  // Consulta la disponibilidad al cambiar la fecha o los datos del turno.
  useEffect(() => {
    let active = true;

    setOptions([]);
    setError('');

    // Evita consultar si no existe una fecha o el turno no es editable.
    if (!fecha || !editable) {
      setLoading(false);
      return;
    }

    setLoading(true);

    void getAgendaAvailability(
      cambio,
      turno.id_turno,
      fecha
    )
      .then((data) => {
        if (!active) {
          return;
        }

        // Detecta cambios concurrentes en la versión del turno.
        if (data.version !== turno.version) {
          setError(
            'El turno cambió. Usá Actualizar afectados antes de elegir un nuevo horario.'
          );

          return;
        }

        // Actualiza los horarios disponibles y la versión del turno.
        setOptions(data.opciones);
        setVersion(data.version);
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

    // Evita actualizar el estado después de desmontar el componente.
    return () => {
      active = false;
    };
  }, [
    fecha,
    cambio,
    turno.id_turno,
    turno.version,
    editable,
    revision,
    retry,
  ]);

  return (
    <article className="border rounded p-3 h-100 text-break">
      {/* Identificación del paciente. */}
      <strong>
        {turno.paciente.persona.apellidos},{' '}
        {turno.paciente.persona.nombres}
      </strong>

      {/* Información del profesional, especialidad y salita. */}
      <div className="small text-muted">
        {turno.profesional.persona.apellidos},{' '}
        {turno.profesional.persona.nombres}
        {' · '}
        {turno.especialidad.nombre}
        {' · '}
        {turno.salita.nombre}
      </div>

      {/* Fecha, horario y estado actual del turno. */}
      <div className="mt-2">
        Horario actual:{' '}
        {agendaDateTime(turno.fecha_hora_inicio)}
        {' · '}
        {turno.estado.nombre}
      </div>

      {/* Indica si el turno tiene una propuesta de reprogramación. */}
      <span
        className={`badge my-2 ${
          propuesta?.destino
            ? 'text-bg-success'
            : 'text-bg-warning'
        }`}
      >
        {propuesta?.destino
          ? 'Listo para revisar'
          : 'Pendiente de reprogramación'}
      </span>

      {/* Muestra las opciones únicamente para turnos editables. */}
      {!editable ? (
        <p className="small">
          El turno ya comenzó o tiene un estado final.
          Administración debe revisar su situación antes
          de guardar el cambio de agenda.
        </p>
      ) : (
        <>
          {/* Permite seleccionar una nueva fecha. */}
          <label className="form-label w-100">
            Nueva fecha

            <input
              type="date"
              className="form-control"
              value={fecha}
              min={agendaToday()}
              disabled={busy}
              onChange={(e) => {
                setFecha(e.target.value);

                // Limpia la propuesta anterior al cambiar la fecha.
                onChoose({
                  id_turno: turno.id_turno,
                  version: turno.version,
                  destino: null,
                });
              }}
            />
          </label>

          {/* Muestra los horarios disponibles para la fecha seleccionada. */}
          <label className="form-label w-100">
            Nuevo horario

            <select
              className="form-select"
              disabled={
                busy ||
                loading ||
                !options.length
              }
              value={
                options.some(
                  (o) =>
                    o.fecha_hora_inicio ===
                    propuesta?.destino?.fecha_hora_inicio
                )
                  ? propuesta?.destino?.fecha_hora_inicio ?? ''
                  : ''
              }
              onChange={(e) =>
                onChoose({
                  id_turno: turno.id_turno,
                  version,
                  destino:
                    options.find(
                      (o) =>
                        o.fecha_hora_inicio === e.target.value
                    ) ?? null,
                })
              }
            >
              <option value="">
                {loading
                  ? 'Cargando disponibilidad…'
                  : 'Seleccionar horario disponible'}
              </option>

              {options.map((o) => (
                <option
                  key={o.fecha_hora_inicio}
                  value={o.fecha_hora_inicio}
                >
                  {agendaDateTime(o.fecha_hora_inicio)}
                </option>
              ))}
            </select>
          </label>

          {/* Informa cuando no existen horarios compatibles. */}
          {fecha &&
            !loading &&
            !error &&
            !options.length && (
              <p
                className="small"
                role="status"
              >
                Sin disponibilidad compatible. Elegí otra fecha.
                Se ofrecen horarios posteriores al turno original.
              </p>
            )}

          {/* Muestra los errores y permite reintentar la consulta. */}
          {error && (
            <div
              className="text-danger small"
              role="alert"
            >
              {error}{' '}

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={busy}
                onClick={() =>
                  setRetry((v) => v + 1)
                }
              >
                Reintentar
              </button>
            </div>
          )}
        </>
      )}

      {/* Muestra el nuevo horario y permite dejar el turno pendiente. */}
      {propuesta?.destino && (
        <div className="text-success">
          Nuevo:{' '}
          {agendaDateTime(
            propuesta.destino.fecha_hora_inicio
          )}

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary ms-2"
            disabled={busy}
            onClick={() =>
              onChoose({
                ...propuesta,
                destino: null,
              })
            }
          >
            Dejar pendiente
          </button>
        </div>
      )}

      {/* Permite consultar el detalle del turno según el rol. */}
      {user?.rol !== 'RECEPCION' && (
        <a
          className="small d-inline-block mt-2"
          href={`/turnos/${turno.id_turno}`}
          target="_blank"
          rel="noreferrer"
        >
          Ver detalle (otra pestaña)
        </a>
      )}
    </article>
  );
}
