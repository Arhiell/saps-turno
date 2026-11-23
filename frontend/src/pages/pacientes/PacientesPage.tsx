
import AccountSummary from '../../components/ui/AccountSummary';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import ConnectionStatusBadge from '../../components/ui/ConnectionStatusBadge';
import { FloatingFeedbackToast } from '../../components/ui/FormFeedback';
import PaginationControls from '../../components/ui/PaginationControls';
import { useAutoDismiss } from '../../utils/useAutoDismiss';

import ConfirmationModal from '../../components/ui/ConfirmationModal';

import {
  getPatients,
  updatePatientStatus,
} from '../../services/patients.service';
import { getAdminSalitas } from '../../services/salitas.service';

import type {
  Patient,
  PatientPagination,
  PatientStatusFilter,
} from '../../types/patient.types';

const PacientesPage = () => {
  const navigate = useNavigate();
  const { permissions } = useAuth();

  // Recupera el mensaje guardado al registrar un paciente nuevo.
  const [success, setSuccess] = useState(() => {
    const savedMessage = sessionStorage.getItem('pacientes_success_message');

    if (savedMessage) {
      sessionStorage.removeItem('pacientes_success_message');
    }

    return savedMessage ?? '';
  });

  const [patients, setPatients] = useState<Patient[]>([]);
  const [pagination, setPagination] =
    useState<PatientPagination | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<PatientStatusFilter>('activo');
  const [salitas, setSalitas] = useState<
    { id_salita: string; nombre: string; activo: boolean }[]
  >([]);
  const [selectedSalita, setSelectedSalita] = useState('');
  const requestId = useRef(0);
  const initialLoadedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<Patient | null>(null);
  const [confirming, setConfirming] = useState(false);

  const { ultimoEventoPaciente, resyncTick } = useAgendaSocket();

  // Feedback estándar unificado de 15 segundos.
  useAutoDismiss(success, setSuccess, 15_000, Boolean(success));
  useAutoDismiss(error, setError, 15_000, Boolean(error));

  const loadPatients = async (isBackground = false) => {
    const currentRequest = ++requestId.current;

    try {
      if (!isBackground && patients.length === 0) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError('');

      const response = await getPatients(
        page,
        10,
        appliedSearch,
        statusFilter,
        selectedSalita || undefined,
      );

      if (currentRequest !== requestId.current) return;

      setPatients(response.data.patients);
      setPagination(response.data.pagination);
    } catch (error) {
      if (currentRequest !== requestId.current) return;

      console.error(error);
      setPatients([]);
      setPagination(null);
      setError(
        'No se pudieron cargar los pacientes.',
      );
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Carga inicial coordinada de salitas y primera consulta de pacientes sin duplicados
  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const response = await getAdminSalitas();
        if (!active) return;
        const activeSalitas = response.data.filter((salita) => salita.activo);
        setSalitas(activeSalitas);

        let initialSalita = selectedSalita;
        if (activeSalitas.length === 1 && !selectedSalita) {
          initialSalita = activeSalitas[0].id_salita;
          setSelectedSalita(initialSalita);
        }

        initialLoadedRef.current = true;

        const currentRequest = ++requestId.current;
        const patientsRes = await getPatients(
          1,
          10,
          appliedSearch,
          statusFilter,
          initialSalita || undefined,
        );

        if (!active || currentRequest !== requestId.current) return;

        setPatients(patientsRes.data.patients);
        setPagination(patientsRes.data.pagination);
      } catch (error) {
        if (active) {
          console.error('No se pudieron cargar las salitas.', error);
          setError('No se pudieron cargar los pacientes.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void init();

    return () => {
      active = false;
      requestId.current++;
    };
  }, []);

  // Consultas subsecuentes por cambio de filtros de usuario
  useEffect(() => {
    if (!initialLoadedRef.current) return;
    void loadPatients();

    return () => {
      requestId.current++;
    };
  }, [page, appliedSearch, statusFilter, selectedSalita]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  // Actualización reactiva en tiempo real ante eventos de pacientes
  useEffect(() => {
    if (!initialLoadedRef.current || !ultimoEventoPaciente) return;

    if (ultimoEventoPaciente.tipo === 'PACIENTE_ESTADO_CAMBIADO') {
      setPatients((prev) =>
        prev.map((p) =>
          p.id_paciente === ultimoEventoPaciente.id_paciente
            ? { ...p, activo: Boolean(ultimoEventoPaciente.activo) }
            : p
        )
      );
    }

    // Revalidación silenciosa en segundo plano
    void loadPatients(true);
  }, [ultimoEventoPaciente]);

  // Resincronización al reconectar el socket
  useEffect(() => {
    if (resyncTick > 0 && initialLoadedRef.current) {
      void loadPatients(true);
    }
  }, [resyncTick]);

  const handleStatusChange = async (
    patient: Patient,
  ) => {
    setConfirmTarget(patient);
  };

  const confirmStatusChange = async () => {
    if (!confirmTarget) {
      return;
    }

    try {
      setConfirming(true);
      setError('');

      await updatePatientStatus(
        confirmTarget.id_paciente,
        !confirmTarget.activo,
      );

      setConfirmTarget(null);
      await loadPatients();
    } catch (error) {
      console.error(error);

      setError(
        'No se pudo actualizar el estado del paciente.',
      );
    } finally {
      setConfirming(false);
    }
  };

  const handleViewPatient = (id: string) => {
    navigate(`/pacientes/${id}`);
  };

  return (
    <div>
      {confirmTarget && (
        <ConfirmationModal
          open
          title={confirmTarget.activo ? 'Desactivar paciente' : 'Activar paciente'}
          subtitle="Esta acción requiere confirmación."
          message={confirmTarget.activo ? '¿Querés desactivar al paciente?' : '¿Querés volver a activar al paciente?'}
          detail={
            <>
              <div className="fw-semibold">
                {confirmTarget.apellidos}, {confirmTarget.nombres}
              </div>

              <div className="text-muted small mt-1">
                DNI: {confirmTarget.dni}
              </div>
            </>
          }
          confirmText={confirmTarget.activo ? 'Desactivar paciente' : 'Activar paciente'}
          cancelText="Cancelar"
          variant={confirmTarget.activo ? 'danger' : 'success'}
          icon={confirmTarget.activo ? 'bi-person-dash' : 'bi-person-check'}
          loading={confirming}
          onClose={() => setConfirmTarget(null)}
          onConfirm={() => void confirmStatusChange()}
        />
      )}

      {/* ENCABEZADO */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 mb-md-4">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h2 className="fw-bold mb-0 text-dark fs-4 fs-md-3">
              Pacientes
            </h2>
            <ConnectionStatusBadge />
            {refreshing && (
              <span
                className="spinner-border spinner-border-sm text-secondary"
                role="status"
                title="Actualizando datos en segundo plano..."
              />
            )}
          </div>

          <p className="text-muted small mb-0 d-none d-sm-block">
            Administración de pacientes registrados.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-saps btn-sm py-2 px-3 d-inline-flex align-items-center gap-1.5"
          onClick={() =>
            navigate('/pacientes/nuevo')
          }
        >
          <i className="bi bi-person-plus" />
          <span>Nuevo paciente</span>
        </button>
      </div>

      {/* MENSAJES FLOTANTES CENTRALIZADOS */}
      {success && (
        <FloatingFeedbackToast
          variant="success"
          message={success}
          onDismiss={() => setSuccess('')}
        />
      )}
      {error && (
        <FloatingFeedbackToast
          variant="error"
          message={error}
          onDismiss={() => setError('')}
        />
      )}

      {/* BUSCADOR Y FILTROS */}
      <div className="card border-0 shadow-sm mb-3 mb-md-4">
        <div className="card-body p-3">
          <div className="row g-2 g-md-3">

            <div className="col-12 col-md-5">
              <label className="form-label small fw-semibold text-secondary mb-1">
                Buscar
              </label>

              <div className="input-group">
                <span className="input-group-text bg-white border-end-0 text-muted">
                  <i className="bi bi-search" />
                </span>

                <input
                  type="search"
                  className="form-control border-start-0 ps-0"
                  placeholder="DNI, apellido o nombre..."
                  aria-label="Buscar paciente por DNI, apellido o nombre completo"
                  maxLength={150}
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </div>
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label small fw-semibold text-secondary mb-1">
                Estado
              </label>

              <select
                className="form-select form-select-sm"
                value={statusFilter}
                aria-label="Filtrar pacientes por estado"
                onChange={(event) => {
                  setStatusFilter(
                    event.target.value as PatientStatusFilter,
                  );
                  setPage(1);
                }}
              >
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
                <option value="todos">Todos</option>
              </select>
            </div>

            <div className="col-6 col-md-4">
              <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="filtro-salita">
                Salita
              </label>

              <select
                id="filtro-salita"
                className="form-select form-select-sm"
                value={selectedSalita}
                aria-label="Filtrar pacientes por salita"
                onChange={(event) => {
                  setSelectedSalita(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todas las salitas</option>
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

      {/* CONTENEDOR DE PACIENTES: MÓVIL Y ESCRITORIO */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">

          {loading && patients.length === 0 ? (
            <div className="text-center py-5">
              <div
                className="spinner-border text-success"
                role="status"
              >
                <span className="visually-hidden">
                  Cargando...
                </span>
              </div>
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-5 text-muted">
              No hay pacientes para mostrar.
            </div>
          ) : (
            <>
              {/* VISTA MÓVIL: TARJETAS RESPONSIVE ESPECÍFICAS (< 768px) */}
              <div className="d-md-none p-2.5 p-sm-3 d-flex flex-column gap-2.5">
                {patients.map((patient) => (
                  <article
                    key={patient.id_paciente}
                    className="patient-mobile-card bg-white border rounded-3 p-3 shadow-xs position-relative"
                    style={{
                      borderLeft: `4px solid ${patient.activo ? '#16a34a' : '#94a3b8'}`,
                    }}
                  >
                    {/* Fila 1: Nombre (principal), DNI (secundario), Estado (badge) */}
                    <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                      <div className="min-w-0 flex-grow-1">
                        <h6 className="fw-bold text-dark mb-0.5 text-truncate" style={{ fontSize: '15px' }}>
                          {patient.apellidos}, {patient.nombres}
                        </h6>
                        <div className="text-muted d-flex flex-wrap align-items-center gap-1.5" style={{ fontSize: '12px' }}>
                          <span>DNI {patient.dni}</span>
                          {patient.cuenta && (
                            <span
                              className="badge bg-success-subtle text-success border border-success-subtle py-0.5 px-1.5 rounded-pill"
                              style={{ fontSize: '10.5px' }}
                            >
                              <i className="bi bi-person-check me-0.5" />
                              Cuenta digital
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`badge rounded-pill flex-shrink-0 ${
                          patient.activo
                            ? 'bg-success-subtle text-success border border-success-subtle'
                            : 'bg-secondary-subtle text-secondary border border-secondary-subtle'
                        }`}
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                      >
                        {patient.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    {/* Fila 2: Información secundaria en barra compacta (Teléfono y Obra social) */}
                    <div className="row g-2 py-1.5 px-2 my-1 border rounded-2 bg-light text-dark" style={{ fontSize: '12px' }}>
                      <div className="col-6">
                        <span className="text-muted d-block small" style={{ fontSize: '10px' }}>Teléfono</span>
                        {patient.telefono ? (
                          <a
                            href={`tel:${patient.telefono}`}
                            className="text-dark text-decoration-none fw-medium text-truncate d-inline-flex align-items-center gap-1"
                          >
                            <i className="bi bi-telephone text-success" />
                            <span>{patient.telefono}</span>
                          </a>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </div>

                      <div className="col-6">
                        <span className="text-muted d-block small" style={{ fontSize: '10px' }}>Obra social</span>
                        <span className="text-dark fw-medium text-truncate d-block">
                          <i className="bi bi-shield-check text-secondary me-1" />
                          {patient.obra_social || 'Sin obra social'}
                        </span>
                      </div>
                    </div>

                    {/* Fila 3: Acciones con nombre claro y botones táctiles */}
                    <div className="d-flex flex-wrap gap-1.5 pt-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center gap-1.5 flex-fill py-1.5 px-2"
                        onClick={() => handleViewPatient(patient.id_paciente)}
                      >
                        <i className="bi bi-eye" />
                        <span className="fw-medium">Ver ficha</span>
                      </button>

                      <Link
                        to={`/turnos?search=${patient.dni}`}
                        className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center gap-1.5 flex-fill py-1.5 px-2"
                      >
                        <i className="bi bi-calendar3" />
                        <span className="fw-medium">Turnos</span>
                      </Link>

                      {permissions.includes('VER_HISTORIA_CLINICA') && (
                        <Link
                          to={`/historia-clinica/pacientes/${patient.id_paciente}?salita=${encodeURIComponent(patient.id_salita_asignada)}`}
                          className="btn btn-sm btn-outline-success d-inline-flex align-items-center justify-content-center gap-1.5 flex-fill py-1.5 px-2"
                        >
                          <i className="bi bi-journal-medical" />
                          <span className="fw-medium">Historia</span>
                        </Link>
                      )}

                      <button
                        type="button"
                        className={`btn btn-sm ${
                          patient.activo
                            ? 'btn-outline-danger'
                            : 'btn-outline-success'
                        } d-inline-flex align-items-center justify-content-center gap-1.5 py-1.5 px-2`}
                        title={patient.activo ? 'Desactivar paciente' : 'Activar paciente'}
                        onClick={() => void handleStatusChange(patient)}
                      >
                        <i className={`bi ${patient.activo ? 'bi-person-dash' : 'bi-person-check'}`} />
                        <span className="fw-medium">{patient.activo ? 'Desactivar' : 'Activar'}</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {/* VISTA ESCRITORIO: TABLA COMPLETA (>= 768px) */}
              <div className="d-none d-md-block table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th scope="col" style={{ width: '15%' }}>DNI</th>
                      <th scope="col" style={{ width: '30%' }}>Paciente</th>
                      <th scope="col" style={{ width: '15%' }}>Teléfono</th>
                      <th scope="col" style={{ width: '15%' }}>Obra social</th>
                      <th scope="col" style={{ width: '10%' }}>Estado</th>
                      <th scope="col" className="text-end" style={{ width: '15%' }}>
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {patients.map((patient) => (
                      <tr
                        key={patient.id_paciente}
                      >
                        <td>
                          <span className="fw-semibold text-dark">{patient.dni}</span>
                        </td>

                        <td>
                          <strong className="text-dark d-block">
                            {patient.apellidos},{' '}
                            {patient.nombres}
                          </strong>
                          <AccountSummary account={patient.cuenta} />
                        </td>

                        <td>
                          {patient.telefono || '—'}
                        </td>

                        <td>
                          {patient.obra_social || '—'}
                        </td>

                        <td>
                          <span
                            className={`badge rounded-pill ${
                              patient.activo
                                ? 'bg-success-subtle text-success border border-success-subtle'
                                : 'bg-secondary-subtle text-secondary border border-secondary-subtle'
                            }`}
                          >
                            {patient.activo
                              ? 'Activo'
                              : 'Inactivo'}
                          </span>
                        </td>

                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-1.5">

                            {/* VER FICHA */}
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              title="Ver ficha del paciente"
                              onClick={() =>
                                handleViewPatient(
                                  patient.id_paciente,
                                )
                              }
                            >
                              <i className="bi bi-eye" />
                            </button>

                            {/* TURNOS */}
                            <Link
                              to={`/turnos?search=${patient.dni}`}
                              className="btn btn-sm btn-outline-secondary"
                              title="Ver turnos del paciente"
                            >
                              <i className="bi bi-calendar3" />
                            </Link>

                            {/* HISTORIA CLÍNICA (SI ESTÁ AUTORIZADO) */}
                            {permissions.includes('VER_HISTORIA_CLINICA') && (
                              <Link
                                to={`/historia-clinica/pacientes/${patient.id_paciente}?salita=${encodeURIComponent(patient.id_salita_asignada)}`}
                                className="btn btn-sm btn-outline-success"
                                title="Ver historia clínica"
                              >
                                <i className="bi bi-journal-medical" />
                              </Link>
                            )}

                            {/* ACTIVAR / DESACTIVAR */}
                            <button
                              type="button"
                              className={`btn btn-sm ${
                                patient.activo
                                  ? 'btn-outline-danger'
                                  : 'btn-outline-success'
                              }`}
                              title={
                                patient.activo
                                  ? 'Desactivar paciente'
                                  : 'Activar paciente'
                              }
                              onClick={() =>
                                void handleStatusChange(
                                  patient,
                                )
                              }
                            >
                              <i
                                className={`bi ${
                                  patient.activo
                                    ? 'bi-person-dash'
                                    : 'bi-person-check'
                                }`}
                              />
                            </button>

                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* PAGINACIÓN */}
        {pagination && pagination.totalPages > 1 && (
          <div className="card-footer bg-white border-0 py-3">
            <PaginationControls
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={(newPage) => setPage(newPage)}
              loading={refreshing}
              itemLabel="pacientes"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PacientesPage;
