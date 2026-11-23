import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CLINICAL_PERMISSIONS } from '../../types/historia-clinica.types';
import type { ClinicalNavState } from '../../utils/historia-clinica-navigation';
import type { Turno } from '../../types/turno.types';
import { getEstadoClass } from '../../utils/turno-status';
import { changeTurnoStatus } from '../../services/turnos.service';
import { authError } from '../../utils/auth-errors';
import { useAutoDismiss } from '../../utils/useAutoDismiss';
import ProfessionalTurnoHistory from './ProfessionalTurnoHistory';

interface PatientTurnoDetailModalProps {
  turno: Turno | null;
  onClose: () => void;
  onStatusChanged?: () => void;
  clinicalOriginState?: ClinicalNavState;
}

export default function PatientTurnoDetailModal({
  turno,
  onClose,
  onStatusChanged,
  clinicalOriginState,
}: PatientTurnoDetailModalProps) {
  const [busy, setBusy] = useState(false);
  const { hasPermission } = useAuth();
  const canViewHC = hasPermission(CLINICAL_PERMISSIONS.VER_HISTORIA_CLINICA);
  const canCreateConsulta = hasPermission(CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setError('');
    setSuccess('');
  }, [turno?.id_turno]);

  useAutoDismiss(success, setSuccess);
  useAutoDismiss(error, setError);

  // Soporte accesible para tecla Escape
  useEffect(() => {
    if (!turno) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [turno, busy, onClose]);

  if (!turno) return null;

  const pacientePersona = turno.paciente?.persona;
  const nombreCompleto = pacientePersona
    ? `${pacientePersona.apellidos} ${pacientePersona.nombres}`
    : 'Paciente sin datos registrados';

  const formatFechaHora = (fechaHoraStr: string) => {
    try {
      return new Date(fechaHoraStr).toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        dateStyle: 'full',
        timeStyle: 'short',
      });
    } catch {
      return fechaHoraStr;
    }
  };

  const handleMarcarEstado = async (nuevoEstado: 'ATENDIDO' | 'NO_ASISTIO') => {
    if (busy) return;
    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await changeTurnoStatus(turno.id_turno, { estado: nuevoEstado });
      setSuccess(
        nuevoEstado === 'ATENDIDO'
          ? 'Turno marcado como Atendido con éxito.'
          : 'Turno marcado como No asistió con éxito.'
      );
      turno.estado.codigo = nuevoEstado;
      turno.estado.nombre = nuevoEstado === 'ATENDIDO' ? 'Atendido' : 'No asistió';
      turno.estado.es_estado_final = true;
      setRevision((r) => r + 1);
      if (onStatusChanged) {
        onStatusChanged();
      }
    } catch (cause) {
      setError(authError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="turno-detail-modal-title"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(3px)', zIndex: 1055 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          {/* Header del Modal */}
          <div className="modal-header bg-light border-bottom px-4 py-3 align-items-center">
            <div className="d-flex align-items-center flex-wrap gap-2">
              <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                Ficha del Turno y Paciente
              </span>
              <span className={getEstadoClass(turno.estado.codigo)}>
                {turno.estado.nombre}
              </span>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Cerrar ventana"
              disabled={busy}
              onClick={onClose}
            />
          </div>

          {/* Cuerpo del Modal */}
          <div className="modal-body p-3 p-md-4">
            {error && (
              <div className="alert alert-danger d-flex align-items-center justify-content-between gap-2 mb-3" role="alert">
                <div className="d-flex align-items-center flex-wrap gap-2">
                  <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
                  <div>{error}</div>
                </div>
                <button
                  type="button"
                  className="btn-close flex-shrink-0"
                  aria-label="Cerrar aviso"
                  onClick={() => setError('')}
                />
              </div>
            )}

            {success && (
              <div className="alert alert-success d-flex align-items-center justify-content-between gap-2 mb-3" role="status">
                <div className="d-flex align-items-center flex-wrap gap-2">
                  <i className="bi bi-check-circle-fill" aria-hidden="true" />
                  <div>{success}</div>
                </div>
                <button
                  type="button"
                  className="btn-close flex-shrink-0"
                  aria-label="Cerrar aviso"
                  onClick={() => setSuccess('')}
                />
              </div>
            )}

            {/* Ficha Paciente */}
            <div className="d-flex flex-wrap align-items-center gap-3 p-3 bg-light rounded-3 border mb-4">
              <div
                className="d-flex align-items-center justify-content-center bg-white rounded-circle border shadow-sm text-success flex-shrink-0"
                style={{ width: '56px', height: '56px', fontSize: '1.75rem' }}
              >
                <i className="bi bi-person-fill" aria-hidden="true" />
              </div>
              <div className="flex-grow-1 min-w-0">
                <h3 id="turno-detail-modal-title" className="h5 mb-1 text-dark fw-bold text-truncate">
                  {nombreCompleto}
                </h3>
                <div className="d-flex flex-wrap gap-3 text-secondary small">
                  <span>
                    <strong className="text-dark">DNI:</strong> {pacientePersona?.dni || 'Sin informar'}
                  </span>
                  <span>
                    <strong className="text-dark">Código:</strong>{' '}
                    <span className="badge bg-white text-secondary border font-monospace">
                      {turno.codigo_turno}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Cuadrícula de Datos del Turno */}
            <div className="row g-3 mb-4">
              <div className="col-12 col-md-6">
                <div className="p-3 border rounded-3 h-100 bg-white">
                  <span className="text-muted small text-uppercase fw-bold d-block mb-1">
                    <i className="bi bi-calendar3 me-1 text-primary" aria-hidden="true" />
                    Fecha y Horario
                  </span>
                  <div className="fw-semibold text-dark">
                    {formatFechaHora(turno.fecha_hora_inicio)}
                  </div>
                  {turno.fecha_hora_fin && (
                    <small className="text-muted">
                      Hasta las{' '}
                      {new Date(turno.fecha_hora_fin).toLocaleTimeString('es-AR', {
                        timeZone: 'America/Argentina/Buenos_Aires',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      hs
                    </small>
                  )}
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="p-3 border rounded-3 h-100 bg-white">
                  <span className="text-muted small text-uppercase fw-bold d-block mb-1">
                    <i className="bi bi-hospital me-1 text-success" aria-hidden="true" />
                    Salita y Especialidad
                  </span>
                  <div className="fw-semibold text-dark">
                    {turno.salita?.nombre || 'Salita sin informar'}
                  </div>
                  <div className="small text-secondary">
                    {turno.especialidad?.nombre || 'Especialidad sin informar'}
                    {turno.salita?.direccion && ` · ${turno.salita.direccion}`}
                  </div>
                </div>
              </div>

              <div className="col-12">
                <div className="p-3 border rounded-3 bg-white">
                  <span className="text-muted small text-uppercase fw-bold d-block mb-1">
                    <i className="bi bi-chat-left-text me-1 text-info" aria-hidden="true" />
                    Motivo de Consulta
                  </span>
                  <p className="mb-0 text-dark">
                    {turno.motivo_consulta || (
                      <em className="text-muted">No se especificó motivo de consulta al solicitar el turno.</em>
                    )}
                  </p>
                </div>
              </div>

              {turno.observaciones && (
                <div className="col-12">
                  <div className="p-3 border rounded-3 bg-white">
                    <span className="text-muted small text-uppercase fw-bold d-block mb-1">
                      <i className="bi bi-clipboard2-pulse me-1 text-warning" aria-hidden="true" />
                      Observaciones
                    </span>
                    <p className="mb-0 text-dark">{turno.observaciones}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Historial de cambios */}
            <div className="border-top pt-3">
              <h4 className="h6 text-secondary mb-2 fw-bold d-flex align-items-center gap-1">
                <i className="bi bi-clock-history text-secondary" aria-hidden="true" />
                Historial de movimientos del turno
              </h4>
              <ProfessionalTurnoHistory turnoId={turno.id_turno} revision={revision} />
            </div>
          </div>

          {/* Footer con Acciones de Atención */}
          <div className="modal-footer bg-light border-top px-4 py-3 justify-content-between flex-wrap gap-2">
            <div className="d-flex flex-wrap gap-2">
              {canViewHC && turno.paciente?.id_paciente && (
                <Link
                  to={`/historia-clinica/pacientes/${turno.paciente.id_paciente}${turno.salita?.id_salita ? `?salita=${encodeURIComponent(turno.salita.id_salita)}` : ''}`}
                  state={clinicalOriginState}
                  className="btn btn-outline-primary btn-sm px-3"
                >
                  <i className="bi bi-journal-medical me-1" aria-hidden="true" />
                  Historia Clínica
                </Link>
              )}
              {canCreateConsulta && turno.paciente?.id_paciente && (
                <Link
                  to={`/historia-clinica/pacientes/${turno.paciente.id_paciente}/nueva-consulta?${new URLSearchParams({
                    ...(turno.salita?.id_salita ? { salita: turno.salita.id_salita } : {}),
                    turno: turno.id_turno,
                  }).toString()}`}
                  state={clinicalOriginState}
                  className="btn btn-primary btn-sm px-3"
                >
                  <i className="bi bi-file-earmark-plus me-1" aria-hidden="true" />
                  Nueva consulta
                </Link>
              )}
            </div>

            <div className="d-flex align-items-center flex-wrap gap-2 ms-auto">
              {!turno.estado.es_estado_final && (
                <>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm px-3"
                    disabled={busy}
                    onClick={() => handleMarcarEstado('NO_ASISTIO')}
                  >
                    <i className="bi bi-person-x me-1" aria-hidden="true" />
                    No asistió
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-sm px-3 shadow-sm"
                    disabled={busy}
                    onClick={() => handleMarcarEstado('ATENDIDO')}
                  >
                    <i className="bi bi-check2-circle me-1" aria-hidden="true" />
                    Marcar Atendido
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm px-3"
                disabled={busy}
                onClick={onClose}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
