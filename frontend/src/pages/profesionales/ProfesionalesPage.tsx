import AccountSummary from '../../components/ui/AccountSummary';
import { agendaToday } from '../../utils/agenda-display';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { FloatingFeedbackToast } from '../../components/ui/FormFeedback';
import PaginationControls from '../../components/ui/PaginationControls';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import {
  RECOVERABLE_ERROR_TIMEOUT_MS,
  SUCCESS_MESSAGE_TIMEOUT_MS,
  useAutoDismiss,
} from '../../utils/useAutoDismiss';

import {
  deleteProfessional,
  getProfessionals,
  updateProfessional,
} from '../../services/profesionales.service';

import type {
  Professional,
} from '../../types/profesional.types';

import { getAdminSalitas } from '../../services/salitas.service';
import type { Salita } from '../../types/salita.types';

import '../../styles/profesionales.css';

interface ProfesionalesLocationState {
  message?: string;
  messageTitle?: string;
  professional?: Professional;
}

const PAGE_SIZE = 15;

const ProfesionalesPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navigationState =
    (location.state as ProfesionalesLocationState | null) ??
    null;

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [salitas, setSalitas] = useState<Salita[]>([]);
  const [selectedSalita, setSelectedSalita] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'ACTIVOS' | 'INACTIVOS'>('TODOS');
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(navigationState?.message ?? '');
  const [messageTitle, setMessageTitle] = useState(
    navigationState?.messageTitle ?? 'Operación completada'
  );

  const [deactivationTarget, setDeactivationTarget] = useState<Professional | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const [activationTarget, setActivationTarget] = useState<Professional | null>(null);
  const [activating, setActivating] = useState(false);

  const { ultimoEventoProfesional, resyncTick } = useAgendaSocket();
  const requestIdRef = useRef(0);

  const loadProfessionals = async (showLoading = true) => {
    const currentRequestId = ++requestIdRef.current;
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError('');

      const response = await getProfessionals();
      if (currentRequestId === requestIdRef.current) {
        setProfessionals(response.data);
      }
    } catch (error) {
      if (currentRequestId === requestIdRef.current) {
        console.error(error);
        setError('No se pudieron cargar los profesionales.');
      }
    } finally {
      if (showLoading && currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadProfessionals(true);

    const loadSalitas = async () => {
      try {
        const response = await getAdminSalitas();
        setSalitas(response.data.filter((salita) => salita.activo));
      } catch (error) {
        console.error(error);
        setError('No se pudieron cargar las salitas.');
      }
    };

    void loadSalitas();
  }, []);

  // Actualización en tiempo real vía WebSockets sin recargar toda la pantalla
  useEffect(() => {
    if (ultimoEventoProfesional || resyncTick > 0) {
      void loadProfessionals(false);
    }
  }, [ultimoEventoProfesional, resyncTick]);

  useEffect(() => {
    if (navigationState?.message) {
      setMessage(navigationState.message);
      setMessageTitle(navigationState.messageTitle ?? 'Operación completada');
    }
  }, [navigationState?.message, navigationState?.messageTitle]);

  useAutoDismiss(message, () => setMessage(''), SUCCESS_MESSAGE_TIMEOUT_MS, Boolean(message));
  useAutoDismiss(error, () => setError(''), RECOVERABLE_ERROR_TIMEOUT_MS, Boolean(error));

  const filteredProfessionals = useMemo(() => {
    const value = search.trim().toLowerCase();
    const today = agendaToday();

    return professionals.filter((professional) => {
      const person = professional.persona;

      const matchesSearch =
        !value ||
        person.dni.toLowerCase().includes(value) ||
        person.nombres.toLowerCase().includes(value) ||
        person.apellidos.toLowerCase().includes(value) ||
        professional.matricula.toLowerCase().includes(value);

      const matchesSalita =
        !selectedSalita ||
        (professional.salitas ?? []).some(
          (assignment) =>
            assignment.id_salita === selectedSalita &&
            assignment.activo &&
            assignment.salita?.activo === true &&
            assignment.fecha_desde <= today &&
            (assignment.fecha_hasta === null || assignment.fecha_hasta >= today)
        );

      const matchesStatus =
        statusFilter === 'TODOS' ||
        (statusFilter === 'ACTIVOS' && professional.activo) ||
        (statusFilter === 'INACTIVOS' && !professional.activo);

      return matchesSearch && matchesStatus && matchesSalita;
    });
  }, [professionals, search, statusFilter, selectedSalita]);

  // Paginación de 15 registros
  const totalPages = Math.ceil(filteredProfessionals.length / PAGE_SIZE) || 1;
  const paginatedProfessionals = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredProfessionals.slice(start, start + PAGE_SIZE);
  }, [filteredProfessionals, page]);

  // Reset de página al cambiar filtros
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleStatusFilterChange = (status: 'TODOS' | 'ACTIVOS' | 'INACTIVOS') => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleSalitaChange = (salitaId: string) => {
    setSelectedSalita(salitaId);
    setPage(1);
  };

  const handleDelete = (professional: Professional) => {
    setDeactivationTarget(professional);
  };

  const confirmDeactivation = async () => {
    if (!deactivationTarget || deactivating) return;

    const professionalId = deactivationTarget.id_profesional;

    try {
      setDeactivating(true);
      setError('');

      await deleteProfessional(professionalId);
      setDeactivationTarget(null);

      setMessageTitle('Profesional desactivado');
      setMessage('El profesional se desactivó correctamente.');

      await loadProfessionals(false);
    } catch (error) {
      console.error(error);
      setError('No se pudo actualizar el estado del profesional.');
    } finally {
      setDeactivating(false);
    }
  };

  const handleActivate = (professional: Professional) => {
    setActivationTarget(professional);
  };

  const confirmActivation = async () => {
    if (!activationTarget || activating) return;

    const professionalId = activationTarget.id_profesional;

    try {
      setActivating(true);
      setError('');

      await updateProfessional(professionalId, {
        activo: true,
        fecha_baja: null,
      });

      setActivationTarget(null);
      setMessageTitle('Profesional activado');
      setMessage('El profesional se activó correctamente.');

      await loadProfessionals(false);
    } catch (error) {
      console.error(error);
      setError('No se pudo activar al profesional.');
    } finally {
      setActivating(false);
    }
  };

  return (
    <>
      <ConfirmationModal
        open={Boolean(activationTarget)}
        title="Activar profesional"
        subtitle="Esta acción reactiva la disponibilidad del profesional en la salita."
        message="¿Querés volver a activar al profesional?"
        confirmText="Activar profesional"
        cancelText="Cancelar"
        variant="success"
        icon="bi-person-check"
        loading={activating}
        detail={
          activationTarget ? (
            <div className="bg-light border rounded p-3 mt-2">
              <div className="fw-semibold">
                {activationTarget.persona.apellidos}, {activationTarget.persona.nombres}
              </div>
              <div className="text-muted small mt-1">
                Matrícula: {activationTarget.matricula}
              </div>
            </div>
          ) : undefined
        }
        notice="El profesional volverá a figurar como activo y podrá recibir nuevos turnos."
        onClose={() => setActivationTarget(null)}
        onConfirm={() => void confirmActivation()}
      />

      <ConfirmationModal
        open={Boolean(deactivationTarget)}
        title="Desactivar profesional"
        subtitle="El profesional dejará de figurar disponible en la agenda."
        message="¿Confirmás la desactivación de este profesional?"
        confirmText="Desactivar profesional"
        cancelText="Cancelar"
        variant="danger"
        icon="bi-person-x"
        loading={deactivating}
        detail={
          deactivationTarget ? (
            <div className="bg-light border rounded p-3 mt-2">
              <div className="fw-semibold">
                {deactivationTarget.persona.apellidos}, {deactivationTarget.persona.nombres}
              </div>
              <div className="text-muted small mt-1">
                Matrícula: {deactivationTarget.matricula}
              </div>
            </div>
          ) : undefined
        }
        notice="Los turnos previamente agendados conservarán su registro histórico."
        onClose={() => setDeactivationTarget(null)}
        onConfirm={() => void confirmDeactivation()}
      />

      {message && (
        <FloatingFeedbackToast
          variant="success"
          title={messageTitle}
          message={message}
          onDismiss={() => setMessage('')}
        />
      )}

      {error && (
        <FloatingFeedbackToast
          variant="error"
          title="Error"
          message={error}
          onDismiss={() => setError('')}
        />
      )}

      <div className="profesionales-page">
        <div className="d-flex justify-content-between align-items-center mb-4 gap-3 flex-wrap">
          <div>
            <h2 className="fw-bold mb-1">Profesionales</h2>
            <p className="text-muted mb-0">
              Administración de profesionales y asignación de salitas de atención.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-saps"
            onClick={() => navigate('/profesionales/nuevo')}
          >
            <i className="bi bi-person-plus me-2" />
            Nuevo profesional
          </button>
        </div>

        {/* Tarjeta de Búsqueda y Filtros */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-12 col-md-5">
                <label className="form-label small fw-semibold text-secondary">
                  Buscar profesional
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-white">
                    <i className="bi bi-search" />
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="DNI, nombre, apellido o matrícula"
                    value={search}
                    onChange={(event) => handleSearchChange(event.target.value)}
                  />
                </div>
              </div>

              <div className="col-12 col-sm-6 col-md-3">
                <label className="form-label small fw-semibold text-secondary">
                  Estado
                </label>
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(event) =>
                    handleStatusFilterChange(
                      event.target.value as 'TODOS' | 'ACTIVOS' | 'INACTIVOS'
                    )
                  }
                >
                  <option value="TODOS">Todos los estados</option>
                  <option value="ACTIVOS">Solo activos</option>
                  <option value="INACTIVOS">Solo inactivos</option>
                </select>
              </div>

              <div className="col-12 col-sm-6 col-md-4">
                <label className="form-label small fw-semibold text-secondary" htmlFor="filtro-salita-profesionales">
                  Filtrar por salita
                </label>
                <select
                  id="filtro-salita-profesionales"
                  className="form-select"
                  value={selectedSalita}
                  onChange={(event) => handleSalitaChange(event.target.value)}
                >
                  <option value="">Todas las salitas ({salitas.length})</option>
                  {salitas.map((salita) => (
                    <option key={salita.id_salita} value={salita.id_salita}>
                      {salita.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Listado de profesionales */}
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white border-0 py-3">
            <div className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold">Profesionales registrados</h5>
              <span className="badge bg-light text-dark border">
                {filteredProfessionals.length} resultado{filteredProfessionals.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div className="card-body p-0">
            {loading && professionals.length === 0 ? (
              <div className="text-center py-5">
                <div className="spinner-border text-success" role="status">
                  <span className="visually-hidden">Cargando profesionales...</span>
                </div>
                <p className="text-muted mt-2 mb-0 small">Cargando profesionales registrados…</p>
              </div>
            ) : filteredProfessionals.length === 0 ? (
              <div className="professional-empty">
                <div className="professional-empty-icon">
                  <i className="bi bi-person-badge" />
                </div>
                <h5>No se encontraron profesionales</h5>
                <p className="text-muted mb-3">
                  No hay profesionales que coincidan con los filtros aplicados.
                </p>
                <button
                  type="button"
                  className="btn btn-saps"
                  onClick={() => navigate('/profesionales/nuevo')}
                >
                  Registrar profesional
                </button>
              </div>
            ) : (
              <>
                {/* Vista móvil en tarjetas */}
                <div className="d-md-none p-2 p-sm-3">
                  <div className="d-flex flex-column gap-2">
                    {paginatedProfessionals.map((professional) => (
                      <article
                        key={professional.id_profesional}
                        className="bg-white border rounded-3 shadow-sm p-3 d-flex flex-column gap-2"
                        style={{
                          borderLeft: `4px solid ${
                            professional.activo ? 'var(--cora-green-600, #16a34a)' : '#9ca3af'
                          }`,
                        }}
                      >
                        {/* Encabezado: Avatar + Nombre + Matrícula + Badge Estado */}
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div className="d-flex align-items-center gap-2 min-w-0">
                            <div
                              className="d-flex align-items-center justify-content-center bg-light text-success rounded-circle border flex-shrink-0"
                              style={{ width: '38px', height: '38px' }}
                            >
                              <i className="bi bi-person-fill fs-6" />
                            </div>
                            <div className="min-w-0">
                              <h6 className="mb-0 fw-bold text-dark text-truncate">
                                {professional.persona.apellidos}, {professional.persona.nombres}
                              </h6>
                              <div className="text-secondary small font-monospace">
                                Mat. {professional.matricula}
                              </div>
                            </div>
                          </div>
                          {professional.activo ? (
                            <span className="badge bg-success-subtle text-success flex-shrink-0">
                              Activo
                            </span>
                          ) : (
                            <span className="badge bg-secondary-subtle text-secondary flex-shrink-0">
                              Inactivo
                            </span>
                          )}
                        </div>

                        {/* Bloque compacto de datos: DNI y Teléfono */}
                        <div className="bg-light rounded-2 p-2 small">
                          <div className="row g-2">
                            <div className="col-6">
                              <span className="text-secondary d-block" style={{ fontSize: '0.75rem' }}>
                                DNI
                              </span>
                              <strong className="text-dark">{professional.persona.dni}</strong>
                            </div>
                            <div className="col-6">
                              <span className="text-secondary d-block" style={{ fontSize: '0.75rem' }}>
                                TELÉFONO
                              </span>
                              <span className="text-dark">{professional.persona.telefono || '—'}</span>
                            </div>
                          </div>
                          {professional.persona.cuenta && (
                            <div className="mt-1 pt-1 border-top">
                              <AccountSummary account={professional.persona.cuenta} />
                            </div>
                          )}
                        </div>

                        {/* Acciones con texto visible e icono */}
                        <div className="d-flex gap-2 pt-1 border-top mt-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success flex-fill d-inline-flex align-items-center justify-content-center gap-1 py-1"
                            style={{ minHeight: '36px' }}
                            onClick={() => navigate(`/profesionales/${professional.id_profesional}`)}
                          >
                            <i className="bi bi-eye" />
                            <span>Detalle</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary flex-fill d-inline-flex align-items-center justify-content-center gap-1 py-1"
                            style={{ minHeight: '36px' }}
                            onClick={() =>
                              navigate(`/profesionales/${professional.id_profesional}/editar`, {
                                state: {
                                  professional,
                                  returnTo: '/profesionales',
                                  returnLabel: 'Volver a profesionales',
                                },
                              })
                            }
                          >
                            <i className="bi bi-pencil" />
                            <span>Editar</span>
                          </button>
                          {professional.activo ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger flex-fill d-inline-flex align-items-center justify-content-center gap-1 py-1"
                              style={{ minHeight: '36px' }}
                              onClick={() => void handleDelete(professional)}
                            >
                              <i className="bi bi-person-dash" />
                              <span>Desactivar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success flex-fill d-inline-flex align-items-center justify-content-center gap-1 py-1"
                              style={{ minHeight: '36px' }}
                              onClick={() => void handleActivate(professional)}
                            >
                              <i className="bi bi-person-check" />
                              <span>Activar</span>
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                {/* Vista escritorio en tabla */}
                <div className="table-responsive d-none d-md-block">
                  <table className="table table-hover align-middle mb-0">
                    <thead>
                      <tr>
                        <th scope="col">Profesional</th>
                        <th scope="col">DNI</th>
                        <th scope="col">Matrícula</th>
                        <th scope="col">Teléfono</th>
                        <th scope="col">Estado</th>
                        <th scope="col" className="text-end">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProfessionals.map((professional) => (
                        <tr key={professional.id_profesional}>
                          <td data-label="Profesional">
                            <div className="professional-name-cell">
                              <div className="professional-avatar">
                                <i className="bi bi-person" />
                              </div>
                              <div>
                                <strong>
                                  {professional.persona.apellidos}, {professional.persona.nombres}
                                </strong>
                                <AccountSummary account={professional.persona.cuenta} />
                                <small>{professional.persona.email}</small>
                              </div>
                            </div>
                          </td>

                          <td data-label="DNI">{professional.persona.dni}</td>

                          <td data-label="Matrícula">
                            <span className="professional-license">
                              {professional.matricula}
                            </span>
                          </td>

                          <td data-label="Teléfono">{professional.persona.telefono || '—'}</td>

                          <td data-label="Estado">
                            {professional.activo ? (
                              <span className="badge bg-success-subtle text-success">
                                Activo
                              </span>
                            ) : (
                              <span className="badge bg-secondary-subtle text-secondary">
                                Inactivo
                              </span>
                            )}
                          </td>

                          <td data-label="Acciones">
                            <div className="d-flex justify-content-end gap-1">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success"
                                title="Ver detalle"
                                onClick={() =>
                                  navigate(`/profesionales/${professional.id_profesional}`)
                                }
                              >
                                <i className="bi bi-eye" />
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                title="Editar"
                                onClick={() =>
                                  navigate(`/profesionales/${professional.id_profesional}/editar`, {
                                    state: {
                                      professional,
                                      returnTo: '/profesionales',
                                      returnLabel: 'Volver a profesionales',
                                    },
                                  })
                                }
                              >
                                <i className="bi bi-pencil" />
                              </button>

                              {professional.activo ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  title="Desactivar"
                                  onClick={() => void handleDelete(professional)}
                                >
                                  <i className="bi bi-person-dash" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-success"
                                  title="Activar"
                                  onClick={() => void handleActivate(professional)}
                                >
                                  <i className="bi bi-person-check" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginación de 15 registros */}
                <div className="p-3 border-top bg-light">
                  <PaginationControls
                    page={page}
                    totalPages={totalPages}
                    totalItems={filteredProfessionals.length}
                    itemsPerPage={PAGE_SIZE}
                    itemLabel="profesionales"
                    onPageChange={(p) => setPage(p)}
                    loading={loading}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfesionalesPage;
