import {
  useEffect,
  useState,
} from 'react';

import {
  Link,
  useParams,
  useLocation,
} from 'react-router-dom';

import {
  getTurnoById,
  getTurnoHistory,
} from '../../services/turnos.service';

import type {
  AppointmentHistory,
  Turno,
} from '../../types/turno.types';

import TurnoCard from '../../components/ui/TurnoCard';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import { formatFechaHora } from '../../utils/agenda-display';

// Utiliza el formato uniforme del paciente
const format = (value: string) => formatFechaHora(value);

// ========================================
// NOMBRES DE ACCIONES DEL HISTORIAL
// ========================================

// Traduce los códigos internos del historial
// a textos comprensibles para el paciente.
const actions: Record<string, string> = {
  CREACION: 'Turno creado',
  CREADO: 'Turno creado',
  REPROGRAMACION: 'Reprogramado',
  REPROGRAMADO: 'Reprogramado',
  CAMBIO_PROFESIONAL: 'Cambio de profesional',
  CANCELACION: 'Cancelado',
  CANCELADO: 'Cancelado',
  CAMBIO_ESTADO: 'Cambio de estado',
  ATENDIDO: 'Atendido',
  NO_ASISTIO: 'No asistió',
  ACTUALIZACION: 'Datos actualizados',
};

