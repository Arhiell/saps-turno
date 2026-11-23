import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import { getTurnos } from '../../services/turnos.service';
import { getMisHorarios } from '../../services/profesionales.service';
import { getNotificaciones } from '../../services/notificaciones.service';
import type { Turno } from '../../types/turno.types';
import type { MisHorariosData } from '../../services/profesionales.service';
import PatientTurnoDetailModal from '../../components/turnos/PatientTurnoDetailModal';
import { authError } from '../../utils/auth-errors';
import '../../styles/professional-agenda.css';

interface ProfessionalOverviewProps {
  revision?: number;
  onRefresh?: () => void;
}

export default function ProfessionalOverview({
  revision: externalRevision,
  onRefresh: externalOnRefresh,
}: ProfessionalOverviewProps = {}) {
  const { user, person } = useAuth();
  const { ultimoEvento, ultimoEventoProfesional, resyncTick } = useAgendaSocket();

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
    `${ultimoEvento?.id ?? ''}|${ultimoEventoProfesional?.id ?? ''}`
  );
  const lastResyncTickRef = useRef<number>(resyncTick);

  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [horariosData, setHorariosData] = useState<MisHorariosData | null>(null);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);

  const requestIdRef = useRef(0);

  // Fecha del día en zona horaria argentina
  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date());
  }, []);

  const fechaLegible = useMemo(() => {
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  }, []);

  // Actualización automática por WebSockets
  useEffect(() => {
    if (!ultimoEvento && !ultimoEventoProfesional) return;
    const eventKey = `${ultimoEvento?.id ?? ''}|${ultimoEventoProfesional?.id ?? ''}`;
    if (lastEventKeyRef.current === eventKey) return;
    lastEventKeyRef.current = eventKey;
    onRefresh();
  }, [ultimoEvento, ultimoEventoProfesional, onRefresh]);

  useEffect(() => {
    if (resyncTick > 0 && resyncTick !== lastResyncTickRef.current) {
      lastResyncTickRef.current = resyncTick;
      onRefresh();
    }
  }, [resyncTick, onRefresh]);

  // Carga de datos independiente y concurrente con Promise.allSettled
  useEffect(() => {
    const currentRequestId = ++requestIdRef.current;
    if (turnos.length === 0 && !horariosData) {
      setLoading(true);
    }
    setError('');

    void Promise.allSettled([
      getTurnos({
        fecha: todayStr,
        page: 1,
        limit: 100,
      }),
      getMisHorarios(todayStr),
      getNotificaciones(1, false, 1),
    ]).then(([turnosResult, horariosResult, notifsResult]) => {
      if (currentRequestId !== requestIdRef.current) return;

      if (turnosResult.status === 'fulfilled') {
        setTurnos(turnosResult.value.data.turnos || []);
      } else {
        setError(authError(turnosResult.reason));
      }

      if (horariosResult.status === 'fulfilled' && horariosResult.value.success) {
        setHorariosData(horariosResult.value.data);
      }

      if (notifsResult.status === 'fulfilled') {
        setUnreadNotifsCount(notifsResult.value.total ?? 0);
      }

      setLoading(false);
    });
  }, [revision, todayStr]);

  // Métricas del día
  const turnosPendientes = useMemo(
    () => turnos.filter((t) => !t.estado.es_estado_final).length,
    [turnos]
  );
  const turnosAtendidos = useMemo(
    () => turnos.filter((t) => t.estado.codigo === 'ATENDIDO').length,
    [turnos]
  );
  const turnosAusentes = useMemo(
    () => turnos.filter((t) => t.estado.codigo === 'NO_ASISTIO').length,
    [turnos]
  );

  // Próximo turno activo
  const upcomingTurnos = useMemo(() => {
    return turnos
      .filter(
        (t) =>
          !t.estado.es_estado_final &&
          new Date(t.fecha_hora_inicio).getTime() >= Date.now()
      )
      .sort(
        (a, b) =>
          Date.parse(a.fecha_hora_inicio) - Date.parse(b.fecha_hora_inicio)
      );
  }, [turnos]);

  const nextTurno = upcomingTurnos.length > 0 ? upcomingTurnos[0] : null;

  // Saludo profesional natural con nombre de pila
  const firstName = person?.nombres
    ? person.nombres.trim().split(/\s+/)[0]
    : user?.nombre_usuario || 'Profesional';

  const matricula = horariosData?.profesional?.matricula;

  return (
    <div className="professional-dashboard">
      {/* Encabezado: Saludo natural, matrícula profesional legible, fecha y campanita */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
              Módulo Profesional
            </span>
            {matricula && (
              <span className="badge bg-light text-secondary border px-2 py-1 font-monospace">
                Matrícula: {matricula}
              </span>
            )}
          </div>
          <h1 className="h3 fw-bold text-dark mb-0">
            ¡Hola, {firstName}!
          </h1>
          <p className="text-muted small mb-0">
            Resumen operativo y estado de tu agenda de atención médica.
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
              <span>
                {unreadNotifsCount}{' '}
                {unreadNotifsCount === 1 ? 'aviso nuevo' : 'avisos nuevos'}
              </span>
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
          <div>
            <i className="bi bi-exclamation-triangle-fill me-2" aria-hidden="true" />
            {error}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={onRefresh}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Resumen de actividad: 4 KPIs en una fila */}
      <div className="prof-kpi-grid mb-4">
        <div className="prof-kpi-card">
          <div className="prof-kpi-icon pending">
            <i className="bi bi-calendar-check" aria-hidden="true" />
          </div>
          <div className="prof-kpi-info">
            <span className="prof-kpi-label">Turnos del día</span>
            <span className="prof-kpi-val">
              {loading && turnos.length === 0 ? '…' : turnos.length}
            </span>
            <span className="prof-kpi-sub">Total asignados hoy</span>
          </div>
        </div>

        <div className="prof-kpi-card">
          <div className="prof-kpi-icon attended">
            <i className="bi bi-check2-circle" aria-hidden="true" />
          </div>
          <div className="prof-kpi-info">
            <span className="prof-kpi-label">Atendidos</span>
            <span className="prof-kpi-val">
              {loading && turnos.length === 0 ? '…' : turnosAtendidos}
            </span>
            <span className="prof-kpi-sub">Completados hoy</span>
          </div>
        </div>

        <div className="prof-kpi-card">
          <div className="prof-kpi-icon total">
            <i className="bi bi-hourglass-split" aria-hidden="true" />
          </div>
          <div className="prof-kpi-info">
            <span className="prof-kpi-label">Pendientes</span>
            <span className="prof-kpi-val">
              {loading && turnos.length === 0 ? '…' : turnosPendientes}
            </span>
            <span className="prof-kpi-sub">Por atender hoy</span>
          </div>
        </div>

        <div className="prof-kpi-card">
          <div className="prof-kpi-icon absent">
            <i className="bi bi-person-x" aria-hidden="true" />
          </div>
          <div className="prof-kpi-info">
            <span className="prof-kpi-label">Ausentes</span>
            <span className="prof-kpi-val">
              {loading && turnos.length === 0 ? '…' : turnosAusentes}
            </span>
            <span className="prof-kpi-sub">Inasistencias registradas</span>
          </div>
        </div>
      </div>

      {/* Fila principal: Próximo paciente y Estado de agenda a la izquierda, Accesos rápidos a la derecha */}
      <div className="row g-4">
        <div className="col-12 col-lg-7 col-xl-8">
          {/* Tarjeta de Próximo Paciente */}
          <div className="prof-dash-card p-3 p-md-4 mb-4">
            <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
              <span className="prof-next-pill">
                <i className="bi bi-clock-history me-1 text-success" />
                Próximo turno a atender
              </span>
              {nextTurno && (
                <span className="badge bg-light text-secondary border px-2 py-1 small">
                  {nextTurno.estado.nombre}
                </span>
              )}
            </div>

            {loading && turnos.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <div className="spinner-border spinner-border-sm text-success me-2" role="status" />
                Consultando turnos programados…
              </div>
            ) : nextTurno ? (
              <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
                <div className="d-flex align-items-center gap-3">
                  <div className="prof-dash-time">
                    {new Date(nextTurno.fecha_hora_inicio).toLocaleTimeString('es-AR', {
                      timeZone: 'America/Argentina/Buenos_Aires',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div>
                    <h2 className="h5 fw-bold text-dark mb-1">
                      <i className="bi bi-person text-success me-1" />
                      {nextTurno.paciente?.persona?.apellidos} {nextTurno.paciente?.persona?.nombres}
                    </h2>
                    <div className="text-secondary small mb-1">
                      <strong>DNI:</strong> {nextTurno.paciente?.persona?.dni || 'Sin DNI'}
                    </div>
                    <div className="d-flex flex-wrap gap-2 text-muted small">
                      <span>
                        <i className="bi bi-heart-pulse text-success me-1" />
                        {nextTurno.especialidad?.nombre || 'General'}
                      </span>
                      <span>•</span>
                      <span>
                        <i className="bi bi-geo-alt text-primary me-1" />
                        {nextTurno.salita?.nombre}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-success rounded-pill px-4 shadow-sm"
                    onClick={() => setSelectedTurno(nextTurno)}
                  >
                    <i className="bi bi-person-vcard me-1" />
                    Ver ficha
                  </button>
                </div>
              </div>
            ) : (
              <div className="d-flex align-items-center gap-3 py-3 px-3 bg-light rounded-3 text-muted">
                <i className="bi bi-check-circle text-success fs-3 flex-shrink-0" aria-hidden="true" />
                <div className="small">
                  <span className="fw-semibold text-dark d-block">No tenés turnos pendientes para hoy</span>
                  <span>
                    Podés consultar el historial completo o los próximos días desde{' '}
                    <Link to="/mi-agenda" className="text-success text-decoration-none fw-semibold">
                      Mi agenda
                    </Link>.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Tarjeta de Estado de Agenda del Día */}
          <div className="prof-dash-card p-3 p-md-4">
            <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
              <h2 className="h6 fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                <i className="bi bi-calendar2-range text-primary" aria-hidden="true" />
                Estado de la agenda para hoy
              </h2>
              <Link to="/mis-horarios" className="btn btn-sm btn-outline-secondary">
                Ver detalle de horarios
              </Link>
            </div>

            {loading && !horariosData ? (
              <div className="text-center py-4 text-muted">
                <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                Cargando disponibilidad de la agenda…
              </div>
            ) : horariosData ? (
              <div>
                {!horariosData.disponibilidad_fecha.trabaja ? (
                  <div className="p-3 bg-light rounded-3 text-center text-muted">
                    <i className="bi bi-moon-stars fs-4 d-block mb-1 text-secondary" />
                    <span className="fw-medium text-dark">Sin atención programada para hoy</span>
                    <p className="small text-muted mb-0 mt-1">
                      No tenés franjas laborales activas registradas para el día de la fecha.
                    </p>
                  </div>
                ) : horariosData.disponibilidad_fecha.bloqueo_dia_completo.bloqueado ? (
                  <div className="p-3 bg-danger-subtle text-danger rounded-3 d-flex align-items-center gap-3">
                    <i className="bi bi-exclamation-octagon-fill fs-3" />
                    <div>
                      <strong className="d-block">Día bloqueado</strong>
                      <span className="small">
                        Motivo:{' '}
                        {horariosData.disponibilidad_fecha.bloqueo_dia_completo.motivo || 'Licencia / Cierre'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Resumen de slots y franjas */}
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      <span className="badge bg-light text-dark border px-3 py-2">
                        <i className="bi bi-clock me-1 text-primary" />
                        Franjas:{' '}
                        <strong>
                          {horariosData.disponibilidad_fecha.franjas
                            .map((f) => `${f.hora_inicio} - ${f.hora_fin}`)
                            .join(', ')}
                        </strong>
                      </span>
                      <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2">
                        <i className="bi bi-check-circle me-1" />
                        Disponibles:{' '}
                        <strong>{horariosData.disponibilidad_fecha.resumen_slots.disponibles}</strong>
                      </span>
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2">
                        <i className="bi bi-person me-1" />
                        Ocupados:{' '}
                        <strong>{horariosData.disponibilidad_fecha.resumen_slots.ocupados}</strong>
                      </span>
                      {horariosData.disponibilidad_fecha.resumen_slots.bloqueados > 0 && (
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-3 py-2">
                          <i className="bi bi-slash-circle me-1" />
                          Bloqueados:{' '}
                          <strong>{horariosData.disponibilidad_fecha.resumen_slots.bloqueados}</strong>
                        </span>
                      )}
                    </div>

                    {/* Salitas activas */}
                    <div className="small text-muted">
                      <i className="bi bi-hospital me-1 text-secondary" />
                      Salitas de atención hoy:{' '}
                      <span className="text-dark fw-medium">
                        {horariosData.informacion_general.salitas.join(', ') || 'Sin salita asignada'}
                      </span>
                      {' · '}
                      <i className="bi bi-stopwatch me-1 text-secondary" />
                      Duración turno:{' '}
                      <span className="text-dark fw-medium">
                        {horariosData.disponibilidad_fecha.duracion_dia_descripcion || `${horariosData.informacion_general.duracion_turno_minutos} min`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted small mb-0">No se pudo cargar la información de horarios.</p>
            )}
          </div>
        </div>

        {/* Columna derecha: Accesos rápidos unificados */}
        <div className="col-12 col-lg-5 col-xl-4">
          <div className="prof-dash-card p-3 p-md-4">
            <h2 className="h6 fw-bold text-dark mb-3">Accesos rápidos</h2>
            <div className="d-grid gap-2">
              <Link to="/mis-pacientes" className="prof-quick-btn">
                <div className="prof-quick-btn-icon bg-success-subtle text-success">
                  <i className="bi bi-people-fill" />
                </div>
                <div className="flex-grow-1 min-w-0">
                  <div className="d-flex align-items-center gap-2">
                    <span className="fw-semibold text-dark">Pacientes del día</span>
                    {turnos.length > 0 && (
                      <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-0" style={{ fontSize: '0.72rem' }}>
                        {turnos.length}
                      </span>
                    )}
                  </div>
                  <small className="text-muted d-block text-truncate">Atención inmediata de turnos de hoy</small>
                </div>
                <i className="bi bi-chevron-right text-muted small flex-shrink-0 ms-auto" aria-hidden="true" />
              </Link>

              <Link to="/mi-agenda" className="prof-quick-btn">
                <div className="prof-quick-btn-icon bg-primary-subtle text-primary">
                  <i className="bi bi-calendar2-week" />
                </div>
                <div className="flex-grow-1 min-w-0">
                  <div className="fw-semibold text-dark">Mi agenda completa</div>
                  <small className="text-muted d-block text-truncate">Historial y navegación mensual</small>
                </div>
                <i className="bi bi-chevron-right text-muted small flex-shrink-0 ms-auto" aria-hidden="true" />
              </Link>

              <Link to="/mis-horarios" className="prof-quick-btn">
                <div className="prof-quick-btn-icon bg-info-subtle text-info">
                  <i className="bi bi-clock-history" />
                </div>
                <div className="flex-grow-1 min-w-0">
                  <div className="fw-semibold text-dark">Mis horarios y disponibilidad</div>
                  <small className="text-muted d-block text-truncate">Cronograma semanal y cupos</small>
                </div>
                <i className="bi bi-chevron-right text-muted small flex-shrink-0 ms-auto" aria-hidden="true" />
              </Link>

              <Link to="/historia-clinica" className="prof-quick-btn">
                <div className="prof-quick-btn-icon bg-secondary-subtle text-dark">
                  <i className="bi bi-journal-medical" />
                </div>
                <div className="flex-grow-1 min-w-0">
                  <div className="fw-semibold text-dark">Historia clínica</div>
                  <small className="text-muted d-block text-truncate">Buscador y consultas médicas</small>
                </div>
                <i className="bi bi-chevron-right text-muted small flex-shrink-0 ms-auto" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Modal accesible de Ficha del Paciente */}
      <PatientTurnoDetailModal
        turno={selectedTurno}
        onClose={() => setSelectedTurno(null)}
        onStatusChanged={onRefresh}
      />
    </div>
  );
}
