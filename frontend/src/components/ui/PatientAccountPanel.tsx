import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { authError } from '../../utils/auth-errors';
import type { Patient } from '../../types/patient.types';
import AccountSummary from './AccountSummary';

export default function PatientAccountPanel({
  patient,
  onLinked,
}: {
  patient: Patient;
  onLinked: () => void;
}) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [linked, setLinked] = useState(false);
  const [openLinkSection, setOpenLinkSection] = useState(false);

  const canLink = Boolean(
    user && ['SUPER_ADMIN', 'ADMIN_SALITA'].includes(user.rol)
  );

  const handleLinkSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!confirmed || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.patch(`/patients/${patient.id_paciente}/account`, {
        email: email.trim(),
        identidad_verificada: true,
      });
      setLinked(true);
      setOpenLinkSection(false);
      onLinked();
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
          <i className="bi bi-person-badge me-2 text-success" aria-hidden="true" />
          Cuenta digital del paciente
        </h5>

        {patient.cuenta ? (
          <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill">
            <i className="bi bi-check-circle me-1" />
            Cuenta propia asociada
          </span>
        ) : (
          <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill">
            Sin cuenta online directa
          </span>
        )}
      </div>

      <div className="card-body">
        {patient.cuenta ? (
          <div className="p-3 bg-light rounded-3 border">
            <AccountSummary account={patient.cuenta} />
          </div>
        ) : (
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 p-3 bg-light rounded-3 border">
            <div className="small text-muted">
              <span className="fw-semibold text-dark d-block mb-1">
                Atención presencial habilitada
              </span>
              La ficha médica opera con normalidad. Los turnos pueden gestionarse en ventanilla o a través de sus tutores designados.
            </div>

            {canLink && !linked && (
              <button
                type="button"
                className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1"
                aria-expanded={openLinkSection}
                onClick={() => {
                  setOpenLinkSection((v) => !v);
                  setError('');
                }}
              >
                <i className={`bi ${openLinkSection ? 'bi-chevron-up' : 'bi-link-45deg'}`} />
                {openLinkSection ? 'Cerrar vinculación' : 'Vincular cuenta digital'}
              </button>
            )}
          </div>
        )}

        {linked && (
          <div className="alert alert-success mt-3 mb-0" role="status">
            <i className="bi bi-check-circle-fill me-2" />
            Cuenta digital vinculada correctamente. El paciente puede ingresar y autogestionar sus turnos.
          </div>
        )}

        {openLinkSection && !patient.cuenta && !linked && (
          <form
            onSubmit={handleLinkSubmit}
            className="border rounded-3 p-3 p-md-4 mt-3 bg-white shadow-xs"
          >
            <h6 className="fw-bold text-success mb-2">
              <i className="bi bi-person-check me-2" />
              Asociar cuenta existente del paciente
            </h6>
            <p className="small text-muted mb-3">
              Ingresá el correo electrónico previamente registrado y verificado por la persona. Su historial médico y turnos se conservarán íntegros.
            </p>

            <fieldset disabled={busy}>
              <div className="mb-3">
                <label className="form-label small fw-semibold" htmlFor="patient-account-email">
                  Correo electrónico registrado
                </label>
                <input
                  id="patient-account-email"
                  className="form-control form-control-sm"
                  type="email"
                  required
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="form-check mb-3">
                <input
                  id="patient-account-identity"
                  type="checkbox"
                  className="form-check-input"
                  required
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <label
                  className="form-check-label small"
                  htmlFor="patient-account-identity"
                >
                  Verifiqué la identidad presencial de la persona titular de la cuenta.
                </label>
              </div>

              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-success"
                  disabled={!confirmed || busy}
                  type="submit"
                >
                  {busy ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" />
                      Vinculando…
                    </>
                  ) : (
                    'Vincular cuenta'
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={busy}
                  onClick={() => setOpenLinkSection(false)}
                >
                  Cancelar
                </button>
              </div>
            </fieldset>

            {error && (
              <div className="alert alert-danger small mt-3 mb-0" role="alert">
                <i className="bi bi-exclamation-triangle-fill me-1" />
                {error}
              </div>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
