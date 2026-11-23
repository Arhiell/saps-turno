import { getEstadoClass, formatShortRef } from '../../utils/turno-status';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import ConnectionStatusBadge from '../../components/ui/ConnectionStatusBadge';
import { FloatingFeedbackToast } from '../../components/ui/FormFeedback';
import PaginationControls from '../../components/ui/PaginationControls';
import { useAutoDismiss } from '../../utils/useAutoDismiss';

import {
  getTurnos,
  changeTurnoStatus,
} from '../../services/turnos.service';

import {
  getProfessionals,
} from '../../services/profesionales.service';

import {
  getAdminSalitas,
} from '../../services/salitas.service';

import {
  getCatalogo,
} from '../../services/configuracion.service';

import type {
  Professional,
} from '../../types/profesional.types';

import type {
  Salita,
} from '../../types/salita.types';

import type {
  CatalogoRegistro,
} from '../../types/configuracion.types';

import type {
  Turno,
  TurnosPagination,
} from '../../types/turno.types';

import '../../styles/turnos.css';

const estadoOptions = [
  {
    value: 'SOLICITADO',
    label: 'Solicitado',
  },
  {
    value: 'CONFIRMADO',
    label: 'Confirmado',
  },
  {
    value: 'EN_ESPERA',
    label: 'En espera',
  },
  {
    value: 'ATENDIDO',
    label: 'Atendido',
  },
  {
    value: 'NO_ASISTIO',
    label: 'No asistió',
  },
  {
    value: 'CANCELADO',
    label: 'Cancelado',
  },
  {
    value: 'REPROGRAMADO',
    label: 'Reprogramado',
  },
];

