import {
  useState,
  type FormEvent,
} from 'react';

import {
  Link,
  useNavigate,
} from 'react-router-dom';

import ValidatedInput from '../../components/ui/ValidatedInput';
import PasswordCreationFields from '../../components/auth/PasswordCreationFields';
import { FloatingFeedbackToast } from '../../components/ui/FormFeedback';
import { useAutoDismiss } from '../../utils/useAutoDismiss';
import { validatePassword, validateConfirmation } from '../../utils/password-policy';

import {
  registerPatient,
} from '../../services/auth.service';

import {
  authError,
} from '../../utils/auth-errors';

import AuthForm from './AuthForm';
import GoogleButton from './GoogleButton';

export default function RegisterPage() {
  const navigate =
    useNavigate();

  // Datos principales para registrar la cuenta.
  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [
    confirmation,
    setConfirmation,
  ] = useState('');

  // Estados del formulario.
  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState('');

  const [
    showPasswordErrors,
    setShowPasswordErrors,
  ] = useState(false);

  useAutoDismiss(error, () => setError(''), 15000);

  // Valida los datos y registra la cuenta del paciente.
  const submit = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    if (busy) {
      return;
    }

    setError('');

    // Validación de email
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      document.getElementById('register-email')?.focus();
      return;
    }

    setShowPasswordErrors(true);

    const pwdErr = validatePassword(password);
    if (pwdErr) {
      document.getElementById('register-password')?.focus();
      return;
    }

    const confErr = validateConfirmation(password, confirmation);
    if (confErr) {
      document.getElementById('register-confirmation')?.focus();
      return;
    }

    setBusy(true);

    try {
      const result =
        await registerPatient({
          email: trimmedEmail,
          password,
        });

      // Redirige a la verificación del correo.
      navigate(
        '/verificar-codigo',
        {
          replace: true,
          state: {
            email: trimmedEmail,
            verificationExpiresAt:
              result.verificationExpiresAt,
          },
        }
      );
    } catch (cause) {
      setError(
        authError(cause)
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthForm
      title="Creá tu cuenta"
      subtitle="Registro exclusivo para pacientes. Después podrás completar tus datos personales."
      footer={
        <p>
          ¿Ya tenés una cuenta?{' '}
          <Link to="/login">
            Iniciar sesión
          </Link>
        </p>
      }
    >
      <>
        <form
          onSubmit={submit}
          aria-busy={busy}
        >
          <fieldset disabled={busy}>
            <div className="mb-3">
              <label
                className="form-label"
                htmlFor="register-email"
              >
                Correo electrónico
              </label>

              <ValidatedInput
                field="email"
                id="register-email"
                name="email"
                className="form-control"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
              />
            </div>

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
              passwordId="register-password"
              confirmationId="register-confirmation"
              disabled={busy}
              showErrors={showPasswordErrors}
            />

            {error && (
              <FloatingFeedbackToast
                variant="error"
                message={error}
                onDismiss={() => setError('')}
              />
            )}

            <button
              disabled={busy}
              className="btn btn-saps w-100"
              type="submit"
            >
              {busy && (
                <span
                  className="spinner-border spinner-border-sm me-2"
                  aria-hidden="true"
                />
              )}

              {busy
                ? 'Creando cuenta…'
                : 'Crear cuenta'}
            </button>
          </fieldset>
        </form>

        <div className="auth-divider">
          o registrate con
        </div>

        <GoogleButton
          disabled={busy}
        />
      </>
    </AuthForm>
  );
}