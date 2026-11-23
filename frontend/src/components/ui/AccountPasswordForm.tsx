import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { changePassword } from '../../services/auth.service';
import { authError } from '../../utils/auth-errors';
import { validatePassword, validateConfirmation } from '../../utils/password-policy';
import { useAutoDismiss } from '../../utils/useAutoDismiss';
import { FloatingFeedbackToast } from './FormFeedback';

import PasswordInput from '../../pages/auth/PasswordInput';
import PasswordCreationFields from '../auth/PasswordCreationFields';
import ConfirmationModal from './ConfirmationModal';

// Gestiona el cambio de contraseña del usuario autenticado.
export default function AccountPasswordForm() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Controla el formulario y los datos de la contraseña.
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  // Controla el procesamiento y los mensajes de error.
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const [currentError, setCurrentError] = useState('');
  const [showPasswordErrors, setShowPasswordErrors] = useState(false);

  useAutoDismiss(error, () => setError(''), 15000);

  // Controla la apertura del modal de confirmación.
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Limpia los campos y errores del formulario.
  const reset = () => {
    setCurrent('');
    setPassword('');
    setConfirmation('');
    setError('');
    setCurrentError('');
    setShowPasswordErrors(false);
  };

  // Valida el formulario antes de solicitar confirmación.
  const validateForm = () => {
    let hasError = false;

    if (!current) {
      setCurrentError('Ingresá tu contraseña actual.');
      document.getElementById('account-current-password')?.focus();
      hasError = true;
    } else {
      setCurrentError('');
    }

    setShowPasswordErrors(true);

    const pwdErr = validatePassword(password);
    if (!hasError && pwdErr) {
      document.getElementById('account-new-password')?.focus();
      hasError = true;
    } else if (!hasError && current === password) {
      setError('La nueva contraseña debe ser diferente de la actual.');
      document.getElementById('account-new-password')?.focus();
      hasError = true;
    }

    const confErr = validateConfirmation(password, confirmation);
    if (!hasError && confErr) {
      document.getElementById('account-confirm-password')?.focus();
      hasError = true;
    }

    return !hasError;
  };

  // Actualiza la contraseña y cierra la sesión.
  const save = async () => {
    if (pending.current) {
      return;
    }

    if (!validateForm()) {
      setConfirmOpen(false);
      return;
    }

    pending.current = true;
    setBusy(true);
    setError('');

    try {
      // El servidor verifica la contraseña actual y revoca las renovaciones de sesión.
      await changePassword(current, password);

      reset();

      // Cierra la sesión después de actualizar la contraseña.
      try {
        await logout();
      } catch {
        // AuthContext ya limpia la sesión local.
      }

      navigate('/login', {
        replace: true,
        state: { passwordChanged: true },
      });
    } catch (cause) {
      setError(authError(cause));
    } finally {
      pending.current = false;
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  return (
    <section className="patient-section h-100">
      {/* Solicita confirmación antes de cambiar la contraseña. */}
      <ConfirmationModal
        open={confirmOpen}
        title="Cambiar contraseña"
        message="¿Querés actualizar tu contraseña de acceso?"
        detail={
          <div className="text-muted small">
            Se cerrará tu sesión y tendrás que ingresar nuevamente.
          </div>
        }
        confirmText="Cambiar contraseña"
        variant="warning"
        icon="bi-key"
        loading={busy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void save()}
      />

      <h2 className="h5">
        Contraseña
      </h2>

      <p className="text-muted">
        Actualizá tu contraseña de acceso a SAPS.
      </p>

      {/* Muestra los errores de validación o actualización. */}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Permite abrir el formulario de cambio de contraseña. */}
      {!editing ? (
        <button
          className="btn btn-outline-success"
          onClick={() => setEditing(true)}
        >
          Cambiar contraseña
        </button>
      ) : (
        <form
          noValidate
          onSubmit={event => {
            event.preventDefault();
            if (validateForm()) {
              setConfirmOpen(true);
            }
          }}
        >
          <fieldset disabled={busy}>
            {/* Solicita la contraseña actual. */}
            <PasswordInput
              id="account-current-password"
              label="Contraseña actual"
              autoComplete="current-password"
              required
              maxLength={128}
              value={current}
              error={currentError}
              onChange={event => {
                setCurrent(event.target.value);
                if (currentError) setCurrentError('');
              }}
            />

            {/* Nueva contraseña y confirmación con requisitos unificados */}
            <PasswordCreationFields
              password={password}
              confirmation={confirmation}
              onPasswordChange={(v) => {
                setPassword(v);
                setError('');
              }}
              onConfirmationChange={(v) => {
                setConfirmation(v);
                setError('');
              }}
              passwordId="account-new-password"
              confirmationId="account-confirm-password"
              passwordLabel="Nueva contraseña"
              confirmationLabel="Repetir nueva contraseña"
              disabled={busy}
              showErrors={showPasswordErrors}
            />

            {/* Notificación flotante para errores del servidor */}
            {error && (
              <FloatingFeedbackToast
                variant="error"
                message={error}
                onDismiss={() => setError('')}
              />
            )}

            {/* Permite guardar o cancelar el cambio. */}
            <div className="d-flex flex-wrap gap-2 mt-3">
              <button className="btn btn-saps" type="submit">
                {busy ? 'Actualizando…' : 'Guardar contraseña'}
              </button>

              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => {
                  reset();
                  setEditing(false);
                }}
              >
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}

      {/* Ofrece la recuperación de contraseña por correo. */}
      <p className="small mt-3 mb-0">
        Si olvidaste tu contraseña o ingresás con Google, podés{' '}
        <Link to="/recuperar-contrasena">
          recuperar o establecer tu contraseña por correo
        </Link>.
      </p>
    </section>
  );
}