import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getSalitas, updateSalita } from '../../services/salitas.service';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import ConnectionStatusBadge from '../../components/ui/ConnectionStatusBadge';
import PaginationControls from '../../components/ui/PaginationControls';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { useAutoDismiss } from '../../utils/useAutoDismiss';

import type { Salita } from '../../types/salita.types';
import '../../styles/salitas.css';

const PAGE_SIZE = 15;

type StatusFilter = 'todos' | 'activos' | 'inactivos';

const SalitasPage = () => {
  const navigate = useNavigate();
  const { ultimoEventoSalita, ultimoEventoTerritorial, resyncTick } = useAgendaSocket();

  const [salitas, setSalitas] = useState<Salita[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('activos');
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Confirmación para activar/desactivar salita
  const [confirmTarget, setConfirmTarget] = useState<Salita | null>(null);
  const [confirming, setConfirming] = useState(false);

  const requestId = useRef(0);
  const initialLoadedRef = useRef(false);

  useAutoDismiss(success, setSuccess, 10_000, Boolean(success));
  useAutoDismiss(error, setError, 15_000, Boolean(error));

  const loadSalitas = async (isBackground = false) => {
    const currentRequest = ++requestId.current;

    try {
      if (!isBackground && salitas.length === 0) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError('');

      const response = await getSalitas(true);

      if (currentRequest !== requestId.current) return;

      setSalitas(response.data);
      initialLoadedRef.current = true;
    } catch (err) {
      if (currentRequest !== requestId.current) return;
      console.error(err);
      setError('No se pudieron cargar las salitas.');
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    void loadSalitas();
  }, []);

  // Actualización reactiva ante eventos de WebSockets (salitas o territorio)
  useEffect(() => {
    if (!initialLoadedRef.current || !ultimoEventoSalita) return;

    if (ultimoEventoSalita.tipo === 'SALITA_ESTADO_CAMBIADO' && typeof ultimoEventoSalita.activo === 'boolean') {
      setSalitas((prev) =>
        prev.map((s) =>
          s.id_salita === ultimoEventoSalita.id_salita
            ? { ...s, activo: Boolean(ultimoEventoSalita.activo) }
            : s
        )
      );
    }

    void loadSalitas(true);
  }, [ultimoEventoSalita]);

  useEffect(() => {
    if (!initialLoadedRef.current || !ultimoEventoTerritorial) return;
    void loadSalitas(true);
  }, [ultimoEventoTerritorial]);

  useEffect(() => {
    if (resyncTick > 0 && initialLoadedRef.current) {
      void loadSalitas(true);
    }
  }, [resyncTick]);

  // Filtrado reactivo en memoria
  const filteredSalitas = useMemo(() => {
    const term = search.trim().toLowerCase();

    return salitas.filter((salita) => {
      // Filtro de estado
      if (statusFilter === 'activos' && !salita.activo) return false;
      if (statusFilter === 'inactivos' && salita.activo) return false;

      // Filtro de búsqueda
      if (!term) return true;

      return [salita.codigo, salita.nombre, salita.direccion]
        .filter(Boolean)
        .some((field) => field?.toLowerCase().includes(term));
    });
  }, [salitas, search, statusFilter]);

  // Paginación
  const totalPages = Math.ceil(filteredSalitas.length / PAGE_SIZE) || 1;
  const paginatedSalitas = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredSalitas.slice(start, start + PAGE_SIZE);
  }, [filteredSalitas, page]);

  // Reset de página al cambiar filtros
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('todos');
    setPage(1);
  };

  // Toggle activo/inactivo con confirmación
  const handleToggleStatus = (salita: Salita) => {
    setConfirmTarget(salita);
  };

  const confirmToggleStatus = async () => {
    if (!confirmTarget) return;

    try {
      setConfirming(true);
      setError('');
      const nextStatus = !confirmTarget.activo;

      await updateSalita(confirmTarget.id_salita, {
        activo: nextStatus,
      });

      setSuccess(
        `La salita "${confirmTarget.nombre}" fue ${
          nextStatus ? 'activada' : 'desactivada'
        } correctamente.`
      );
      setConfirmTarget(null);
      await loadSalitas(true);
    } catch (err) {
      console.error(err);
      setError('No se pudo actualizar el estado de la salita.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="salitas-page">
      {/* Modal de confirmación para activar/desactivar */}
      {confirmTarget && (
        <ConfirmationModal
          open
          title={confirmTarget.activo ? 'Desactivar salita' : 'Activar salita'}
          subtitle="Esta acción modifica la disponibilidad institucional de la salita."
          message={
            confirmTarget.activo
              ? `¿Querés desactivar la salita "${confirmTarget.nombre}"? No estará disponible para nuevas asignaciones ni turnos hasta su reactivación.`
              : `¿Querés volver a activar la salita "${confirmTarget.nombre}"?`
          }
          confirmText={confirmTarget.activo ? 'Desactivar' : 'Activar'}
          cancelText="Cancelar"
          variant={confirmTarget.activo ? 'danger' : 'success'}
          loading={confirming}
          onConfirm={() => void confirmToggleStatus()}
          onClose={() => setConfirmTarget(null)}
        />
      )}

      {/* ENCABEZADO RESPONSIVE Y MODERNO */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 mb-md-4 pt-1">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h1 className="h3 fw-bold mb-0 text-dark">
              Salitas
            </h1>
            <ConnectionStatusBadge />
            {refreshing && (
              <span
                className="spinner-border spinner-border-sm text-secondary"
                role="status"
                title="Actualizando datos en tiempo real..."
              />
            )}
          </div>
          <p className="text-muted small mb-0 d-none d-sm-block mt-1">
            Supervisión y gestión global de la red municipal de centros de atención primaria.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-saps btn-sm py-2 px-3 d-inline-flex align-items-center gap-1.5"
          onClick={() => navigate('/salitas/nueva')}
        >
          <i className="bi bi-plus-lg" aria-hidden="true" />
          <span>Nueva salita</span>
        </button>
      </div>

      {/* ALERTAS DE FEEDBACK */}
      {success && (
        <div className="alert alert-success alert-dismissible fade show mb-3" role="alert">
          <i className="bi bi-check-circle-fill me-2" />
          {success}
          <button
            type="button"
            className="btn-close"
            aria-label="Cerrar"
            onClick={() => setSuccess('')}
          />
        </div>
      )}

      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-3" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2" />
          {error}
          <button
            type="button"
            className="btn-close"
            aria-label="Cerrar"
            onClick={() => setError('')}
          />
        </div>
      )}

      {/* BUSCADOR Y FILTROS UNIFICADOS */}
      <div className="card border-0 shadow-sm mb-3 mb-md-4">
        <div className="card-body p-3">
          <div className="row g-2 g-md-3 align-items-end">
            {/* Buscador */}
            <div className="col-12 col-md-6 col-lg-6">
              <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="salitas-search">
                Buscar salita
              </label>
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0 text-muted" style={{ height: '38px' }}>
                  <i className="bi bi-search" aria-hidden="true" />
                </span>
                <input
                  id="salitas-search"
                  type="search"
                  className="form-control border-start-0 ps-0"
                  style={{ height: '38px' }}
                  placeholder="Código, nombre o dirección…"
                  aria-label="Buscar por código, nombre o dirección"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
            </div>

            {/* Filtro de Estado */}
            <div className="col-7 col-md-3 col-lg-3">
              <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="salitas-status">
                Estado
              </label>
              <select
                id="salitas-status"
                className="form-select"
                style={{ height: '38px' }}
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value as StatusFilter)}
                aria-label="Filtrar por estado"
              >
                <option value="todos">Todas</option>
                <option value="activos">Solo activas</option>
                <option value="inactivos">Solo inactivas</option>
              </select>
            </div>

            {/* Botón Limpiar */}
            <div className="col-5 col-md-auto col-lg-auto d-flex align-items-end">
              <button
                type="button"
                className="btn btn-outline-secondary w-100 d-inline-flex align-items-center justify-content-center gap-1.5"
                style={{ height: '38px', padding: '0 16px', whiteSpace: 'nowrap' }}
                onClick={handleClearFilters}
              >
                <i className="bi bi-x-circle" aria-hidden="true" />
                <span>Limpiar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="card border-0 shadow-sm">
        {/* Cabecera del listado */}
        <div className="card-header bg-white py-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <h2 className="h5 fw-bold mb-0 text-dark">
              Salitas registradas
            </h2>
            <small className="text-muted">
              {filteredSalitas.length}{' '}
              {filteredSalitas.length === 1 ? 'salita encontrada' : 'salitas encontradas'}
            </small>
          </div>

          <span className="badge bg-light text-dark border">
            {statusFilter === 'activos'
              ? 'Solo activas'
              : statusFilter === 'inactivos'
                ? 'Solo inactivas'
                : 'Todas las salitas'}
          </span>
        </div>

        <div className="card-body p-0">
          {loading && salitas.length === 0 ? (
            <div className="text-center py-5">
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Cargando…</span>
              </div>
              <p className="text-muted mt-3 mb-0 small">Cargando red de salitas…</p>
            </div>
          ) : filteredSalitas.length === 0 ? (
            <div className="text-center py-5">
              <div className="dashboard-empty-icon mx-auto mb-2 text-muted fs-1">
                <i className="bi bi-hospital" />
              </div>
              <h3 className="h6 fw-bold mb-1">No se encontraron salitas</h3>
              <p className="text-muted small mb-3">
                No hay resultados que coincidan con los criterios de búsqueda aplicados.
              </p>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={handleClearFilters}
              >
                Restablecer filtros
              </button>
            </div>
          ) : (
            <>
              {/* =========================================================
                  VISTA MÓVIL: TARJETAS COMPACTAS (< 768px)
                  Jerarquía estricta:
                  1. Nombre de la salita
                  2. Código identificador como dato secundario
                  3. Estado activo/inactivo (badge)
                  4. Dirección
                  5. Teléfono
                  6. Acciones disponibles con icono y texto
                  ========================================================= */}
              <div className="d-md-none p-2.5 p-sm-3 d-flex flex-column gap-2.5">
                {paginatedSalitas.map((salita) => (
                  <article
                    key={salita.id_salita}
                    className="salita-mobile-card"
                    data-active={salita.activo}
                  >
                    {/* Fila 1: Nombre (1), Código (2), Estado (3) */}
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div className="min-w-0 flex-grow-1">
                        <div className="d-flex align-items-center gap-1.5 mb-1">
                          <i className="bi bi-hospital text-success flex-shrink-0" style={{ fontSize: '15px' }} />
                          <h3 className="h6 fw-bold text-dark mb-0 text-truncate" style={{ fontSize: '15px' }}>
                            {salita.nombre}
                          </h3>
                        </div>
                        <div className="text-muted small" style={{ fontSize: '12px' }}>
                          <span className="fw-medium text-secondary">Código:</span>{' '}
                          <span className="font-monospace fw-semibold text-dark">{salita.codigo}</span>
                        </div>
                      </div>

                      <span
                        className={`badge rounded-pill flex-shrink-0 ${
                          salita.activo
                            ? 'bg-success-subtle text-success border border-success'
                            : 'bg-secondary-subtle text-secondary border border-secondary'
                        }`}
                        style={{ fontSize: '11px', padding: '4px 9px' }}
                      >
                        {salita.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>

                    {/* Fila 2: Dirección (4) y Teléfono (5) */}
                    <div className="salita-mobile-info-box">
                      <div className="d-flex align-items-center gap-2 mb-1.5">
                        <i className="bi bi-geo-alt text-muted flex-shrink-0" style={{ fontSize: '13px' }} />
                        <span className="text-secondary small text-truncate">
                          {salita.direccion || 'Sin dirección registrada'}
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-telephone text-muted flex-shrink-0" style={{ fontSize: '13px' }} />
                        {salita.telefono ? (
                          <a
                            href={`tel:${salita.telefono}`}
                            className="text-dark text-decoration-none small fw-medium"
                          >
                            {salita.telefono}
                          </a>
                        ) : (
                          <span className="text-muted small">Sin teléfono</span>
                        )}
                      </div>
                    </div>

                    {/* Fila 3: Acciones disponibles con icono y texto (6) */}
                    <div className="salita-mobile-card-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => navigate(`/salitas/${salita.id_salita}`)}
                      >
                        <i className="bi bi-eye" aria-hidden="true" />
                        <span>Detalle</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success"
                        onClick={() => navigate(`/salitas/${salita.id_salita}/editar`)}
                      >
                        <i className="bi bi-pencil" aria-hidden="true" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        className={`btn btn-sm ${
                          salita.activo ? 'btn-outline-danger' : 'btn-outline-success'
                        }`}
                        title={salita.activo ? 'Desactivar salita' : 'Activar salita'}
                        onClick={() => handleToggleStatus(salita)}
                      >
                        <i
                          className={`bi ${salita.activo ? 'bi-shield-slash' : 'bi-shield-check'}`}
                          aria-hidden="true"
                        />
                        <span>{salita.activo ? 'Desactivar' : 'Activar'}</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {/* =========================================================
                  VISTA ESCRITORIO: TABLA COMPLETA (>= 768px)
                  ========================================================= */}
              <div className="d-none d-md-block table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th scope="col" style={{ width: '10%' }}>Código</th>
                      <th scope="col" style={{ width: '26%' }}>Salita</th>
                      <th scope="col" style={{ width: '22%' }}>Dirección</th>
                      <th scope="col" style={{ width: '14%' }}>Teléfono</th>
                      <th scope="col" style={{ width: '8%' }}>Estado</th>
                      <th scope="col" className="text-end" style={{ width: '20%', minWidth: '310px' }}>
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedSalitas.map((salita) => (
                      <tr key={salita.id_salita}>
                        <td>
                          <span className="badge bg-light text-dark border font-monospace">
                            {salita.codigo}
                          </span>
                        </td>

                        <td>
                          <div className="d-flex align-items-center gap-2.5">
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center bg-success-subtle text-success flex-shrink-0"
                              style={{ width: '34px', height: '34px', fontSize: '15px' }}
                            >
                              <i className="bi bi-hospital" />
                            </div>
                            <span className="fw-semibold text-dark">
                              {salita.nombre}
                            </span>
                          </div>
                        </td>

                        <td className="text-muted small">
                          {salita.direccion || '—'}
                        </td>

                        <td className="small">
                          {salita.telefono ? (
                            <a
                              href={`tel:${salita.telefono}`}
                              className="text-decoration-none text-dark d-inline-flex align-items-center gap-1"
                            >
                              <i className="bi bi-telephone text-success small" />
                              <span>{salita.telefono}</span>
                            </a>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>

                        <td>
                          <span
                            className={`badge rounded-pill ${
                              salita.activo
                                ? 'bg-success-subtle text-success border border-success-subtle'
                                : 'bg-secondary-subtle text-secondary border border-secondary-subtle'
                            }`}
                          >
                            {salita.activo ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>

                        <td className="text-end text-nowrap" style={{ minWidth: '310px' }}>
                          <div className="d-inline-flex justify-content-end gap-1.5">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary text-nowrap d-inline-flex align-items-center gap-1.5 py-1 px-2.5"
                              title="Ver detalle"
                              onClick={() => navigate(`/salitas/${salita.id_salita}`)}
                            >
                              <i className="bi bi-eye" />
                              <span>Ver detalle</span>
                            </button>

                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success text-nowrap d-inline-flex align-items-center gap-1.5 py-1 px-2.5"
                              title="Editar salita"
                              onClick={() => navigate(`/salitas/${salita.id_salita}/editar`)}
                            >
                              <i className="bi bi-pencil" />
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              className={`btn btn-sm ${
                                salita.activo ? 'btn-outline-danger' : 'btn-outline-success'
                              } text-nowrap d-inline-flex align-items-center gap-1.5 py-1 px-2.5`}
                              title={salita.activo ? 'Desactivar salita' : 'Activar salita'}
                              onClick={() => handleToggleStatus(salita)}
                            >
                              <i
                                className={`bi ${salita.activo ? 'bi-shield-slash' : 'bi-shield-check'}`}
                              />
                              <span>{salita.activo ? 'Desactivar' : 'Activar'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINACIÓN ESTÁNDAR (15 POR PÁGINA) */}
              <div className="p-3 border-top">
                <PaginationControls
                  page={page}
                  totalPages={totalPages}
                  totalItems={filteredSalitas.length}
                  itemsPerPage={PAGE_SIZE}
                  onPageChange={setPage}
                  itemLabel="salitas"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalitasPage;
