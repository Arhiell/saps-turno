import {
  useEffect,
  useState,
} from 'react';

import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import ConnectionStatusBadge from '../../components/ui/ConnectionStatusBadge';
import { FloatingFeedbackToast } from '../../components/ui/FormFeedback';
import { useAutoDismiss } from '../../utils/useAutoDismiss';
import { getBarrios } from '../../services/barrios.service';
import { getSalitas } from '../../services/salitas.service';
import type { Barrio } from '../../types/barrio.types';
import type { Salita } from '../../types/salita.types';

import PatientAccountPanel from '../../components/ui/PatientAccountPanel';
import PatientTutorsPanel from '../../components/ui/PatientTutorsPanel';
import PatientEditModal from '../../components/ui/PatientEditModal';
import ConfirmationModal from '../../components/ui/ConfirmationModal';

import {
  getPatientById,
  updatePatient,
  updatePatientStatus,
} from '../../services/patients.service';

import type {
  Patient,
  UpdatePatientRequest,
} from '../../types/patient.types';

import {
  authError,
} from '../../utils/auth-errors';

import {
  calculateAge,
} from '../../utils/kinship';

const formatSexo = (sexo?: string | null): string => {
  switch (sexo) {
    case 'FEMENINO':
      return 'Femenino';
    case 'MASCULINO':
      return 'Masculino';
    case 'X':
      return 'X';
    case 'NO_INFORMA':
      return 'No informa';
    default:
      return 'No informado';
  }
};

const formatFecha = (fecha?: string | null): string => {
  if (!fecha) return 'No informada';
  const parts = fecha.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return fecha;
};

const PacienteDetallePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { permissions } = useAuth();
  const { ultimoEventoPaciente, resyncTick } = useAgendaSocket();

  // Datos del paciente y catálogos territoriales.
  const [patient, setPatient] = useState<Patient | null>(null);
  const [barrios, setBarrios] = useState<Barrio[]>([]);
  const [salitas, setSalitas] = useState<Salita[]>([]);

  // Control del modal de edición.
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Estados de carga y guardado.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Mensajes mostrados al usuario.
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [success, setSuccess] = useState('');

  // Control de confirmación de activación / desactivación.
  const [confirmTarget, setConfirmTarget] = useState<Patient | null>(null);

  // Feedback unificado de 15 segundos.
  useAutoDismiss(success, setSuccess, 15_000, Boolean(success));
  useAutoDismiss(error, setError, 15_000, Boolean(error));

  useEffect(() => {
    void Promise.all([
      getBarrios().then((r) => setBarrios(r.data.barrios)).catch(() => undefined),
      getSalitas().then((r) => setSalitas(r.data)).catch(() => undefined),
    ]);
  }, []);

  // Carga los datos del paciente.
  const loadPatient = async (silent = false) => {
    if (!id) {
      setError('Paciente inválido.');
      setLoading(false);
      return;
    }

    try {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError('');

      const response = await getPatientById(id);
      const pat = response.data.patient;
      setPatient((current) => ({
        ...pat,
        cuenta: pat.cuenta ?? current?.cuenta,
      }));
    } catch (err) {
      console.error(err);
      if (!silent) {
        setError('No se pudo cargar el paciente.');
      }
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  // Recarga el paciente cuando cambia el identificador.
  useEffect(() => {
    void loadPatient();
  }, [id]);

  // Actualización reactiva en tiempo real ante eventos del paciente
  useEffect(() => {
    if (!ultimoEventoPaciente) return;
    if (ultimoEventoPaciente.id_paciente !== id) return;

    if (ultimoEventoPaciente.tipo === 'PACIENTE_ESTADO_CAMBIADO') {
      setPatient((curr) =>
        curr ? { ...curr, activo: Boolean(ultimoEventoPaciente.activo) } : curr
      );
    }

    if (!editModalOpen) {
      void loadPatient(true);
    }
  }, [ultimoEventoPaciente]);

  // Resincronización al reconectar el socket
  useEffect(() => {
    if (resyncTick > 0 && !editModalOpen) {
      void loadPatient(true);
    }
  }, [resyncTick]);

  // Guarda los cambios del paciente enviados desde el modal de edición.
  const handleSavePatient = async (form: UpdatePatientRequest) => {
    if (!id) return;

    try {
      setSaving(true);
      setModalError('');
      setError('');
      setSuccess('');

      const response = await updatePatient(id, form);

      // Conserva los datos de cuenta si la actualización no los devuelve.
      setPatient((current) => ({
        ...response.data.patient,
        cuenta: response.data.patient.cuenta ?? current?.cuenta,
      }));

      setEditModalOpen(false);
      setSuccess('Los datos del paciente se actualizaron correctamente.');
    } catch (err) {
      console.error(err);
      setModalError(authError(err));
    } finally {
      setSaving(false);
    }
  };

  // Solicita confirmación antes de cambiar el estado de activación.
  const handleStatusChange = () => {
    if (!patient) return;
    setConfirmTarget(patient);
  };

  // Activa o desactiva al paciente.
  const confirmStatusChange = async () => {
    if (!confirmTarget) return;

    try {
      setConfirming(true);
      setError('');
      setSuccess('');

      const response = await updatePatientStatus(
        confirmTarget.id_paciente,
        !confirmTarget.activo
      );

      // Conserva los datos de cuenta si la respuesta no los incluye.
      setPatient((current) => ({
        ...response.data.patient,
        cuenta: response.data.patient.cuenta ?? current?.cuenta,
      }));

      const isActivo = response.data.patient.activo;
      setConfirmTarget(null);
      setSuccess(`Paciente ${isActivo ? 'activado' : 'desactivado'} correctamente.`);
    } catch (err) {
      console.error(err);
      setError('No se pudo actualizar el estado del paciente.');
    } finally {
      setConfirming(false);
    }
  };

  // Muestra un indicador mientras se carga el paciente.
  if (loading && !patient) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  // Muestra el error cuando el paciente no existe.
  if (!patient) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger" role="alert">
          {error || 'Paciente no encontrado.'}
        </div>

        <button
          type="button"
          className="btn btn-saps"
          onClick={() => navigate('/pacientes')}
        >
          <i className="bi bi-arrow-left me-2" />
          Volver a pacientes
        </button>
      </div>
    );
  }

  const assignedSalita = salitas.find((s) => s.id_salita === patient.id_salita_asignada);
  const declaredBarrio = barrios.find((b) => b.id_barrio === patient.id_barrio);
  const age = calculateAge(patient.fecha_nacimiento);

  return (
    <div className="patient-detail-page pb-5">
      {/* Modal de edición */}
      {editModalOpen && (
        <PatientEditModal
          open={editModalOpen}
          patient={patient}
          saving={saving}
          error={modalError}
          onClose={() => {
            setEditModalOpen(false);
            setModalError('');
          }}
          onSave={handleSavePatient}
        />
      )}

      {/* Modal de confirmación para activar/desactivar */}
      {confirmTarget && (
        <ConfirmationModal
          open
          title={confirmTarget.activo ? 'Desactivar paciente' : 'Activar paciente'}
          subtitle="Esta acción requiere confirmación."
          message={
            confirmTarget.activo
              ? '¿Querés desactivar al paciente?'
              : '¿Querés volver a activar al paciente?'
          }
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

      {/* Feedbacks flotantes */}
      {error && (
        <FloatingFeedbackToast
          variant="error"
          message={error}
          onDismiss={() => setError('')}
        />
      )}

      {success && (
        <FloatingFeedbackToast
          variant="success"
          message={success}
          onDismiss={() => setSuccess('')}
        />
      )}

      {/* SECCIÓN 1: ENCABEZADO Y JERARQUÍA DE ACCIONES */}
      <div className="mb-4">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 mb-3"
          onClick={() => navigate('/pacientes')}
        >
          <i className="bi bi-arrow-left" />
          Volver a pacientes
        </button>

        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
              <h2 className="fw-bold mb-0 text-dark">
                {patient.apellidos}, {patient.nombres}
              </h2>

              <span
                className={`badge rounded-pill ${
                  patient.activo
                    ? 'bg-success-subtle text-success border border-success-subtle'
                    : 'bg-danger-subtle text-danger border border-danger-subtle'
                }`}
              >
                <i className={`bi ${patient.activo ? 'bi-check-circle-fill' : 'bi-slash-circle'} me-1`} />
                {patient.activo ? 'Activo' : 'Inactivo'}
              </span>

              <ConnectionStatusBadge />

              {refreshing && (
                <span
                  className="spinner-border spinner-border-sm text-secondary"
                  role="status"
                  title="Actualizando datos en segundo plano..."
                />
              )}
            </div>

            <div className="text-muted small d-flex flex-wrap align-items-center gap-3">
              <span>
                <strong className="text-dark">DNI:</strong> {patient.dni}
              </span>
              {patient.id_paciente && (
                <span className="text-muted">
                  Ref: #{patient.id_paciente.replace(/-/g, '').slice(-6).toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Acciones principales organizadas */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            {/* Historia clínica - Prioridad de atención médica */}
            {permissions.includes('VER_HISTORIA_CLINICA') && (
              <Link
                to={`/historia-clinica/pacientes/${patient.id_paciente}?salita=${encodeURIComponent(patient.id_salita_asignada)}`}
                className="btn btn-success d-inline-flex align-items-center gap-2 shadow-sm"
                title="Consultar historia clínica del paciente"
              >
                <i className="bi bi-journal-medical" />
                <span>Historia clínica</span>
              </Link>
            )}

            {/* Turnos del paciente */}
            <Link
              to={`/turnos?search=${patient.dni}`}
              className="btn btn-outline-success d-inline-flex align-items-center gap-2"
              title="Ver agenda y turnos del paciente"
            >
              <i className="bi bi-calendar3" />
              <span>Turnos</span>
            </Link>

            {/* Editar paciente */}
            <button
              type="button"
              className="btn btn-outline-primary d-inline-flex align-items-center gap-2"
              onClick={() => {
                setModalError('');
                setEditModalOpen(true);
              }}
              title="Editar datos del paciente"
            >
              <i className="bi bi-pencil" />
              <span>Editar paciente</span>
            </button>

            {/* Desactivar / Activar - Acción administrativa discreta */}
            <button
              type="button"
              className={`btn btn-sm ${
                patient.activo
                  ? 'btn-outline-danger'
                  : 'btn-outline-success'
              } d-inline-flex align-items-center gap-1 ms-lg-2`}
              onClick={handleStatusChange}
              title={patient.activo ? 'Desactivar paciente' : 'Activar paciente'}
            >
              <i className={`bi ${patient.activo ? 'bi-person-dash' : 'bi-person-check'}`} />
              <span>{patient.activo ? 'Desactivar' : 'Activar'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: INFORMACIÓN PERSONAL Y DE CONTACTO */}
      <section className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white py-3 border-bottom">
          <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
            <i className="bi bi-person text-success" />
            Información personal y de contacto
          </h5>
        </div>

        <div className="card-body">
          <div className="row g-3">
            <div className="col-sm-6 col-md-3">
              <span className="text-muted small d-block mb-1">DNI</span>
              <span className="fw-semibold text-dark">{patient.dni}</span>
            </div>

            <div className="col-sm-6 col-md-3">
              <span className="text-muted small d-block mb-1">Fecha de nacimiento</span>
              <span className="fw-semibold text-dark">
                {formatFecha(patient.fecha_nacimiento)}
                {age !== null && (
                  <span className="text-muted fw-normal small ms-1.5">
                    ({age} {age === 1 ? 'año' : 'años'})
                  </span>
                )}
              </span>
            </div>

            <div className="col-sm-6 col-md-3">
              <span className="text-muted small d-block mb-1">Sexo</span>
              <span className="fw-semibold text-dark">{formatSexo(patient.sexo)}</span>
            </div>

            <div className="col-sm-6 col-md-3">
              <span className="text-muted small d-block mb-1">Teléfono</span>
              {patient.telefono ? (
                <a
                  href={`tel:${patient.telefono}`}
                  className="fw-semibold text-decoration-none text-dark d-inline-flex align-items-center gap-1"
                >
                  <i className="bi bi-telephone text-success small" />
                  {patient.telefono}
                </a>
              ) : (
                <span className="text-muted">No informado</span>
              )}
            </div>

            <div className="col-sm-6 col-md-4">
              <span className="text-muted small d-block mb-1">Correo electrónico</span>
              {patient.email ? (
                <a
                  href={`mailto:${patient.email}`}
                  className="fw-semibold text-decoration-none text-primary d-inline-flex align-items-center gap-1 text-break"
                >
                  <i className="bi bi-envelope text-primary small" />
                  {patient.email}
                </a>
              ) : (
                <span className="text-muted">No informado</span>
              )}
            </div>

            <div className="col-sm-6 col-md-4">
              <span className="text-muted small d-block mb-1">Dirección</span>
              <span className="fw-semibold text-dark">
                {patient.direccion || <span className="text-muted fw-normal">No informada</span>}
              </span>
            </div>

            <div className="col-sm-6 col-md-4">
              <span className="text-muted small d-block mb-1">Localidad y provincia</span>
              <span className="fw-semibold text-dark">
                {patient.localidad || patient.provincia ? (
                  `${patient.localidad || ''}${patient.localidad && patient.provincia ? ', ' : ''}${patient.provincia || ''}${patient.codigo_postal ? ` (CP ${patient.codigo_postal})` : ''}`
                ) : (
                  <span className="text-muted fw-normal">No informada</span>
                )}
              </span>
            </div>

            <div className="col-12 border-top pt-3 mt-3">
              <span className="text-muted small d-block mb-1">Contacto de emergencia</span>
              {patient.contacto_emergencia_nombre || patient.contacto_emergencia_telefono ? (
                <div className="p-2.5 px-3 bg-light rounded-3 border d-inline-flex flex-wrap align-items-center gap-2">
                  <i className="bi bi-telephone-plus text-danger" />
                  <span className="fw-semibold text-dark">
                    {patient.contacto_emergencia_nombre || 'Contacto designado'}
                  </span>
                  {patient.contacto_emergencia_telefono && (
                    <>
                      <span className="text-muted">·</span>
                      <a
                        href={`tel:${patient.contacto_emergencia_telefono}`}
                        className="text-decoration-none text-dark fw-medium"
                      >
                        {patient.contacto_emergencia_telefono}
                      </a>
                    </>
                  )}
                </div>
              ) : (
                <span className="text-muted small">Sin contacto de emergencia registrado</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 3: INFORMACIÓN SANITARIA */}
      <section className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white py-3 border-bottom">
          <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
            <i className="bi bi-clipboard2-pulse text-success" />
            Información sanitaria
          </h5>
        </div>

        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <span className="text-muted small d-block mb-1">Obra social / Cobertura</span>
              <div className="p-2.5 px-3 bg-light rounded-3 border fw-semibold text-dark">
                <i className="bi bi-shield-check text-success me-2" />
                {patient.obra_social || 'Pública / Sin obra social declarada'}
              </div>
            </div>

            <div className="col-md-4">
              <span className="text-muted small d-block mb-1">Número de afiliado</span>
              <div className="p-2.5 px-3 bg-light rounded-3 border fw-semibold text-dark">
                <i className="bi bi-card-text text-secondary me-2" />
                {patient.numero_afiliado || <span className="text-muted fw-normal">No informado</span>}
              </div>
            </div>

            <div className="col-md-4">
              <span className="text-muted small d-block mb-1">Salita de cabecera</span>
              <div className="p-2.5 px-3 bg-light rounded-3 border fw-semibold text-dark">
                <i className="bi bi-hospital text-success me-2" />
                {assignedSalita?.nombre || 'Salita asignada'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 4: COBERTURA TERRITORIAL Y SALITA ASIGNADA */}
      <section className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white py-3 border-bottom">
          <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
            <i className="bi bi-geo-alt text-success" />
            Cobertura territorial y salita asignada
          </h5>
        </div>

        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label text-muted small mb-1">Salita asignada de cabecera</label>
              <div className="p-3 bg-light rounded-3 border text-dark">
                <div className="fw-semibold d-flex align-items-center gap-2 mb-1">
                  <i className="bi bi-hospital text-success fs-5" />
                  <span>{assignedSalita?.nombre || 'Salita asignada'}</span>
                </div>
                {assignedSalita?.direccion ? (
                  <div className="text-muted small ps-4">
                    Dirección: {assignedSalita.direccion}
                  </div>
                ) : (
                  <div className="text-muted small ps-4">
                    Centro de atención primaria municipal
                  </div>
                )}
              </div>
            </div>

            <div className="col-md-6">
              <label className="form-label text-muted small mb-1">Barrio declarado</label>
              <div className="p-3 bg-light rounded-3 border text-dark">
                <div className="fw-semibold d-flex align-items-center gap-2 mb-1">
                  <i className="bi bi-pin-map text-primary fs-5" />
                  <span>{declaredBarrio?.nombre || 'Barrio declarado'}</span>
                </div>
                <div className="text-muted small ps-4">
                  Zona de cobertura sanitaria municipal de Corrientes
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 5: CUENTA DIGITAL DEL PACIENTE (Única instancia) */}
      <PatientAccountPanel
        patient={patient}
        onLinked={() => void loadPatient(true)}
      />

      {/* SECCIÓN 6: TUTORES Y REPRESENTANTES AUTORIZADOS */}
      <PatientTutorsPanel
        patientId={patient.id_paciente}
      />
    </div>
  );
};

export default PacienteDetallePage;
