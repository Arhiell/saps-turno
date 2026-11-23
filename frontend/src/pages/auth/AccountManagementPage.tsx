import { useEffect, useState } from 'react';
import PasswordCreationFields from '../../components/auth/PasswordCreationFields';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import AccessManagementPanel from '../../components/ui/AccessManagementPanel';
import ValidatedInput from '../../components/ui/ValidatedInput';
import { FloatingFeedbackToast } from '../../components/ui/FormFeedback';
import { useAutoDismiss } from '../../utils/useAutoDismiss';
import { useAuth } from '../../context/AuthContext';
import { createInternalAccount } from '../../services/auth.service';
import { getAdminSalitas } from '../../services/salitas.service';
import type { Salita } from '../../types/salita.types';
import { authError } from '../../utils/auth-errors';
import { validatePassword, validateConfirmation } from '../../utils/password-policy';

type AccountKind = 'ADMIN_SALITA' | 'RECEPCION' | 'SUPER_ADMIN';

export default function AccountManagementPage() {
  const { user } = useAuth();
  const [kind, setKind] = useState<AccountKind>('ADMIN_SALITA');
  const [salitas, setSalitas] = useState<Salita[]>([]);
  const [target, setTarget] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [showPasswordErrors, setShowPasswordErrors] = useState(false);
  const [accountsRevision, setAccountsRevision] = useState(0);

  useAutoDismiss(error, () => setError(''), 15000);
  useAutoDismiss(success, () => setSuccess(''), 15000);

  useEffect(() => {
    let active = true;
    void getAdminSalitas(true).then((result) => { if (active) setSalitas(result.data); })
      .catch((cause) => { if (active) setError(authError(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const validateAdminForm = () => {
    if ((kind === 'ADMIN_SALITA' || kind === 'RECEPCION') && !target) {
      document.getElementById('account-salita')?.focus();
      return false;
    }
    if (!username.trim()) {
      document.getElementById('account-username')?.focus();
      return false;
    }
    if (!email.trim()) {
      document.getElementById('account-email')?.focus();
      return false;
    }
    setShowPasswordErrors(true);
    const pwdErr = validatePassword(password);
    if (pwdErr) {
      document.getElementById('account-password')?.focus();
      return false;
    }
    const confErr = validateConfirmation(password, confirmation);
    if (confErr) {
      document.getElementById('account-confirmation')?.focus();
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (busy || user?.rol !== 'SUPER_ADMIN') return;
    if (!validateAdminForm()) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await createInternalAccount('admins', {
        nombre_usuario: username, email, password, rol: kind,
        ...(kind === 'ADMIN_SALITA' || kind === 'RECEPCION' ? { id_salita: target } : {}),
      });
      setPassword(''); setConfirmation(''); setUsername(''); setEmail(''); setTarget('');
      setShowPasswordErrors(false);
      setFormOpen(false); setAccountsRevision((value) => value + 1);
      setSuccess('Cuenta administrativa creada. Debe verificar su correo y completar sus datos personales al ingresar.');
    } catch (cause) { setError(authError(cause)); }
    finally { setBusy(false); setConfirmOpen(false); }
  };

  return (
    <div className="card shadow-sm border-0 rounded-3">
      <div className="card-body p-3 p-md-4">
        <div className="d-flex flex-wrap gap-3 align-items-center justify-content-between mb-3 border-bottom pb-3">
          <div>
            <h1 className="h3 fw-bold mb-1">Cuentas administrativas</h1>
            <p className="text-muted small mb-0">
              Gestión de usuarios y accesos autorizados para administración y salitas municipales
            </p>
          </div>
          {user?.rol === 'SUPER_ADMIN' && (
            <button
              type="button"
              className="btn btn-success d-inline-flex align-items-center gap-2"
              disabled={busy}
              aria-expanded={formOpen}
              aria-controls="alta-administrador"
              onClick={() => {
                setFormOpen((value) => !value);
                setShowPasswordErrors(false);
                setError('');
                setPassword('');
                setConfirmation('');
              }}
            >
              <i className={`bi ${formOpen ? 'bi-x-lg' : 'bi-person-plus-fill'}`} aria-hidden="true" />
              {formOpen ? 'Cerrar formulario' : 'Nueva cuenta administrativa'}
            </button>
          )}
        </div>
        <FloatingFeedbackToast
          message={error || success}
          variant={error ? 'error' : 'success'}
          onDismiss={() => {
            setError('');
            setSuccess('');
          }}
        />
        {user?.rol === 'SUPER_ADMIN' && formOpen && (
          <form
            id="alta-administrador"
            className="border rounded-3 p-3 p-md-4 mb-4 bg-light shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              if (validateAdminForm()) {
                setConfirmOpen(true);
              }
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
              <h2 className="h5 fw-bold mb-0 text-success">
                <i className="bi bi-person-plus-fill me-2" aria-hidden="true" />
                Crear cuenta administrativa
              </h2>
              <span className="badge bg-success-subtle text-success">Superadministrador</span>
            </div>
            <p className="text-muted small">
              La persona completará sus datos personales al ingresar al sistema por primera vez.
            </p>
            <fieldset disabled={busy || loading}>
              <div className="row g-3 mb-3">
                <div className="col-12 col-md-6">
                  <label htmlFor="account-kind" className="form-label small fw-semibold">
                    Cargo
                  </label>
                  <select
                    id="account-kind"
                    className="form-select"
                    value={kind}
                    onChange={(event) => {
                      setKind(event.target.value as AccountKind);
                      setTarget('');
                    }}
                  >
                    <option value="ADMIN_SALITA">Administrador de sala</option>
                    <option value="RECEPCION">Personal de recepción</option>
                    <option value="SUPER_ADMIN">Superadministrador</option>
                  </select>
                </div>
                {(kind === 'ADMIN_SALITA' || kind === 'RECEPCION') && (
                  <div className="col-12 col-md-6">
                    <label htmlFor="account-salita" className="form-label small fw-semibold">
                      Sala asignada *
                    </label>
                    <select
                      id="account-salita"
                      className="form-select"
                      required
                      value={target}
                      onChange={(event) => setTarget(event.target.value)}
                    >
                      <option value="">Seleccionar sala</option>
                      {salitas
                        .filter((salita) => salita.activo)
                        .map((salita) => (
                          <option key={salita.id_salita} value={salita.id_salita}>
                            {salita.nombre}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            {/* Solicita el nombre de usuario. */}
            <label className="form-label w-100">
              Usuario

              <ValidatedInput
                id="account-username"
                field="nombre_usuario"
                className="form-control"
                required
                autoComplete="off"
                value={username}
                onChange={event => setUsername(event.target.value)}
              />
            </label>

            {/* Solicita el correo electrónico de acceso. */}
            <label className="form-label w-100">
              Correo electrónico

              <ValidatedInput
                id="account-email"
                className="form-control"
                required
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
              />
            </label>

            {/* Componente unificado de contraseña con requisitos en vivo y errores contextuales */}
            <PasswordCreationFields
              password={password}
              confirmation={confirmation}
              onPasswordChange={(val) => {
                setPassword(val);
                setError('');
              }}
              onConfirmationChange={(val) => {
                setConfirmation(val);
                setError('');
              }}
              passwordId="account-password"
              confirmationId="account-confirmation"
              disabled={busy}
              showErrors={showPasswordErrors}
            />

            {/* Permite iniciar la creación de la cuenta. */}
            <button
              className="btn btn-primary mt-3"
              type="submit"
            >
              {busy ? 'Creando…' : 'Crear cuenta'}
            </button>

            </fieldset>
          </form>
        )}
        <AccessManagementPanel key={accountsRevision} revision={accountsRevision} salitas={salitas} />
      </div>
      <ConfirmationModal open={confirmOpen} title="Crear cuenta administrativa"
        message={`¿Querés crear la cuenta de ${username}?`} confirmText="Crear cuenta" loading={busy}
        onClose={() => { if (!busy) setConfirmOpen(false); }} onConfirm={() => void submit()} />
    </div>
  );
}
