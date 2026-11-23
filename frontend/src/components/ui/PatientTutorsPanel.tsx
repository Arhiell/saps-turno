import { useEffect, useState } from 'react';
import api from '../../services/api';
import { authError } from '../../utils/auth-errors';
import ConfirmationModal from './ConfirmationModal';

type Tutor = {
  id_tutor: string;
  nombres: string;
  apellidos: string;
  dni: string;
  parentesco: string;
  puede_gestionar_turnos: boolean;
  fecha_desde: string;
  fecha_hasta: string | null;
  identidad_verificada: boolean;
  documentacion_verificada: boolean;
  autorizacion_verificada: boolean;
  fecha_modificacion: string | null;
  modificado_por: { nombre_usuario: string } | null;
  historial: {
    id_historial: number;
    accion: 'INSERT' | 'UPDATE' | 'DELETE';
    fecha: string;
    actor: {
      nombre_usuario: string;
      persona: { nombres: string; apellidos: string } | null;
    } | null;
  }[];
};

const authorizationStatus = (tutor: Tutor) => {
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  if (!tutor.puede_gestionar_turnos) return 'Autorización revocada';
  if (tutor.fecha_desde > today) return 'Autorización aún no vigente';
  if (tutor.fecha_hasta && tutor.fecha_hasta < today) return 'Autorización vencida';
  return 'Gestión autorizada';
};