export default function PatientAppointmentDetailPage() {
  // Obtiene el identificador del turno desde la URL.
  const {
    id,
  } = useParams();

  // Permite consultar el estado enviado
  // durante la navegación.
  const location = useLocation();

  // ========================================
  // ESTADO DE LA PÁGINA
  // ========================================

  const [
    turno,
    setTurno,
  ] = useState<Turno | null>(
    null
  );

  const [
    history,
    setHistory,
  ] = useState<AppointmentHistory[]>(
    []
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');

  const [
    historyError,
    setHistoryError,
  ] = useState('');

  // Permite volver a cargar el turno
  // y su historial.
  const [
    revision,
    setRevision,
  ] = useState(0);

  // Sincronización automática en segundo plano ante cambios del turno
  const { ultimoEvento, resyncTick } = useAgendaSocket();

  useEffect(() => {
    if (!ultimoEvento || !id) return;
    if (ultimoEvento.id_turno === id) {
      setRevision((v) => v + 1);
    }
  }, [ultimoEvento, id]);

  useEffect(() => {
    if (resyncTick > 0) {
      setRevision((v) => v + 1);
    }
  }, [resyncTick]);

  // ========================================
  // CARGA DEL TURNO
  // ========================================

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');
    setHistoryError('');
    setTurno(null);
    setHistory([]);

    // El detalle necesita un identificador de turno.
    if (!id) {
      setError(
        'No se especificó un turno.'
      );

      setLoading(false);
      return;
    }

    void (async () => {
      try {
        // Obtiene los datos principales del turno.
        const response =
          await getTurnoById(id);

        if (!active) {
          return;
        }

        setTurno(
          response.data.turno
        );

        // El historial se carga de forma independiente.
        try {
          const rows =
            await getTurnoHistory(id);

          if (active) {
            setHistory(
              rows
            );
          }
        } catch {
          if (active) {
            setHistoryError(
              'No se pudo cargar el historial de cambios.'
            );
          }
        }
      } catch {
        if (active) {
          setError(
            'No se pudo cargar el turno o no está disponible para tu cuenta.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    // Evita actualizar el estado después
    // de desmontar el componente.
    return () => {
      active = false;
    };
  }, [
    id,
    revision,
  ]);

  // ========================================
  // INTERFAZ
  // ========================================

  return (
    <section>
      {/* Regreso al listado de turnos. */}
      <Link
        className="btn btn-outline-secondary mb-3 d-inline-flex align-items-center"
        to={turno ? `/mis-turnos?paciente=${turno.id_paciente}` : '/mis-turnos'}
      >
        <i className="bi bi-arrow-left me-2" />
        Volver a mis turnos
      </Link>

      <h1 className="h3 mb-4">
        Detalle del turno
      </h1>
      {turno && (
        <div className="card border-0 shadow-sm mb-4 bg-light p-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <span className="text-muted small d-block">Paciente:</span>
              <strong className="text-dark">
                {turno.paciente?.persona?.apellidos}, {turno.paciente?.persona?.nombres}
              </strong>
              {turno.paciente?.persona?.dni && (
                <span className="text-muted small ms-2">· DNI {turno.paciente.persona.dni}</span>
              )}
            </div>
            {turno.codigo_turno && (
              <div className="text-sm-end">
                <span className="text-muted small d-block">Código de identificación:</span>
                <span className="badge bg-white text-dark border font-monospace px-2 py-1">
                  {turno.codigo_turno}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirma que el turno acaba de crearse. */}
      {location.state?.created && (
        <div
          className="alert alert-success"
          role="status"
        >
          Tu turno fue registrado correctamente.
        </div>
      )}

      {/* Estado de carga. */}
      {loading && (
        <div className="card border-0 shadow-sm p-4 text-center text-muted mb-4" role="status">
          <div>
            <div className="spinner-border spinner-border-sm text-success me-2" aria-hidden="true" />
            <span className="align-middle">Cargando turno…</span>
          </div>
        </div>
      )}

      {/* Error al cargar el turno. */}
      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}{' '}

          <button
            className="btn btn-outline-danger"
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

      {/* =====================================
          DETALLE DEL TURNO
          ===================================== */}

      {!loading && turno && (
        <>
          <TurnoCard
            turno={turno}
            patient
            detail
            onChanged={() =>
              setRevision(
                (v) => v + 1
              )
            }
          />

          {/* Motivo registrado si el turno
              fue cancelado. */}
          {turno.motivo_cancelacion && (
            <p className="alert alert-info mt-3">
              Motivo de cancelación:{' '}
              {turno.motivo_cancelacion}
            </p>
          )}

          {/* =================================
              HISTORIAL DE CAMBIOS
              ================================= */}

          <section className="patient-section mt-4">
            <h2 className="h5 mb-3">
              Historial de cambios
            </h2>

            {historyError ? (
              // Error específico del historial.
              <div
                className="alert alert-danger"
                role="alert"
              >
                {historyError}{' '}

                <button
                  className="btn btn-outline-danger"
                  onClick={() =>
                    setRevision(
                      (v) => v + 1
                    )
                  }
                >
                  Reintentar
                </button>
              </div>
            ) : !history.length ? (
              // Turno sin modificaciones registradas.
              <p>
                No hay cambios registrados para este
                turno.
              </p>
            ) : (
              // Historial cronológico del turno.
              <ol className="patient-history">
                {history.map(
                  (event) => (
                    <li key={event.id_historial}>
                      <strong>
                        {actions[event.accion] ??
                          event.accion.replaceAll(
                            '_',
                            ' '
                          )}
                      </strong>

                      {/* Fecha del evento. */}
                      <div>
                        <time dateTime={event.fecha}>
                          {format(
                            event.fecha
                          )}
                        </time>
                      </div>

                      {/* Estado registrado. */}
                      {event.estado_nombre && (
                        <small className="d-block">
                          Estado:{' '}
                          {event.estado_nombre}
                        </small>
                      )}

                      {/* Horario anterior cuando hubo
                          una reprogramación. */}
                      {event.fecha_hora_anterior && (
                        <small className="d-block">
                          Horario anterior:{' '}
                          {format(
                            event.fecha_hora_anterior
                          )}
                        </small>
                      )}

                      {/* Nuevo horario registrado. */}
                      {event.fecha_hora_nueva && (
                        <small className="d-block">
                          Horario registrado:{' '}
                          {format(
                            event.fecha_hora_nueva
                          )}
                        </small>
                      )}
                    </li>
                  )
                )}
              </ol>
            )}
          </section>
        </>
      )}
    </section>
  );
}
