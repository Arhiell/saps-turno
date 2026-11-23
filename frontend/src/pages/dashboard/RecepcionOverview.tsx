import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAdminSalitas } from '../../services/salitas.service';
import { getTurnos, changeTurnoStatus } from '../../services/turnos.service';
import { getProfessionals } from '../../services/profesionales.service';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import ConnectionStatusBadge from '../../components/ui/ConnectionStatusBadge';
import { FloatingFeedbackToast } from '../../components/ui/FormFeedback';
import { useAutoDismiss } from '../../utils/useAutoDismiss';
import { getEstadoClass } from '../../utils/turno-status';
import type { Salita } from '../../types/salita.types';
import type { Turno } from '../../types/turno.types';
import type { Professional } from '../../types/profesional.types';
import { authError } from '../../utils/auth-errors';

interface RecepcionOverviewProps {
  revision: number;
  onRefresh?: () => void;
}

export default function RecepcionOverview({
  revision,
}: RecepcionOverviewProps) {
  const navigate = useNavigate();
  const { ultimoEvento, resyncTick } = useAgendaSocket();

  const [salitas, setSalitas] = useState<Salita[]>([]);
  const [selectedSalitaId, setSelectedSalitaId] = useState<string>('');
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  // Filtros rápidos del día
  const [filterSearch, setFilterSearch] = useState('');
  const [filterProf, setFilterProf] = useState('');
  const [filterEstado, setFilterEstado] = useState<'TODOS' | 'POR_LLEGAR' | 'EN_ESPERA' | 'ATENDIDOS'>('TODOS');

  useAutoDismiss(success, () => setSuccess(''), 15000);
  useAutoDismiss(error, () => setError(''), 15000);

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

  // Carga turnos de la salita seleccionada para hoy
  const loadTurnosHoy = async () => {
    if (!selectedSalitaId) return;
    try {
      const res = await getTurnos({
        fecha: todayDate,
        id_salita: selectedSalitaId,
        page: 1,
        limit: 100,
      });
      setTurnos(res.data.turnos);
    } catch (err) {
      setError(authError(err));
    }
  };

  // Actualización granular reactiva en sitio
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

  useEffect(() => {
    void loadTurnosHoy();
  }, [selectedSalitaId, todayDate, revision, resyncTick, ultimoEvento]);

  const currentSalita = salitas.find((s) => s.id_salita === selectedSalitaId) || salitas[0];

  // Métricas del día para recepción
  const totalHoy = turnos.length;
  const enEspera = turnos.filter((t) => t.estado.codigo === 'EN_ESPERA').length;
  const atendidos = turnos.filter((t) => t.estado.codigo === 'ATENDIDO').length;
  const porLlegar = turnos.filter(
    (t) => ['SOLICITADO', 'CONFIRMADO'].includes(t.estado.codigo)
  ).length;

  // Acción rápida de ventanilla: Registrar llegada / Pasar a espera
  const handleRegistrarLlegada = async (turno: Turno) => {
    setActionBusy(turno.id_turno);
    setError('');
    setSuccess('');

    // Actualización optimista inmediata para cero latencia visual en ventanilla
    setTurnos((prev) =>
      prev.map((t) =>
        t.id_turno === turno.id_turno
          ? {
              ...t,
              estado: {
                ...t.estado,
                codigo: 'EN_ESPERA',
                nombre: 'En espera',
              },
            }
          : t
      )
    );

    try {
      await changeTurnoStatus(turno.id_turno, { estado: 'EN_ESPERA' });
      setSuccess(
        `Llegada registrada para ${turno.paciente?.persona?.apellidos || 'paciente'}. Pasa a sala de espera.`
      );
      await loadTurnosHoy();
    } catch (err) {
      setError(authError(err));
      await loadTurnosHoy();
    } finally {
      setActionBusy(null);
    }
  };

  // Filtrado reactivo en vivo de los turnos de hoy
  const filteredTurnos = useMemo(() => {
    return turnos.filter((t) => {
      // Filtro de texto (DNI o nombre)
      if (filterSearch.trim()) {
        const query = filterSearch.trim().toLowerCase();
        const dni = t.paciente?.persona?.dni?.toLowerCase() || '';
        const nombres = t.paciente?.persona?.nombres?.toLowerCase() || '';
        const apellidos = t.paciente?.persona?.apellidos?.toLowerCase() || '';
        const codigo = t.codigo_turno?.toLowerCase() || '';
        if (
          !dni.includes(query) &&
          !nombres.includes(query) &&
          !apellidos.includes(query) &&
          !codigo.includes(query)
        ) {
          return false;
        }
      }

      // Filtro de profesional
      if (filterProf && t.profesional?.id_profesional !== filterProf) {
        return false;
      }

      // Filtro de estado
      if (filterEstado === 'POR_LLEGAR') {
        return ['SOLICITADO', 'CONFIRMADO'].includes(t.estado.codigo);
      }
      if (filterEstado === 'EN_ESPERA') {
        return t.estado.codigo === 'EN_ESPERA';
      }
      if (filterEstado === 'ATENDIDOS') {
        return t.estado.codigo === 'ATENDIDO';
      }

      return true;
    });
  }, [turnos, filterSearch, filterProf, filterEstado]);

  return (
    <div className="recepcion-dashboard">
      {(error || success) && (
        <FloatingFeedbackToast
          message={error || success}
          variant={error ? 'error' : 'success'}
          onDismiss={() => {
            setError('');
            setSuccess('');
          }}
        />
      )}

      {/* Encabezado operativo de ventanilla */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-3 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-primary text-white px-2 py-1">
              <i className="bi bi-person-workspace me-1" aria-hidden="true" />
              Recepción
            </span>
            {currentSalita && (
              <span className="fw-bold text-dark fs-5">
                {currentSalita.nombre}
              </span>
            )}
          </div>
          <p className="text-muted small text-capitalize mb-0">
            {formatFechaLegible} · Control de ventanilla y sala de espera
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

      {/* 4 Contadores operativos clave de hoy (Con borde semántico de 4px y valor uniforme) */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="dashboard-stat-card dashboard-stat-card--blue h-100">
            <div className="dashboard-stat-top">
              <div className="dashboard-stat-icon dashboard-stat-icon--blue">
                <i className="bi bi-calendar-check" aria-hidden="true" />
              </div>
              <span className="dashboard-stat-label">Turnos de hoy</span>
            </div>
            <div className="dashboard-stat-value">
              {loading ? '…' : totalHoy}
            </div>
            <small>Total programado para la salita</small>
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
            <small>Llegaron a ventanilla y aguardan atención</small>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="dashboard-stat-card dashboard-stat-card--green h-100">
            <div className="dashboard-stat-top">
              <div className="dashboard-stat-icon dashboard-stat-icon--green">
                <i className="bi bi-check2-circle" aria-hidden="true" />
              </div>
              <span className="dashboard-stat-label">Atendidos</span>
            </div>
            <div className="dashboard-stat-value">
              {loading ? '…' : atendidos}
            </div>
            <small>Consultas médicas finalizadas</small>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="dashboard-stat-card dashboard-stat-card--slate h-100">
            <div className="dashboard-stat-top">
              <div className="dashboard-stat-icon dashboard-stat-icon--slate">
                <i className="bi bi-clock" aria-hidden="true" />
              </div>
              <span className="dashboard-stat-label">Por llegar</span>
            </div>
            <div className="dashboard-stat-value">
              {loading ? '…' : porLlegar}
            </div>
            <small>Turnos pendientes de presentación</small>
          </div>
        </div>
      </div>

      {/* Barra de Tareas Frecuentes de Recepción */}
      <div className="d-flex flex-wrap gap-2 mb-4">
        <Link to="/turnos/nuevo" className="btn btn-saps d-inline-flex align-items-center">
          <i className="bi bi-calendar-plus me-2" aria-hidden="true" />
          Nuevo turno
        </Link>
        <Link to="/pacientes/nuevo" className="btn btn-outline-success d-inline-flex align-items-center">
          <i className="bi bi-person-plus me-2" aria-hidden="true" />
          Registrar nuevo paciente
        </Link>
        <Link to="/pacientes" className="btn btn-outline-secondary d-inline-flex align-items-center">
          <i className="bi bi-people me-2" aria-hidden="true" />
          Buscar en padrón de pacientes
        </Link>
        <Link to="/turnos" className="btn btn-outline-secondary d-inline-flex align-items-center ms-auto">
          <i className="bi bi-calendar3 me-2" aria-hidden="true" />
          Ver agenda completa
        </Link>
      </div>

      {/* Ventanilla y Cola del día */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
        <div className="card-header bg-white py-3 border-bottom">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-card-checklist text-success fs-5" aria-hidden="true" />
              <h3 className="h6 fw-bold mb-0 text-dark">
                Control de Asistencia del Día
              </h3>
              <span className="badge bg-light text-dark border ms-1">
                {filteredTurnos.length} {filteredTurnos.length === 1 ? 'turno' : 'turnos'}
              </span>
            </div>

            {/* Selector de estado rápido */}
            <div className="btn-group btn-group-sm" role="group" aria-label="Filtro de estado de turnos">
              <button
                type="button"
                className={`btn ${filterEstado === 'TODOS' ? 'btn-success' : 'btn-outline-secondary'}`}
                onClick={() => setFilterEstado('TODOS')}
              >
                Todos ({totalHoy})
              </button>
              <button
                type="button"
                className={`btn ${filterEstado === 'POR_LLEGAR' ? 'btn-success' : 'btn-outline-secondary'}`}
                onClick={() => setFilterEstado('POR_LLEGAR')}
              >
                Por llegar ({porLlegar})
              </button>
              <button
                type="button"
                className={`btn ${filterEstado === 'EN_ESPERA' ? 'btn-warning text-dark' : 'btn-outline-secondary'}`}
                onClick={() => setFilterEstado('EN_ESPERA')}
              >
                En espera ({enEspera})
              </button>
              <button
                type="button"
                className={`btn ${filterEstado === 'ATENDIDOS' ? 'btn-success' : 'btn-outline-secondary'}`}
                onClick={() => setFilterEstado('ATENDIDOS')}
              >
                Atendidos ({atendidos})
              </button>
            </div>
          </div>

          {/* Filtros de búsqueda rápida en ventanilla */}
          <div className="row g-2">
            <div className="col-12 col-md-8">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white">
                  <i className="bi bi-search" aria-hidden="true" />
                </span>
                <input
                  type="search"
                  className="form-control"
                  placeholder="Buscar paciente por DNI, apellido, nombre o código de turno…"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  aria-label="Buscar en turnos de hoy"
                />
                {filterSearch && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setFilterSearch('')}
                    title="Limpiar búsqueda"
                  >
                    <i className="bi bi-x" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            <div className="col-12 col-md-4">
              <select
                className="form-select form-select-sm"
                value={filterProf}
                onChange={(e) => setFilterProf(e.target.value)}
                aria-label="Filtrar por profesional"
              >
                <option value="">Todos los profesionales</option>
                {professionals
                  .filter((p) => p.activo)
                  .map((p) => (
                    <option key={p.id_profesional} value={p.id_profesional}>
                      {p.persona.apellidos}, {p.persona.nombres}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5 text-muted">
              <div className="spinner-border spinner-border-sm text-success me-2" role="status" />
              Cargando turnos de hoy…
            </div>
          ) : filteredTurnos.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-calendar-x fs-2 text-muted d-block mb-2" />
              <p className="fw-semibold mb-1 text-dark">No se encontraron turnos con los filtros actuales</p>
              <p className="small mb-0">Revisá el término de búsqueda o seleccioná otro estado.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small text-muted text-uppercase">
                  <tr>
                    <th scope="col" style={{ width: '100px' }}>Horario</th>
                    <th scope="col">Paciente</th>
                    <th scope="col">Profesional & Especialidad</th>
                    <th scope="col">Estado</th>
                    <th scope="col" className="text-end">Acción de Ventanilla</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTurnos.map((t) => {
                    const canCheckIn = ['SOLICITADO', 'CONFIRMADO'].includes(t.estado.codigo);
                    const isWaiting = t.estado.codigo === 'EN_ESPERA';
                    const isAttended = t.estado.codigo === 'ATENDIDO';
                    const isBusy = actionBusy === t.id_turno;

                    return (
                      <tr key={t.id_turno} className={isWaiting ? 'table-warning bg-opacity-10' : ''}>
                        <td className="fw-semibold">
                          <span className="fs-6">
                            {new Date(t.fecha_hora_inicio).toLocaleTimeString('es-AR', {
                              timeZone: 'America/Argentina/Buenos_Aires',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="d-block text-muted font-monospace" style={{ fontSize: '0.75rem' }}>
                            {t.codigo_turno}
                          </span>
                        </td>
                        <td>
                          <div className="fw-bold text-dark">
                            {t.paciente?.persona?.apellidos}, {t.paciente?.persona?.nombres}
                          </div>
                          <small className="text-muted">
                            DNI: {t.paciente?.persona?.dni || 'Sin DNI'}
                          </small>
                        </td>
                        <td>
                          <div className="text-dark">
                            {t.profesional?.persona?.apellidos}, {t.profesional?.persona?.nombres}
                          </div>
                          <small className="badge bg-light text-secondary border">
                            {t.especialidad?.nombre || 'General'}
                          </small>
                        </td>
                        <td>
                          <span className={getEstadoClass(t.estado.codigo)}>
                            {t.estado.nombre}
                          </span>
                        </td>
                        <td className="text-end">
                          <div className="d-inline-flex align-items-center gap-1">
                            {/* Acción directa de 1 clic: Registrar llegada */}
                            {canCheckIn && (
                              <button
                                type="button"
                                className="btn btn-sm btn-success shadow-sm"
                                disabled={isBusy}
                                onClick={() => void handleRegistrarLlegada(t)}
                                title="Registrar llegada del paciente a la salita"
                              >
                                {isBusy ? (
                                  <span className="spinner-border spinner-border-sm me-1" role="status" />
                                ) : (
                                  <i className="bi bi-person-check-fill me-1" aria-hidden="true" />
                                )}
                                Llegó
                              </button>
                            )}

                            {isWaiting && (
                              <span className="badge bg-warning text-dark px-2 py-1 me-1" title="El paciente ya está en sala de espera">
                                <i className="bi bi-hourglass-split me-1" aria-hidden="true" />
                                En espera
                              </span>
                            )}

                            {isAttended && (
                              <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 me-1">
                                <i className="bi bi-check2-circle me-1" aria-hidden="true" />
                                Completado
                              </span>
                            )}

                            {/* Detalle del turno */}
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => navigate(`/turnos/${t.id_turno}`)}
                              title="Ver ficha del turno"
                            >
                              <i className="bi bi-eye" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