const formatParentescoBadge = (raw?: string) => {
  if (!raw) return 'Responsable';
  const clean = raw.trim();
  return clean
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export default function PatientTutorsPanel({ patientId }: { patientId: string }) {
  const [items, setItems] = useState<Tutor[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadedPatientId, setLoadedPatientId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [revision, setRevision] = useState(0);
  const [tutorToRevoke, setTutorToRevoke] = useState<Tutor | null>(null);

  const url = `/patients/${patientId}/tutors`;
  const isLoading = loading || loadedPatientId !== patientId;

  useEffect(() => {
    let active = true;
    void api
      .get<{ data: { tutors: Tutor[] } }>(url)
      .then((response) => {
        if (active) {
          setItems(response.data.data.tutors);
          setError('');
        }
      })
      .catch((cause) => {
        if (active) {
          setItems([]);
          setError(authError(cause));
        }
      })
      .finally(() => {
        if (active) {
          setLoadedPatientId(patientId);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [url, patientId, revision]);

  const revoke = async (tutor: Tutor) => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api.patch(`${url}/${tutor.id_tutor}/end`, {});
      setSuccess('La autorización de gestión fue revocada correctamente.');
      setLoading(true);
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(authError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card border-0 shadow-sm mb-4">
      <div className="card-header bg-white py-3 d-flex flex-wrap align-items-center justify-content-between gap-2 border-bottom">
        <h5 className="mb-0 fw-bold">
          <i className="bi bi-people me-2 text-success" aria-hidden="true" />
          Tutores y representantes autorizados
        </h5>
        <span className="badge bg-light text-muted border">
          {items.length} {items.length === 1 ? 'responsable' : 'responsables'}
        </span>
      </div>

      <div className="card-body">
        {error && (
          <div className="alert alert-danger small mb-3" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2" />
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success small mb-3" role="status">
            <i className="bi bi-check-circle-fill me-2" />
            {success}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-4 text-muted small" role="status">
            <span className="spinner-border spinner-border-sm text-success me-2" />
            Cargando responsables…
          </div>
        ) : items.length === 0 ? (
          <div className="p-3 bg-light rounded-3 border text-center text-muted small">
            <i className="bi bi-person-slash me-1" />
            No hay tutores o representantes registrados para este paciente.
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {items.map((tutor) => {
              const status = authorizationStatus(tutor);
              const isAuthorized = status === 'Gestión autorizada';

              return (
                <div
                  key={tutor.id_tutor}
                  className="p-3 bg-light rounded-3 border d-flex flex-column gap-2"
                >
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div>
                      <span className="fw-bold text-dark me-2">
                        {tutor.apellidos}, {tutor.nombres}
                      </span>
                      <span className="badge bg-white text-dark border me-2">
                        DNI {tutor.dni}
                      </span>
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                        {formatParentescoBadge(tutor.parentesco)}
                      </span>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      <span
                        className={`badge ${
                          isAuthorized
                            ? 'bg-success-subtle text-success border border-success-subtle'
                            : 'bg-danger-subtle text-danger border border-danger-subtle'
                        } rounded-pill`}
                      >
                        {status}
                      </span>

                      {isAuthorized && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                          disabled={busy}
                          onClick={() => setTutorToRevoke(tutor)}
                        >
                          <i className="bi bi-shield-x" />
                          Revocar
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="small text-muted d-flex flex-wrap align-items-center gap-2 mt-1">
                    {!tutor.identidad_verificada && !tutor.documentacion_verificada && !tutor.autorizacion_verificada ? (
                      <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle fw-normal">
                        <i className="bi bi-clock-history me-1" />
                        Verificación presencial pendiente
                      </span>
                    ) : (
                      <div className="d-flex flex-wrap align-items-center gap-1.5">
                        <span className="text-secondary fw-semibold small me-1">Verificación presencial:</span>
                        {tutor.identidad_verificada && (
                          <span className="badge bg-success-subtle text-success border border-success-subtle">
                            <i className="bi bi-check-lg me-1" />Identidad verificada
                          </span>
                        )}
                        {tutor.documentacion_verificada && (
                          <span className="badge bg-success-subtle text-success border border-success-subtle">
                            <i className="bi bi-check-lg me-1" />Documentación verificada
                          </span>
                        )}
                        {tutor.autorizacion_verificada && (
                          <span className="badge bg-success-subtle text-success border border-success-subtle">
                            <i className="bi bi-check-lg me-1" />Autorización verificada
                          </span>
                        )}
                      </div>
                    )}

                    {tutor.fecha_hasta && (
                      <span className="text-muted ms-auto small">
                        <i className="bi bi-calendar-event me-1" />
                        Vigencia hasta: {tutor.fecha_hasta.split('-').reverse().join('/')}
                      </span>
                    )}
                  </div>

                  {Boolean(tutor.historial.length) && (
                    <details className="small text-muted mt-1">
                      <summary className="cursor-pointer text-decoration-none">
                        <i className="bi bi-clock-history me-1" />
                        Ver historial de auditoría ({tutor.historial.length})
                      </summary>
                      <ul className="mb-0 mt-2 ps-3">
                        {tutor.historial.map((entry) => (
                          <li key={entry.id_historial}>
                            {new Date(entry.fecha).toLocaleString('es-AR')} ·{' '}
                            {entry.accion === 'INSERT'
                              ? 'Vínculo creado'
                              : entry.accion === 'DELETE'
                                ? 'Vínculo revocado'
                                : 'Vínculo modificado'}{' '}
                            {entry.actor
                              ? `por ${
                                  entry.actor.persona
                                    ? `${entry.actor.persona.apellidos}, ${entry.actor.persona.nombres}`
                                    : entry.actor.nombre_usuario
                                }`
                              : ''}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmationModal
        open={Boolean(tutorToRevoke)}
        title="Revocar autorización de tutor"
        subtitle="Esta acción retira el permiso de gestión de turnos."
        message={`¿Confirmás que querés revocar la autorización de ${tutorToRevoke?.nombres} ${tutorToRevoke?.apellidos}? No podrá realizar nuevas gestiones para este paciente.`}
        confirmText="Revocar autorización"
        cancelText="Cancelar"
        variant="danger"
        icon="bi-shield-x"
        loading={busy}
        onClose={() => setTutorToRevoke(null)}
        onConfirm={() => {
          if (tutorToRevoke) {
            const target = tutorToRevoke;
            setTutorToRevoke(null);
            void revoke(target);
          }
        }}
      />
    </section>
  );
}