const getTurnoBorderColor = (codigo: string) => {
  switch (codigo) {
    case 'CONFIRMADO':
    case 'ATENDIDO':
      return '#16a34a';
    case 'SOLICITADO':
      return '#2563eb';
    case 'EN_ESPERA':
      return '#d97706';
    case 'CANCELADO':
    case 'NO_ASISTIO':
      return '#dc2626';
    case 'REPROGRAMADO':
      return '#7c3aed';
    default:
      return '#94a3b8';
  }
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  return {
    fecha: date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    hora: date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
};

const getTodayArgentina = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

const TurnosPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [turnos, setTurnos] = useState<Turno[]>([]);

  const [pagination, setPagination] = useState<TurnosPagination>({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 0,
  });

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [salitas, setSalitas] = useState<Salita[]>([]);
  const [especialidades, setEspecialidades] = useState<CatalogoRegistro[]>([]);

  // Inicialización de filtros considerando parámetros de URL o fecha actual
  const initialSearch = searchParams.get('search') || '';
  const [search, setSearch] = useState(initialSearch);
  const [appliedSearch, setAppliedSearch] = useState(initialSearch);

  const [fecha, setFecha] = useState<string>(() => {
    if (searchParams.has('fecha')) {
      return searchParams.get('fecha') || '';
    }
    // Si viene buscando un paciente en particular, no limitar por fecha por defecto
    if (initialSearch) {
      return '';
    }
    return getTodayArgentina();
  });

  const [professionalId, setProfessionalId] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [salitaId, setSalitaId] = useState('');
  const [estado, setEstado] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const { ultimoEvento, resyncTick } = useAgendaSocket();
  const initialLoadedRef = useRef(false);
  const requestId = useRef(0);
  const lastFiltersRef = useRef<string>('');

  useAutoDismiss(message, setMessage, 15_000, Boolean(message));
  useAutoDismiss(error, setError, 15_000, Boolean(error));

  const loadTurnos = async (
    page = 1,
    isBackground = false,
    salitaIdOverride?: string,
    force = false
  ) => {
    const currentSalita = salitaIdOverride !== undefined ? salitaIdOverride : salitaId;
    const filtersKey = `${page}-${fecha}-${professionalId}-${specialtyId}-${currentSalita}-${estado}-${appliedSearch}`;

    // Evita consultas duplicadas si los filtros y página no han cambiado, salvo que sea forzada por WebSocket/acción
    if (!force && lastFiltersRef.current === filtersKey) {
      return;
    }
    lastFiltersRef.current = filtersKey;

    const currentRequest = ++requestId.current;

    try {
      if (!isBackground && turnos.length === 0) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError('');

      const response = await getTurnos(
        {
          fecha: fecha || undefined,
          id_profesional: professionalId || undefined,
          id_especialidad: specialtyId || undefined,
          id_salita: currentSalita || undefined,
          estado: estado || undefined,
          search: appliedSearch || undefined,
          page,
          limit: 15,
        },
        force
      );

      if (currentRequest !== requestId.current) {
        return;
      }

      setTurnos(response.data.turnos);
      setPagination(response.data.pagination);
    } catch (error) {
      if (currentRequest === requestId.current) {
        console.error(error);
        setError('No se pudieron cargar los turnos.');
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Carga inicial de catálogos y primera consulta coordinada
  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        setLoadingFilters(true);
        setError('');

        const [
          professionalsResponse,
          salitasResponse,
          especialidadesResponse,
        ] = await Promise.all([
          getProfessionals(),
          getAdminSalitas(),
          getCatalogo('especialidades'),
        ]);

        if (!active) return;

        setProfessionals(professionalsResponse.data);
        setSalitas(salitasResponse.data);
        setEspecialidades(especialidadesResponse.filter((item) => item.activo));

        let initialSalita = salitaId;
        if (salitasResponse.data.length === 1 && !salitaId) {
          initialSalita = salitasResponse.data[0].id_salita;
          setSalitaId(initialSalita);
        }

        initialLoadedRef.current = true;
        setLoadingFilters(false);

        // Primera consulta única con la salita resuelta
        await loadTurnos(1, false, initialSalita);
      } catch (err) {
        if (active) {
          console.error(err);
          setError('No se pudieron cargar los datos iniciales.');
          setLoadingFilters(false);
          setLoading(false);
        }
      }
    };

    void init();

    return () => {
      active = false;
    };
  }, []);

  // Consultas subsecuentes disparadas por cambios en filtros
  useEffect(() => {
    if (!initialLoadedRef.current) return;
    void loadTurnos(1);
  }, [
    fecha,
    professionalId,
    specialtyId,
    salitaId,
    estado,
    appliedSearch,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  // Actualización reactiva granular ante eventos de WebSocket (sin spinner intrusivo)
  useEffect(() => {
    if (!initialLoadedRef.current) return;
    if (ultimoEvento) {
      if (ultimoEvento.id_turno && ultimoEvento.estado) {
        setTurnos((prev) =>
          prev.map((t) =>
            t.id_turno === ultimoEvento.id_turno
              ? {
                  ...t,
                  estado: {
                    ...t.estado,
                    codigo: ultimoEvento.estado!,
                    nombre:
                      estadoOptions.find((e) => e.value === ultimoEvento.estado)?.label ||
                      ultimoEvento.estado!,
                  },
                }
              : t
          )
        );
      }
      void loadTurnos(pagination.page, true, undefined, true);
    }
  }, [ultimoEvento]);

  // Resincronización al reconectar
  useEffect(() => {
    if (resyncTick > 0 && initialLoadedRef.current) {
      void loadTurnos(pagination.page, true, undefined, true);
    }
  }, [resyncTick]);

  const handleQuickArrival = async (turnoId: string, pacienteNombre: string) => {
    try {
      setActionLoadingId(turnoId);
      setError('');

      // Actualización optimista inmediata
      setTurnos((prev) =>
        prev.map((t) =>
          t.id_turno === turnoId
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

      await changeTurnoStatus(turnoId, { estado: 'EN_ESPERA' });
      setMessage(`Se registró la llegada de ${pacienteNombre}. El turno pasó a sala de espera.`);
      await loadTurnos(pagination.page, true, undefined, true);
    } catch (cause) {
      console.error(cause);
      setError('No se pudo registrar la llegada del paciente.');
      await loadTurnos(pagination.page, true, undefined, true);
    } finally {
      setActionLoadingId(null);
    }
  };

  const clearFilters = () => {
    setFecha(getTodayArgentina());
    setProfessionalId('');
    setSpecialtyId('');
    if (salitas.length > 1) {
      setSalitaId('');
    }
    setEstado('');
    setSearch('');
    setAppliedSearch('');
  };

  const handleClearSearch = () => {
    setSearch('');
    setAppliedSearch('');
  };

  const todayStr = getTodayArgentina();

  const startItem = pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const endItem = pagination.total > 0 ? Math.min(pagination.page * pagination.limit, pagination.total) : 0;

  return (
    <div className="turnos-page">
      <div className="d-flex justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1">Turnos</h2>
          <p className="text-muted mb-0">Gestión y seguimiento de turnos médicos.</p>
        </div>

        <button
          type="button"
          className="btn btn-saps"
          onClick={() => navigate('/turnos/nuevo')}
        >
          <i className="bi bi-calendar-plus me-2" />
          Nuevo turno
        </button>
      </div>

      {(message || error) && (
        <FloatingFeedbackToast
          message={message || error}
          variant={error ? 'error' : 'success'}
          onDismiss={() => {
            setMessage('');
            setError('');
          }}
        />
      )}

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white py-3">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-bold">
              <i className="bi bi-funnel me-2 text-success" />
              Filtros de búsqueda
            </h5>

            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={clearFilters}
            >
              <i className="bi bi-arrow-counterclockwise me-1" />
              Restablecer
            </button>
          </div>
        </div>

        <div className="card-body">
          <div className="row g-3">
            {/* Buscador general de paciente por DNI, apellido o nombre */}
            <div className="col-lg-7 col-md-12">
              <label className="form-label fw-semibold small text-secondary">
                Buscar paciente
              </label>

              <div className="input-group">
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search text-muted" />
                </span>

                <input
                  type="search"
                  className="form-control border-start-0 ps-0"
                  placeholder="Buscar por DNI, apellido o nombre..."
                  aria-label="Buscar paciente por DNI, apellido o nombre completo"
                  maxLength={150}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />

                {appliedSearch && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={handleClearSearch}
                    title="Limpiar búsqueda de paciente"
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                )}
              </div>
            </div>

            {/* Selector de fecha con atajos Hoy y Todos */}
            <div className="col-lg-5 col-md-12">
              <label className="form-label fw-semibold small text-secondary">
                Fecha de los turnos
              </label>

              <div className="input-group">
                <input
                  type="date"
                  className="form-control"
                  value={fecha}
                  onChange={(event) => setFecha(event.target.value)}
                  aria-label="Filtrar por fecha"
                />

                <button
                  type="button"
                  className={`btn ${fecha === todayStr ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                  onClick={() => setFecha(todayStr)}
                  title="Ver turnos del día de hoy"
                >
                  Hoy
                </button>

                <button
                  type="button"
                  className={`btn ${fecha === '' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                  onClick={() => setFecha('')}
                  title="Ver turnos de todas las fechas"
                >
                  Todos
                </button>
              </div>
            </div>

            {/* Fila secundaria de filtros: Profesional, Especialidad, Salita (si aplica), Estado */}
            <div className={salitas.length > 1 ? 'col-lg-3 col-md-6' : 'col-lg-4 col-md-6'}>
              <label className="form-label fw-semibold small text-secondary">
                Profesional
              </label>

              <select
                className="form-select"
                value={professionalId}
                onChange={(event) => setProfessionalId(event.target.value)}
                disabled={loadingFilters}
              >
                <option value="">Todos los profesionales</option>
                {professionals
                  .filter((item) => item.activo)
                  .map((item) => (
                    <option key={item.id_profesional} value={item.id_profesional}>
                      {item.persona.apellidos}, {item.persona.nombres}
                    </option>
                  ))}
              </select>
            </div>

            <div className={salitas.length > 1 ? 'col-lg-3 col-md-6' : 'col-lg-4 col-md-6'}>
              <label className="form-label fw-semibold small text-secondary">
                Especialidad
              </label>

              <select
                className="form-select"
                value={specialtyId}
                onChange={(event) => setSpecialtyId(event.target.value)}
                disabled={loadingFilters}
              >
                <option value="">Todas las especialidades</option>
                {especialidades.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </div>

            {salitas.length > 1 && (
              <div className="col-lg-3 col-md-6">
                <label className="form-label fw-semibold small text-secondary">
                  Salita
                </label>

                <select
                  className="form-select"
                  value={salitaId}
                  onChange={(event) => setSalitaId(event.target.value)}
                  disabled={loadingFilters}
                >
                  <option value="">Todas las salitas</option>
                  {salitas
                    .filter((item) => item.activo)
                    .map((item) => (
                      <option key={item.id_salita} value={item.id_salita}>
                        {item.nombre}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className={salitas.length > 1 ? 'col-lg-3 col-md-6' : 'col-lg-4 col-md-6'}>
              <label className="form-label fw-semibold small text-secondary">
                Estado
              </label>

              <select
                className="form-select"
                value={estado}
                onChange={(event) => setEstado(event.target.value)}
              >
                <option value="">Todos los estados</option>
                {estadoOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white py-3">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <h5 className="mb-0 fw-bold">Turnos registrados</h5>

            <div className="d-flex align-items-center gap-2">
              <ConnectionStatusBadge />
              {refreshing && (
                <span className="text-muted small d-inline-flex align-items-center gap-1">
                  <span className="spinner-border spinner-border-sm text-success" role="status" />
                  Sincronizando...
                </span>
              )}
              <span className="badge bg-light text-dark border">
                {pagination.total > 0
                  ? `${startItem}–${endItem} de ${pagination.total} ${pagination.total === 1 ? 'turno' : 'turnos'}`
                  : '0 turnos'}
              </span>
            </div>
          </div>
        </div>

        <div className="card-body p-0">
          {loading && turnos.length === 0 ? (
            <div className="text-center py-5">
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
            </div>
          ) : turnos.length === 0 ? (
            <div className="turno-empty">
              <div className="turno-empty-icon">
                <i className="bi bi-calendar-x" />
              </div>

              <h5>No hay turnos</h5>

              <p className="text-muted mb-3">
                No se encontraron turnos con los filtros seleccionados.
              </p>

              <button
                type="button"
                className="btn btn-saps"
                onClick={() => navigate('/turnos/nuevo')}
              >
                Crear nuevo turno
              </button>
            </div>
          ) : (
            <>
              {/* VISTA MÓVIL: TARJETAS RESPONSIVE ESPECÍFICAS (< 768px) */}
              <div className="d-md-none p-2.5 p-sm-3 d-flex flex-column gap-2.5">
                {turnos.map((turno) => {
                  const dt = formatDateTime(turno.fecha_hora_inicio);
                  const shortRef = formatShortRef(turno.codigo_turno || turno.id_turno);
                  const pacienteNombre = `${turno.paciente.persona.apellidos}, ${turno.paciente.persona.nombres}`;
                  const borderColor = getTurnoBorderColor(turno.estado.codigo);

                  return (
                    <article
                      key={turno.id_turno}
                      className="turno-mobile-card bg-white border rounded-3 p-3 shadow-xs position-relative"
                      style={{ borderLeft: `4px solid ${borderColor}` }}
                    >
                      {/* Fila 1: Fecha y hora destacadas + Estado + Ref corta */}
                      <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                        <div>
                          <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-calendar-event text-success small" />
                            <strong className="text-dark" style={{ fontSize: '14.5px' }}>
                              {dt.fecha} — {dt.hora}
                            </strong>
                          </div>
                          {shortRef && (
                            <span
                              className="badge bg-light text-secondary border font-monospace mt-1"
                              style={{ fontSize: '10.5px' }}
                              title={`Identificador completo: ${turno.codigo_turno || turno.id_turno}`}
                            >
                              Ref. #{shortRef}
                            </span>
                          )}
                        </div>

                        <span className={getEstadoClass(turno.estado.codigo)}>
                          {turno.estado.nombre}
                        </span>
                      </div>

                      {/* Fila 2: Paciente (Nombre y DNI) */}
                      <div className="mb-2">
                        <span className="text-muted small d-block" style={{ fontSize: '10.5px' }}>Paciente</span>
                        <div className="fw-bold text-dark text-truncate" style={{ fontSize: '14px' }}>
                          {pacienteNombre}
                        </div>
                        <small className="text-muted">
                          DNI {turno.paciente.persona.dni}
                        </small>
                      </div>

                      {/* Fila 3: Profesional y Especialidad agrupados (y Salita si aplica) */}
                      <div className="py-1.5 px-2 my-1 border rounded-2 bg-light text-dark" style={{ fontSize: '12px' }}>
                        <div className="d-flex align-items-center gap-2 text-truncate mb-0.5">
                          <i className="bi bi-person-badge text-primary small" />
                          <span className="fw-semibold text-truncate">
                            {turno.profesional.persona.apellidos}, {turno.profesional.persona.nombres}
                          </span>
                        </div>
                        <div className="d-flex flex-wrap align-items-center gap-2 text-muted small" style={{ fontSize: '11px' }}>
                          <span className="text-secondary fw-medium">
                            <i className="bi bi-tag text-muted me-1" />
                            {turno.especialidad.nombre}
                          </span>
                          {salitas.length > 1 && (
                            <span>
                              · <i className="bi bi-hospital text-muted me-0.5" />
                              {turno.salita.nombre.replace(/^(SAPS|CIC|CAPS)\s+/i, '')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Fila 4: Acciones táctiles con icono y texto visible */}
                      <div className="d-flex flex-wrap gap-1.5 pt-2">
                        {(turno.estado.codigo === 'SOLICITADO' || turno.estado.codigo === 'CONFIRMADO') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-warning text-dark d-inline-flex align-items-center justify-content-center gap-1.5 flex-fill py-1.5 px-2"
                            title="Marcar llegada / en sala de espera"
                            disabled={actionLoadingId === turno.id_turno}
                            onClick={() => void handleQuickArrival(turno.id_turno, pacienteNombre)}
                          >
                            {actionLoadingId === turno.id_turno ? (
                              <span className="spinner-border spinner-border-sm" role="status" />
                            ) : (
                              <i className="bi bi-box-arrow-in-right text-warning" />
                            )}
                            <span className="fw-medium">Llegó</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success d-inline-flex align-items-center justify-content-center gap-1.5 flex-fill py-1.5 px-2"
                          title="Ver detalle del turno"
                          onClick={() => navigate(`/turnos/${turno.id_turno}`)}
                        >
                          <i className="bi bi-eye" />
                          <span className="fw-medium">Ver detalle</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* VISTA ESCRITORIO: TABLA COMPLETA (>= 768px) */}
              <div className="d-none d-md-block table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th scope="col" style={{ width: '18%' }}>Fecha y hora</th>
                      <th scope="col" style={{ width: '25%' }}>Paciente</th>
                      <th scope="col" style={{ width: '20%' }}>Profesional</th>
                      <th scope="col" style={{ width: '15%' }}>Especialidad</th>
                      {salitas.length > 1 && <th scope="col" style={{ width: '10%' }}>Salita</th>}
                      <th scope="col" style={{ width: '10%' }}>Estado</th>
                      <th scope="col" className="text-end" style={{ width: '12%' }}>Acción</th>
                    </tr>
                  </thead>

                  <tbody>
                    {turnos.map((turno) => {
                      const dt = formatDateTime(turno.fecha_hora_inicio);
                      const shortRef = formatShortRef(turno.codigo_turno || turno.id_turno);
                      const pacienteNombre = `${turno.paciente.persona.apellidos}, ${turno.paciente.persona.nombres}`;

                      return (
                        <tr key={turno.id_turno}>
                          <td>
                            <div className="fw-semibold text-dark">
                              {dt.fecha} — {dt.hora}
                            </div>
                            <div className="mt-0.5">
                              <span
                                className="badge bg-light text-secondary border font-monospace"
                                style={{ fontSize: '0.72rem' }}
                                title={`Identificador completo: ${turno.codigo_turno || turno.id_turno}`}
                              >
                                Ref. #{shortRef}
                              </span>
                            </div>
                          </td>

                          <td>
                            <strong className="text-dark d-block">{pacienteNombre}</strong>
                            <small className="text-muted">
                              DNI {turno.paciente.persona.dni}
                            </small>
                          </td>

                          <td>
                            {turno.profesional.persona.apellidos}, {turno.profesional.persona.nombres}
                          </td>

                          <td>
                            {turno.especialidad.nombre}
                          </td>

                          {salitas.length > 1 && (
                            <td>
                              <span title={turno.salita.nombre}>
                                {turno.salita.nombre.replace(/^(SAPS|CIC|CAPS)\s+/i, '')}
                              </span>
                            </td>
                          )}

                          <td>
                            <span className={getEstadoClass(turno.estado.codigo)}>
                              {turno.estado.nombre}
                            </span>
                          </td>

                          <td className="text-end">
                            <div className="d-inline-flex align-items-center gap-1.5 justify-content-end">
                              {(turno.estado.codigo === 'SOLICITADO' || turno.estado.codigo === 'CONFIRMADO') && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-warning text-dark d-inline-flex align-items-center gap-1.5"
                                  title="Marcar llegada / en sala de espera"
                                  disabled={actionLoadingId === turno.id_turno}
                                  onClick={() =>
                                    void handleQuickArrival(
                                      turno.id_turno,
                                      pacienteNombre
                                    )
                                  }
                                >
                                  {actionLoadingId === turno.id_turno ? (
                                    <span className="spinner-border spinner-border-sm me-1" role="status" />
                                  ) : (
                                    <i className="bi bi-box-arrow-in-right text-warning" />
                                  )}
                                  <span>Llegó</span>
                                </button>
                              )}

                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1.5"
                                title="Ver detalle del turno"
                                onClick={() => navigate(`/turnos/${turno.id_turno}`)}
                              >
                                <i className="bi bi-eye" />
                                <span>Ver</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="card-footer bg-white border-0 py-3">
            <PaginationControls
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={(newPage) => void loadTurnos(newPage)}
              loading={refreshing}
              itemLabel="turnos"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TurnosPage;
