import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import { getTurnos } from '../../services/turnos.service';
import { getNotificaciones } from '../../services/notificaciones.service';
import CancelAppointment from '../../components/ui/CancelAppointment';
import { getEstadoClass } from '../../utils/turno-status';
import { formatFechaHora } from '../../utils/agenda-display';
import type { Turno } from '../../types/turno.types';
import { authError } from '../../utils/auth-errors';

interface PatientOverviewProps {
  revision?: number;
  onRefresh?: () => void;
}

export default function PatientOverview({
  revision: externalRevision,
  onRefresh: externalOnRefresh,
}: PatientOverviewProps = {}) {
  const { user, patient: profile } = useAuth();
  const { ultimoEvento, ultimoEventoPaciente, resyncTick } = useAgendaSocket();

  const [internalRevision, setInternalRevision] = useState(0);
  const revision = externalRevision ?? internalRevision;
  const onRefresh = useCallback(() => {
    if (externalOnRefresh) {
      externalOnRefresh();
    } else {
      setInternalRevision((v) => v + 1);
    }
  }, [externalOnRefresh]);

  const lastEventKeyRef = useRef<string>(
    `${ultimoEvento?.id ?? ''}|${ultimoEventoPaciente?.id ?? ''}`
  );
  const lastResyncTickRef = useRef<number>(resyncTick);

  const [nextTurno, setNextTurno] = useState<Turno | null>(null);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fecha legible en formato argentino
  const fechaLegible = useMemo(() => {
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  }, []);

  // Actualización automática por WebSockets en segundo plano
  useEffect(() => {
    if (!ultimoEvento && !ultimoEventoPaciente) return;
    const eventKey = `${ultimoEvento?.id ?? ''}|${ultimoEventoPaciente?.id ?? ''}`;
    if (lastEventKeyRef.current === eventKey) return;
    lastEventKeyRef.current = eventKey;
    onRefresh();
  }, [ultimoEvento, ultimoEventoPaciente, onRefresh]);

  useEffect(() => {
    if (resyncTick > 0 && resyncTick !== lastResyncTickRef.current) {
      lastResyncTickRef.current = resyncTick;
      onRefresh();
    }
  }, [resyncTick, onRefresh]);

  // Carga únicamente el próximo turno activo y cantidad de notificaciones sin leer
  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');

    Promise.allSettled([
      getTurnos({
        periodo: 'proximos',
        orden: 'asc',
        page: 1,
        limit: 1,
        ...(profile?.id_paciente ? { id_paciente: profile.id_paciente } : {}),
      }),
      getNotificaciones(1, false, 1),
    ])
      .then(([turnosResult, notifsResult]) => {
        if (!active) return;

        if (turnosResult.status === 'fulfilled') {
          const list = turnosResult.value.data.turnos || [];
          const activeTurno = list.find((t) => !t.estado.es_estado_final) || null;
          setNextTurno(activeTurno);
        } else {
          setError(authError(turnosResult.reason));
        }

        if (notifsResult.status === 'fulfilled') {
          setUnreadNotifsCount(notifsResult.value.total ?? 0);
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
  }, [revision, profile?.id_paciente]);

  return (
    <div className="patient-dashboard">
      {/* Encabezado limpio de bienvenida con fecha e insignias */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1">
            ¡Hola, {profile?.nombres || user?.nombre_usuario}!
          </h1>
          <p className="text-muted mb-0">
            Portal de atención y turnos en salud municipal.
          </p>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          {unreadNotifsCount > 0 && (
            <Link
              to="/mis-notificaciones"
              className="badge text-bg-primary text-decoration-none px-3 py-2 rounded-pill shadow-sm d-inline-flex align-items-center gap-1"
              title="Ver notificaciones sin leer"
            >
              <i className="bi bi-bell-fill" aria-hidden="true" />
              <span>{unreadNotifsCount} {unreadNotifsCount === 1 ? 'notificación nueva' : 'notificaciones nuevas'}</span>
            </Link>
          )}

          <span className="text-capitalize text-muted small d-inline-flex align-items-center gap-1 bg-white border px-3 py-1 rounded-pill shadow-sm">
            <i className="bi bi-calendar3 text-success" aria-hidden="true" />
            {fechaLegible}
          </span>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between gap-2 mb-4" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRefresh}>
            Reintentar
          </button>
        </div>
      )}

      {/* Próximo turno (prioridad principal con altura reservada para CLS 0) */}
      <div className="card border-0 shadow-sm mb-4 overflow-hidden">
        <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between gap-2">
          <h2 className="h6 fw-bold mb-0 d-flex align-items-center gap-2 text-dark">
            <i className="bi bi-calendar-event text-success" aria-hidden="true" />
            <span>Próximo turno</span>
          </h2>
          <Link to="/mis-turnos" className="btn btn-sm btn-outline-success">
            Ver todos mis turnos
          </Link>
        </div>

        <div className="card-body p-3 p-md-4" style={{ minHeight: '215px' }}>
          {loading ? (
            <div
              className="d-flex flex-column align-items-center justify-content-center text-center text-muted py-4"
              style={{ minHeight: '180px' }}
              role="status"
              aria-label="Consultando tus turnos"
            >
              <div
                className="spinner-border text-success mb-3"
                style={{ width: '2rem', height: '2rem' }}
                aria-hidden="true"
              />
              <span className="fw-medium text-dark">Consultando tus turnos…</span>
              <span className="small text-muted mt-1">Verificando agenda y citas programadas</span>
            </div>
          ) : nextTurno ? (
            <div className="p-3 p-md-4 rounded-3 bg-light border" style={{ minHeight: '180px' }}>
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                <span className="badge bg-success text-white px-3 py-2 fs-6 fw-semibold text-nowrap">
                  <i className="bi bi-clock me-1" aria-hidden="true" />
                  {formatFechaHora(nextTurno.fecha_hora_inicio)} hs
                </span>
                <span className={getEstadoClass(nextTurno.estado.codigo)}>
                  {nextTurno.estado.nombre}
                </span>
              </div>

              <div className="row g-3 align-items-center">
                <div className="col-12 col-md-8">
                  <h3 className="h5 fw-bold text-dark mb-1">
                    {nextTurno.especialidad?.nombre || 'Consulta General'}
                  </h3>
                  <p className="text-secondary mb-1">
                    <strong>Profesional:</strong>{' '}
                    {nextTurno.profesional?.persona
                      ? `${nextTurno.profesional.persona.apellidos}, ${nextTurno.profesional.persona.nombres}`
                      : 'Profesional asignado'}
                  </p>
                  <p className="text-muted small mb-0">
                    <i className="bi bi-hospital me-1" aria-hidden="true" />
                    <strong>Salita:</strong> {nextTurno.salita?.nombre || 'Salita asignada'}
                    {nextTurno.salita?.direccion ? ` · ${nextTurno.salita.direccion}` : ''}
                  </p>
                </div>

                <div className="col-12 col-md-4 d-flex flex-column flex-sm-row flex-md-column gap-2 justify-content-end">
                  <Link
                    to={`/mis-turnos/${nextTurno.id_turno}`}
                    className="btn btn-outline-success btn-sm d-inline-flex align-items-center justify-content-center gap-1 text-nowrap"
                    style={{ minHeight: '38px' }}
                  >
                    <i className="bi bi-eye" aria-hidden="true" />
                    <span>Ver detalle</span>
                  </Link>
                  <CancelAppointment
                    turno={nextTurno}
                    onCancelled={onRefresh}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              className="text-center py-4 d-flex flex-column align-items-center justify-content-center"
              style={{ minHeight: '180px' }}
            >
              <div
                className="rounded-circle bg-success-subtle text-success d-inline-flex align-items-center justify-content-center mb-3"
                style={{ width: '56px', height: '56px', fontSize: '1.75rem' }}
              >
                <i className="bi bi-calendar-check" aria-hidden="true" />
              </div>
              <h3 className="h6 fw-bold text-dark mb-1">No tenés turnos pendientes</h3>
              <p className="text-muted small mb-3">
                Podés solicitar una cita médica con un profesional de la salud de tu salita.
              </p>
              <Link to="/solicitar-turno" className="btn btn-saps d-inline-flex align-items-center gap-1 text-nowrap">
                <i className="bi bi-calendar-plus" aria-hidden="true" />
                <span>Solicitar un turno</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Accesos rápidos esenciales con dimensiones estables */}
      <h2 className="h6 fw-bold text-dark mb-3">Acciones principales</h2>
      <div className="row g-3">
        <div className="col-12 col-sm-6 col-lg-3">
          <Link
            to="/solicitar-turno"
            className="card border-0 shadow-sm text-decoration-none h-100 hover-card"
            style={{ minHeight: '82px' }}
          >
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div
                className="rounded-3 bg-success-subtle text-success fs-4 d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: '52px', height: '52px', minWidth: '52px' }}
              >
                <i className="bi bi-calendar-plus" aria-hidden="true" />
              </div>
              <div className="overflow-hidden">
                <strong className="d-block text-dark text-truncate">Solicitar turno</strong>
                <span className="text-muted small">Nueva cita médica</span>
              </div>
            </div>
          </Link>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <Link
            to="/mis-turnos"
            className="card border-0 shadow-sm text-decoration-none h-100 hover-card"
            style={{ minHeight: '82px' }}
          >
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div
                className="rounded-3 bg-primary-subtle text-primary fs-4 d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: '52px', height: '52px', minWidth: '52px' }}
              >
                <i className="bi bi-calendar-check" aria-hidden="true" />
              </div>
              <div className="overflow-hidden">
                <strong className="d-block text-dark text-truncate">Mis turnos</strong>
                <span className="text-muted small">Próximos e historial</span>
              </div>
            </div>
          </Link>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <Link
            to="/personas-a-cargo"
            className="card border-0 shadow-sm text-decoration-none h-100 hover-card"
            style={{ minHeight: '82px' }}
          >
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div
                className="rounded-3 bg-info-subtle text-info-emphasis fs-4 d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: '52px', height: '52px', minWidth: '52px' }}
              >
                <i className="bi bi-people" aria-hidden="true" />
              </div>
              <div className="overflow-hidden">
                <strong className="d-block text-dark text-truncate">Personas a cargo</strong>
                <span className="text-muted small">Familiares y menores</span>
              </div>
            </div>
          </Link>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <Link
            to="/mi-historia"
            className="card border-0 shadow-sm text-decoration-none h-100 hover-card"
            style={{ minHeight: '82px' }}
          >
            <div className="card-body p-3 d-flex align-items-center gap-3">
              <div
                className="rounded-3 bg-secondary-subtle text-secondary fs-4 d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: '52px', height: '52px', minWidth: '52px' }}
              >
                <i className="bi bi-journal-medical" aria-hidden="true" />
              </div>
              <div className="overflow-hidden">
                <strong className="d-block text-dark text-truncate">Historia clínica</strong>
                <span className="text-muted small">Atenciones y recetas</span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
