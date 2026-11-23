import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAdminSalitas } from '../../services/salitas.service';
import { getTurnos } from '../../services/turnos.service';
import { getProfessionals } from '../../services/profesionales.service';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import ConnectionStatusBadge from '../../components/ui/ConnectionStatusBadge';
import { useAutoDismiss } from '../../utils/useAutoDismiss';
import { getEstadoClass } from '../../utils/turno-status';
import type { Salita } from '../../types/salita.types';
import type { Turno } from '../../types/turno.types';
import type { Professional } from '../../types/profesional.types';
import { authError } from '../../utils/auth-errors';

interface AdminSalitaOverviewProps {
  revision: number;
  onRefresh?: () => void;
}

export default function AdminSalitaOverview({
  revision,
}: AdminSalitaOverviewProps) {
  const navigate = useNavigate();
  const { ultimoEvento, resyncTick } = useAgendaSocket();

  const [salitas, setSalitas] = useState<Salita[]>([]);
  const [selectedSalitaId, setSelectedSalitaId] = useState<string>('');
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useAutoDismiss(error, () => setError(''), 15_000, Boolean(error));

  // Fecha actual en Argentina (YYYY-MM-DD)
  const todayDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date());
  }, []);

  const formatFechaLegible = useMemo(() => {
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  }, []);

  // Carga inicial de salitas y profesionales
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    Promise.all([getAdminSalitas(), getProfessionals()])
      .then(([salitasRes, profRes]) => {
        if (!active) return;
        const activeSalitas = salitasRes.data.filter((s) => s.activo);
        setSalitas(activeSalitas);
        setProfessionals(profRes.data);
        if (activeSalitas.length > 0 && !selectedSalitaId) {
          setSelectedSalitaId(activeSalitas[0].id_salita);
        }
      })
      .catch((err) => {
        if (active) setError(authError(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [revision]);

  // Actualización granular reactiva ante cambios por WebSocket
  useEffect(() => {
    if (!ultimoEvento) return;
    if (ultimoEvento.id_turno && ultimoEvento.estado) {
      setTurnos((prev) =>
        prev.map((t) =>
          t.id_turno === ultimoEvento.id_turno
            ? {
                ...t,
                estado: {
                  ...t.estado,
                  codigo: ultimoEvento.estado!,
                  nombre: ultimoEvento.estado!,
                },
              }
            : t
        )
      );
    }
  }, [ultimoEvento]);

  // Carga turnos de la salita seleccionada para hoy de forma continua y silenciosa
  useEffect(() => {
    if (!selectedSalitaId) return;
    let active = true;

    getTurnos({
      fecha: todayDate,
      id_salita: selectedSalitaId,
      page: 1,
      limit: 100,
    })
      .then((res) => {
        if (active) setTurnos(res.data.turnos);
      })
      .catch((err) => {
        if (active) setError(authError(err));
      });

    return () => {
      active = false;
    };
  }, [selectedSalitaId, todayDate, revision, resyncTick, ultimoEvento]);

  const currentSalita = salitas.find((s) => s.id_salita === selectedSalitaId) || salitas[0];

  // Cálculo de indicadores operativos de la salita
  const totalHoy = turnos.length;
  const enEspera = turnos.filter((t) => t.estado.codigo === 'EN_ESPERA').length;
  const atendidos = turnos.filter((t) => t.estado.codigo === 'ATENDIDO').length;
  const inasistencias = turnos.filter((t) => t.estado.codigo === 'NO_ASISTIO').length;
  const cancelados = turnos.filter((t) => t.estado.codigo === 'CANCELADO').length;
  const pendientes = turnos.filter(
    (t) => !t.estado.es_estado_final && t.estado.codigo !== 'EN_ESPERA'
  ).length;

  const adminShortcuts = [
    {
      to: '/turnos',
      title: 'Gestión de Turnos',
      desc: 'Agenda del día, filtros avanzados y control de asistencia.',
      icon: 'bi-calendar-check',
      badge: `${totalHoy} turnos hoy`,
      color: 'success',
    },
    {
      to: '/pacientes',
      title: 'Gestión de Pacientes',
      desc: 'Padrón de la salita, altas, datos personales y tutores.',
      icon: 'bi-people',
      color: 'primary',
    },
    {
      to: '/profesionales',
      title: 'Profesionales',
      desc: 'Equipo médico y especialidades asignadas a la sala.',
      icon: 'bi-person-badge',
      badge: `${professionals.filter((p) => p.activo).length} activos`,
      color: 'info',
    },
    {
      to: '/configuracion/horarios',
      title: 'Horarios de Atención',
      desc: 'Configuración de franjas horarias y duración de turnos.',
      icon: 'bi-clock-history',
      color: 'warning',
    },
    {
      to: '/configuracion/bloqueos',
      title: 'Ausencias y Reprogramación',
      desc: 'Bloqueos por licencias y reorganización ágil de turnos.',
      icon: 'bi-calendar-x',
      color: 'danger',
    },
    {
      to: '/reportes',
      title: 'Reportes e Indicadores',
      desc: 'Métricas de atención, inasistencias y volumen por especialidad.',
      icon: 'bi-bar-chart-line',
      color: 'secondary',
    },
  ];

  return (
    <div className="admin-salita-dashboard">
      {/* Encabezado de la salita */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-3 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
              <i className="bi bi-hospital me-1" aria-hidden="true" />
              Administración de Salita
            </span>
            {currentSalita && (
              <span className="fw-bold text-dark fs-5">
                {currentSalita.nombre}
              </span>
            )}
          </div>
          <p className="text-muted small text-capitalize mb-0">
            {formatFechaLegible}
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          {salitas.length > 1 && (
            <select
              className="form-select form-select-sm"
              value={selectedSalitaId}
              onChange={(e) => setSelectedSalitaId(e.target.value)}
              aria-label="Seleccionar salita"
            >
              {salitas.map((s) => (
                <option key={s.id_salita} value={s.id_salita}>
                  {s.nombre}
                </option>
              ))}
            </select>
          )}

          <ConnectionStatusBadge />
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between mb-4" role="alert">
          <div>{error}</div>
          <button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setError('')} />
        </div>
      )}

      {/* Indicadores Operativos Clave (4 KPIs en una fila con línea semántica de 4px) */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="dashboard-stat-card dashboard-stat-card--blue h-100">
            <div className="dashboard-stat-top">
              <div className="dashboard-stat-icon dashboard-stat-icon--blue">
                <i className="bi bi-calendar-event" aria-hidden="true" />
              </div>
              <span className="dashboard-stat-label">Turnos del día</span>
            </div>
            <div className="dashboard-stat-value">
              {loading ? '…' : totalHoy}
            </div>
            <small>
              {pendientes} por atender · {atendidos} atendidos
            </small>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="dashboard-stat-card dashboard-stat-card--amber h-100">
            <div className="dashboard-stat-top">
              <div className="dashboard-stat-icon dashboard-stat-icon--amber">
                <i className="bi bi-hourglass-split" aria-hidden="true" />
              </div>
              <span className="dashboard-stat-label">En sala de espera</span>
            </div>
            <div className="dashboard-stat-value">
              {loading ? '…' : enEspera}
            </div>
            <small>
              Pacientes con llegada registrada
            </small>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="dashboard-stat-card dashboard-stat-card--green h-100">
            <div className="dashboard-stat-top">
              <div className="dashboard-stat-icon dashboard-stat-icon--green">
                <i className="bi bi-check2-circle" aria-hidden="true" />
              </div>
              <span className="dashboard-stat-label">Atendidos hoy</span>
            </div>
            <div className="dashboard-stat-value">
              {loading ? '…' : atendidos}
            </div>
            <small>
              Consultas médicas finalizadas
            </small>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="dashboard-stat-card dashboard-stat-card--coral h-100">
            <div className="dashboard-stat-top">
              <div className="dashboard-stat-icon dashboard-stat-icon--coral">
                <i className="bi bi-calendar-x" aria-hidden="true" />
              </div>
              <span className="dashboard-stat-label">No asistió / Cancelados</span>
            </div>
            <div className="dashboard-stat-value">
              {loading ? '…' : inasistencias + cancelados}
            </div>
            <small>
              {inasistencias} inasistencias · {cancelados} cancelados
            </small>
          </div>
        </div>
      </div>

      {/* Accesos rápidos de administración (Grilla 2x3 con identidad institucional unificada) */}
      <h2 className="h6 fw-bold text-dark text-uppercase letter-spacing-1 mb-3">
        <i className="bi bi-grid-fill me-2 text-success" aria-hidden="true" />
        Gestión operativa y administrativa
      </h2>

      <div className="row g-3 mb-4">
        {adminShortcuts.map((item) => (
          <div className="col-12 col-md-6 col-xl-4" key={item.to}>
            <Link
              to={item.to}
              className="card border h-100 text-decoration-none text-dark p-3 transition shadow-xs hover-shadow-sm rounded-3"
              style={{ borderColor: 'var(--dashboard-card-border, #e2e8f0)' }}
            >
              <div className="d-flex align-items-start justify-content-between mb-2">
                <div
                  className="d-inline-flex p-2 rounded-3 bg-success-subtle text-success"
                  style={{ fontSize: '1.25rem' }}
                >
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                </div>
                {item.badge && (
                  <span className="badge bg-light text-muted border px-2 py-1 small fw-normal">
                    {item.badge}
                  </span>
                )}
              </div>
              <h3 className="h6 fw-bold mb-1 text-dark">{item.title}</h3>
              <p className="text-muted small mb-0">{item.desc}</p>
            </Link>
          </div>
        ))}
      </div>

      {/* Agenda del día en la salita */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
        <div className="card-header bg-white py-3 d-flex flex-wrap align-items-center justify-content-between gap-2 border-bottom">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-calendar2-day text-success fs-5" aria-hidden="true" />
            <h3 className="h6 fw-bold mb-0 text-dark">
              Turnos de hoy en {currentSalita?.nombre || 'la salita'}
            </h3>
          </div>
          <Link to="/turnos" className="btn btn-sm btn-outline-success">
            Ver agenda completa
            <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
          </Link>
        </div>

        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-4 text-muted">
              <div className="spinner-border spinner-border-sm text-success me-2" role="status" />
              Cargando turnos de hoy…
            </div>
          ) : turnos.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-calendar-check fs-2 text-success d-block mb-2" />
              <p className="fw-semibold mb-1 text-dark">No hay turnos programados para hoy</p>
              <p className="small mb-0">Podés asignar nuevos turnos desde la agenda o recibir pacientes.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small text-muted text-uppercase">
                  <tr>
                    <th scope="col">Horario</th>
                    <th scope="col">Paciente</th>
                    <th scope="col">Profesional</th>
                    <th scope="col">Especialidad</th>
                    <th scope="col">Estado</th>
                    <th scope="col" className="text-end">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {turnos.slice(0, 10).map((t) => (
                    <tr key={t.id_turno}>
                      <td className="fw-semibold">
                        {new Date(t.fecha_hora_inicio).toLocaleTimeString('es-AR', {
                          timeZone: 'America/Argentina/Buenos_Aires',
                          hour: '2-digit',
                          minute: '2-digit',
                        })} hs
                      </td>
                      <td>
                        <div className="fw-bold">
                          {t.paciente?.persona?.apellidos}, {t.paciente?.persona?.nombres}
                        </div>
                        <small className="text-muted">
                          DNI {t.paciente?.persona?.dni || 'Sin DNI'}
                        </small>
                      </td>
                      <td>
                        {t.profesional?.persona?.apellidos}, {t.profesional?.persona?.nombres}
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">
                          {t.especialidad?.nombre || 'General'}
                        </span>
                      </td>
                      <td>
                        <span className={getEstadoClass(t.estado.codigo)}>
                          {t.estado.nombre}
                        </span>
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => navigate(`/turnos/${t.id_turno}`)}
                          title="Ver detalle del turno"
                        >
                          <i className="bi bi-eye" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {turnos.length > 10 && (
                <div className="p-3 text-center border-top bg-light">
                  <small className="text-muted me-2">
                    Mostrando 10 de {turnos.length} turnos de hoy.
                  </small>
                  <Link to="/turnos" className="fw-semibold text-success small text-decoration-none">
                    Ver todos los turnos del día →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
