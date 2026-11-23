import {
  useState,
  type FormEvent,
} from 'react';

import {
  Link,
  useNavigate,
  useLocation,
} from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

import { authError } from '../../utils/auth-errors';

import AuthForm from './AuthForm';
import PasswordInput from './PasswordInput';
import GoogleButton from './GoogleButton';

const Login = () => {
  const {
    login,
    isLoading,
  } = useAuth();

  const navigate =
    useNavigate();

  const { state } =
    useLocation();

  const [
    identifier,
    setIdentifier,
  ] = useState('');

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    error,
    setError,
  ] = useState('');

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const busy =
    isLoading ||
    submitting;

  const handleSubmit =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (busy) {
        return;
      }

      setSubmitting(true);
      setError('');

      try {
        const result =
          await login({
            identifier,
            password,
          });

        /**
         * El login puede devolver dos resultados:
         *
         * 1. Login normal:
         *    requiresEmailVerification = false
         *
         * 2. Login pendiente de verificación:
         *    requiresEmailVerification = true
         *
         * Primero comprobamos que la propiedad exista
         * y después comprobamos que su valor sea TRUE.
         *
         * Esto evita confundir:
         *
         * requiresEmailVerification: false
         *
         * con:
         *
         * requiresEmailVerification: true
         */
        if (
          'requiresEmailVerification' in
            result.data &&
          result.data.requiresEmailVerification ===
            true
        ) {
          navigate(
            '/verificar-codigo',
            {
              replace: true,

              state: {
                email:
                  result.data.email,

                loginVerificationToken:
                  result.data
                    .loginVerificationToken,

                verificationExpiresAt:
                  result.data
                    .verificationExpiresAt,

                resendAvailableAt:
                  result.data
                    .resendAvailableAt,

                fromLogin:
                  true,
              },
            },
          );

          return;
        }

        /**
         * Login normal.
         *
         * El AuthContext ya guardó:
         * - Access Token
         * - Refresh Token
         * - Usuario
         *
         * Por lo tanto solamente navegamos
         * al inicio del sistema.
         */
        navigate(
          '/panel',
          {
            replace: true,
          },
        );
      } catch (cause) {
        setError(
          authError(cause),
        );
      } finally {
        setSubmitting(false);
      }
    };

  return (
    <AuthForm
      showSectionIcon={false}
      title="Te damos la bienvenida"
      subtitle="Ingresá a tu cuenta para continuar."
      footer={
        <>
          <p>
            ¿Sos paciente?{' '}
            <Link to="/registro">
              Crear una cuenta
            </Link>
          </p>

          <p className="mt-2">
            <Link to="/verificar-email">
              Verificar mi correo
            </Link>
          </p>
        </>
      }
    >
      {state?.passwordChanged ===
        true && (
        <div
          className="alert alert-success"
          role="status"
        >
          Contraseña actualizada.
          Ingresá con tu nueva
          contraseña.
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        aria-busy={busy}
      >
        <fieldset disabled={busy}>
          <div className="mb-3">
            <label
              htmlFor="identifier"
              className="form-label"
            >
              Correo electrónico o usuario
            </label>

            <input
              id="identifier"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className="form-control"
              value={identifier}
              onChange={(event) =>
                setIdentifier(
                  event.target.value,
                )
              }
              required
            />
          </div>

          <PasswordInput
            id="password"
            name="password"
            label="Contraseña"
            autoComplete="current-password"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value,
              )
            }
            required
          />

          <Link
            className="auth-recovery-link"
            to="/recuperar-contrasena"
          >
            ¿Olvidaste tu contraseña?
          </Link>

          {error && (
            <div
              className="alert alert-danger"
              role="alert"
            >
              <i
                className="bi bi-exclamation-circle me-2"
                aria-hidden="true"
              />

              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-saps w-100"
            disabled={busy}
          >
            {busy && (
              <span
                className="spinner-border spinner-border-sm me-2"
                aria-hidden="true"
              />
            )}

            {isLoading
              ? 'Verificando sesión…'
              : submitting
                ? 'Iniciando sesión…'
                : 'Iniciar sesión'}
          </button>
        </fieldset>
      </form>

      <div className="auth-divider">
        o continuá con
      </div>

      <GoogleButton
        disabled={busy}
      />
    </AuthForm>
  );
};

export default Login;
