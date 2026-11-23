import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardSummary, type DashboardSummary } from '../../services/dashboard.service';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import ConnectionStatusBadge from '../../components/ui/ConnectionStatusBadge';
import { authError } from '../../utils/auth-errors';

const timeZone = 'America/Argentina/Buenos_Aires';
const formatDateTime = (value: string) => new Date(value).toLocaleString('es-AR', { timeZone });
const actions: Record<string, string> = { INSERT: 'Alta', UPDATE: 'Modificación', DELETE: 'Baja' };
const actionBadges: Record<string, string> = {
  INSERT: 'bg-success-subtle text-success border border-success-subtle',
  UPDATE: 'bg-primary-subtle text-primary border border-primary-subtle',
  DELETE: 'bg-danger-subtle text-danger border border-danger-subtle',
};
const entities: Record<string, string> = {
  personas: 'personas',
  usuarios: 'cuentas',
  salitas: 'salitas',
  pacientes: 'pacientes',
  profesionales: 'profesionales',
  turnos: 'turnos',
  horarios_atencion: 'horarios',
  bloqueos_agenda: 'bloqueos de agenda',
  sanciones: 'sanciones',
  tutores: 'tutores',
  paciente_tutores: 'vínculos de tutores',
};

export default function SuperAdminOverview({
  revision,
}: {
  revision: number;
  onRefresh?: () => void;
}) {
  const {
    ultimoEvento,
    ultimoEventoSalita,
    ultimoEventoPaciente,
    ultimoEventoProfesional,
    ultimoEventoTerritorial,
    resyncTick,
  } = useAgendaSocket();

  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const requestId = useRef(0);
  const initialLoadedRef = useRef(false);

  const fetchSummary = async (isBackground = false) => {
    const currentRequest = ++requestId.current;

    try {
      if (!isBackground && !data) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError('');

      const result = await getDashboardSummary();

      if (currentRequest !== requestId.current) return;

      setData(result);
      initialLoadedRef.current = true;
    } catch (cause) {
      if (currentRequest !== requestId.current) return;
      setError(authError(cause));
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    void fetchSummary();
  }, [revision]);

  // Actualización reactiva automática en tiempo real ante cualquier evento institucional
  useEffect(() => {
    if (!initialLoadedRef.current) return;
    void fetchSummary(true);
  }, [
    ultimoEvento,
    ultimoEventoSalita,
    ultimoEventoPaciente,
    ultimoEventoProfesional,
    ultimoEventoTerritorial,
  ]);

  // Resincronización al reconectar el canal WebSocket
  useEffect(() => {
    if (resyncTick > 0 && initialLoadedRef.current) {
      void fetchSummary(true);
    }
  }, [resyncTick]);

  const available = !loading && !error && data;

  const totals = [
    {
      label: 'Salitas municipales',
      value: data?.salitas,
      icon: 'bi-hospital',
      cardModifier: 'dashboard-stat-card--green',
      iconModifier: 'dashboard-stat-icon--green',
    },
    {
      label: 'Administradores de salita',
      value: data?.administradores,
      icon: 'bi-person-gear',
      cardModifier: 'dashboard-stat-card--blue',
      iconModifier: 'dashboard-stat-icon--blue',
    },
    {
      label: 'Superadministradores',
      value: data?.superadministradores,
      icon: 'bi-shield-check',
      cardModifier: 'dashboard-stat-card--slate',
      iconModifier: 'dashboard-stat-icon--slate',
    },
    {
      label: 'Profesionales de salud',
      value: data?.profesionales,
      icon: 'bi-person-badge',
      cardModifier: 'dashboard-stat-card--green',
      iconModifier: 'dashboard-stat-icon--green',
    },
    {
      label: 'Pacientes registrados',
      value: data?.pacientes,
      icon: 'bi-people',
      cardModifier: 'dashboard-stat-card--blue',
      iconModifier: 'dashboard-stat-icon--blue',
    },
  ];

  const states = data?.turnos.por_estado;

  const daily = [
    {
      label: 'Turnos registrados hoy',
      value: data?.turnos.registrados_hoy,
      description: 'Nuevas reservas creadas en el día',
      icon: 'bi-calendar-plus',
      cardModifier: 'dashboard-stat-card--blue',
      iconModifier: 'dashboard-stat-icon--blue',
    },
    {
      label: 'Programados para hoy',
      value: data?.turnos.programados_hoy,
      description: 'Citas con atención fijada para hoy',
      icon: 'bi-calendar-check',
      cardModifier: 'dashboard-stat-card--blue',
      iconModifier: 'dashboard-stat-icon--blue',
    },
    {
      label: 'Pendientes de atención',
      value: data?.turnos.pendientes,
      description: available
        ? `${states?.SOLICITADO ?? 0} solicitados · ${states?.CONFIRMADO ?? 0} confirmados · ${states?.EN_ESPERA ?? 0} en espera`
        : '',
      icon: 'bi-hourglass-split',
      cardModifier: 'dashboard-stat-card--amber',
      iconModifier: 'dashboard-stat-icon--amber',
    },
    {
      label: 'Atendidos hoy',
      value: states?.ATENDIDO,
      description: 'Consultas médicas completadas',
      icon: 'bi-check2-circle',
      cardModifier: 'dashboard-stat-card--green',
      iconModifier: 'dashboard-stat-icon--green',
    },
    {
      label: 'Cancelados',
      value: states?.CANCELADO,
      description: 'Citas canceladas del día',
      icon: 'bi-calendar-x',
      cardModifier: 'dashboard-stat-card--coral',
      iconModifier: 'dashboard-stat-icon--coral',
    },
    {
      label: 'Inasistencias registradas',
      value: states?.NO_ASISTIO,
      description: 'Turnos donde el paciente no asistió',
      icon: 'bi-person-x',
      cardModifier: 'dashboard-stat-card--coral',
      iconModifier: 'dashboard-stat-icon--coral',
    },
    {
      label: 'Reprogramados',
      value: states?.REPROGRAMADO,
      description: 'Turnos reasignados a otra fecha',
      icon: 'bi-arrow-repeat',
      cardModifier: 'dashboard-stat-card--slate',
      iconModifier: 'dashboard-stat-icon--slate',
    },
  ];

  return (
    <div className="mb-4" aria-busy={loading}>
      {/* Encabezado ejecutivo y estado en tiempo real */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-3 border-bottom">
        <div>
          <div className="d-flex align-items-center flex-wrap gap-2 mb-1">
            <span className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1">
              <i className="bi bi-shield-check me-1" aria-hidden="true" />
              Superadministración
            </span>
            <span className="fw-bold text-dark fs-5">
              Panel general del sistema de salud
            </span>
            <ConnectionStatusBadge />
            {refreshing && (
              <span
                className="spinner-border spinner-border-sm text-secondary"
                role="status"
                title="Actualizando indicadores en tiempo real..."
              />
            )}
          </div>
          <small className="text-muted d-block">
            {loading && !data
              ? 'Cargando indicadores globales…'
              : error
                ? 'Indicadores no disponibles'
                : data
                  ? `Última sincronización: ${formatDateTime(data.actualizado_en)} · Red municipal CORA`
                  : ''}
          </small>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2" />
          No se pudo cargar el resumen. {error}
        </div>
      )}

      {/* Accesos rápidos de superadministración con icono y texto */}
      <div className="d-flex flex-wrap gap-2 mb-4">
        <Link to="/salitas/nueva" className="btn btn-sm btn-saps d-inline-flex align-items-center gap-1.5">
          <i className="bi bi-hospital" />
          <span>Nueva salita</span>
        </Link>
        <Link to="/salitas" className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1.5">
          <i className="bi bi-buildings" />
          <span>Gestionar salitas</span>
        </Link>
        <Link to="/administracion" className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1.5">
          <i className="bi bi-person-lock" />
          <span>Cuentas de acceso</span>
        </Link>
        <Link to="/profesionales/nuevo" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5">
          <i className="bi bi-person-plus" />
          <span>Nuevo profesional</span>
        </Link>
        <Link to="/configuracion/zonas" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5">
          <i className="bi bi-geo-alt" />
          <span>Zonas y barrios</span>
        </Link>
        <Link to="/auditoria-clinica" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5">
          <i className="bi bi-shield-check" />
          <span>Auditoría clínica</span>
        </Link>
        <Link to="/reportes" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5 ms-md-auto">
          <i className="bi bi-bar-chart" />
          <span>Ver reportes globales</span>
        </Link>
      </div>

      {/* Totales estructurales del sistema */}
      <h2 className="h6 fw-bold text-dark text-uppercase letter-spacing-1 mb-3">
        <i className="bi bi-building me-2 text-success" />
        Capacidad y recursos instalados
      </h2>
      <div className="row g-3 mb-4">
        {totals.map((item) => (
          <div className="col-12 col-sm-6 col-xl" key={item.label}>
            <div className={`dashboard-stat-card ${item.cardModifier} h-100`}>
              <div className="dashboard-stat-top">
                <div className={`dashboard-stat-icon ${item.iconModifier}`}>
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                </div>
                <span className="dashboard-stat-label">{item.label}</span>
              </div>
              <div className="dashboard-stat-value">
                {available ? item.value?.total : '—'}
              </div>
              <small>
                {available
                  ? `${item.value?.activos} activos · ${item.value?.inactivos} inactivos`
                  : loading
                    ? 'Cargando…'
                    : 'No disponible'}
              </small>
            </div>
          </div>
        ))}
      </div>

      {/* Turnos del día */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="h6 fw-bold text-dark text-uppercase letter-spacing-1 mb-0">
          <i className="bi bi-calendar3 me-2 text-success" />
          Turnos del día {available ? `· ${data.fecha.split('-').reverse().join('/')}` : ''}
        </h2>
        <Link to="/turnos" className="small text-success text-decoration-none fw-semibold d-inline-flex align-items-center gap-1">
          <span>Ver agenda global</span>
          <i className="bi bi-arrow-right" />
        </Link>
      </div>
      <div className="row g-3 mb-4">
        {daily.map((item) => (
          <div className="col-12 col-sm-6 col-xl-3" key={item.label}>
            <div className={`dashboard-stat-card ${item.cardModifier} h-100`}>
              <div className="dashboard-stat-top">
                <div className={`dashboard-stat-icon ${item.iconModifier}`}>
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                </div>
                <span className="dashboard-stat-label">{item.label}</span>
              </div>
              <div className="dashboard-stat-value">
                {available ? item.value ?? '—' : '—'}
              </div>
              <small>
                {available ? item.description : loading ? 'Cargando…' : 'No disponible'}
              </small>
            </div>
          </div>
        ))}
      </div>

      {/* Actividad reciente auditada */}
      <section className="card border-0 shadow-sm rounded-3">
        <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
          <h3 className="h6 fw-bold mb-0 text-dark">
            <i className="bi bi-clock-history me-2 text-success" />
            Actividad reciente y auditoría del sistema
          </h3>
          <span className="badge bg-light text-muted border">Últimos eventos</span>
        </div>
        {available &&
          (data.actividad.disponible ? (
            data.actividad.data.length ? (
              <ul className="list-group list-group-flush">
                {data.actividad.data.map((item) => (
                  <li
                    className="list-group-item d-flex flex-wrap align-items-center justify-content-between gap-2 py-3"
                    key={item.id_auditoria}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <span className={`badge ${actionBadges[item.accion] ?? 'bg-secondary'}`}>
                        {actions[item.accion] ?? item.accion}
                      </span>
                      <span className="fw-semibold text-dark">
                        En {entities[item.entidad] ?? item.entidad}
                      </span>
                    </div>
                    <small className="text-muted">
                      <i className="bi bi-clock me-1" />
                      {formatDateTime(item.fecha)}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-muted small">
                No hay actividad reciente registrada en el registro de auditoría.
              </div>
            )
          ) : (
            <div className="p-4 text-center text-danger small" role="alert">
              No se pudo consultar la actividad reciente.
            </div>
          ))}
        {!available && (
          <div className="p-4 text-center text-muted small">
            {loading ? 'Cargando registro de actividad…' : 'Actividad no disponible.'}
          </div>
        )}
      </section>
    </div>
  );
}
