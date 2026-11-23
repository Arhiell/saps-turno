import axios from 'axios';

import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import ValidatedInput from '../../components/ui/ValidatedInput';

import {
  requestEmailVerification,
  verifyEmail,
} from '../../services/auth.service';

import {
  saveAuthSession,
} from '../../utils/auth-storage';

import AuthForm from './AuthForm';
import FourDigitCodeInput from './FourDigitCodeInput';

interface VerificationLocationState {
  email?: string;
  verificationExpiresAt?: string | null;
  resendAvailableAt?: string | null;
  loginVerificationToken?: string;
  fromLogin?: boolean;
}

const RESEND_COOLDOWN_MS =
  60_000;

// Convierte los segundos al formato MM:SS.
const formatTime = (
  totalSeconds: number
) =>
  `${String(
    Math.floor(
      totalSeconds / 60
    )
  ).padStart(2, '0')}:${String(
    totalSeconds % 60
  ).padStart(2, '0')}`;

// Obtiene un mensaje apropiado según el error recibido.
const messageForError = (
  cause: unknown
) => {
  if (
    !axios.isAxiosError<{
      message?: string;
    }>(cause)
  ) {
    return 'No pudimos completar la operación. Volvé a intentar.';
  }

  const message =
    cause.response?.data?.message
      ?.toLowerCase() ?? '';

  if (
    cause.response?.status === 401 &&
    message.includes(
      'inicio de sesión'
    )
  ) {
    return 'La verificación de inicio de sesión expiró. Volvé a iniciar sesión.';
  }

  if (
    cause.response?.status === 429 &&
    message.includes(
      'intentos'
    )
  ) {
    return 'Superaste los intentos. Podés solicitar un nuevo código.';
  }

  if (
    cause.response?.status === 429
  ) {
    return 'Esperá antes de solicitar otro código.';
  }

  if (
    message.includes(
      'expir'
    )
  ) {
    return 'El código expiró. Solicitá uno nuevo.';
  }

  if (
    cause.response?.status === 400
  ) {
    return 'Código incorrecto.';
  }

  if (
    cause.response?.status === 409
  ) {
    return 'El correo ya fue verificado. Volvé a iniciar sesión.';
  }

  return 'No pudimos completar la operación. Volvé a intentar.';
};

export default function VerifyEmailCodePage() {
  const location =
    useLocation();

  const navigate =
    useNavigate();

  const initialState =
    location.state as
      | VerificationLocationState
      | null;

  // Correo utilizado para la verificación.
  const [
    email,
    setEmail,
  ] = useState(
    initialState?.email ?? ''
  );

  // Token temporal utilizado durante la verificación del login.
  const loginVerificationToken =
    initialState
      ?.loginVerificationToken ??
    '';

  // Indica si la verificación proviene del inicio de sesión.
  const [fromLogin] =
    useState(
      Boolean(
        initialState?.fromLogin
      )
    );

  // Indica si el código ya fue solicitado.
  const [
    requested,
    setRequested,
  ] = useState(
    Boolean(
      initialState?.email
    )
  );

  // Momento en que vence el código actual.
  const [
    expiresAt,
    setExpiresAt,
  ] = useState(() => {
    if (
      initialState
        ?.verificationExpiresAt
    ) {
      return new Date(
        initialState
          .verificationExpiresAt
      ).getTime();
    }

    return initialState?.email
      ? Date.now() +
          10 * 60_000
      : 0;
  });

  // Momento a partir del cual se puede reenviar el código.
  const [
    resendAvailableAt,
    setResendAvailableAt,
  ] = useState(() => {
    if (
      initialState
        ?.resendAvailableAt
    ) {
      return new Date(
        initialState
          .resendAvailableAt
      ).getTime();
    }

    return initialState?.email
      ? Date.now() +
          RESEND_COOLDOWN_MS
      : 0;
  });

  const [
    now,
    setNow,
  ] = useState(
    Date.now()
  );

  const [
    code,
    setCode,
  ] = useState('');

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  const [
    notice,
    setNotice,
  ] = useState('');

  const [
    verified,
    setVerified,
  ] = useState(false);

  const [
    resendAfterAttempts,
    setResendAfterAttempts,
  ] = useState(false);

  // Actualiza el reloj utilizado por los contadores.
  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setNow(
            Date.now()
          );
        },
        1000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, []);

  // Calcula el tiempo restante del código.
  const secondsLeft =
    requested
      ? Math.max(
          0,
          Math.ceil(
            (expiresAt - now) /
              1000
          )
        )
      : 0;

  // Calcula el tiempo restante para solicitar otro código.
  const resendSecondsLeft =
    requested
      ? Math.max(
          0,
          Math.ceil(
            (
              resendAvailableAt -
              now
            ) / 1000
          )
        )
      : 0;

  const formattedTime =
    formatTime(
      secondsLeft
    );

  const formattedResendTime =
    formatTime(
      resendSecondsLeft
    );

  // Solicita o verifica el código ingresado.
  const submit = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    if (busy) {
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      // Solicita el código en la verificación manual.
      if (!requested) {
        const result =
          await requestEmailVerification(
            email.trim()
          );

        setRequested(true);

        setExpiresAt(
          result.verificationExpiresAt
            ? new Date(
                result.verificationExpiresAt
              ).getTime()
            : Date.now() +
                10 * 60_000
        );

        setResendAvailableAt(
          result.resendAvailableAt
            ? new Date(
                result.resendAvailableAt
              ).getTime()
            : Date.now() +
                RESEND_COOLDOWN_MS
        );

        setNotice(
          'Si corresponde, te enviamos un código a ese correo.'
        );

        return;
      }

      // Verifica que el código tenga cuatro dígitos.
      if (code.length !== 4) {
        setError(
          'Ingresá los 4 dígitos del código.'
        );

        return;
      }

      // Completa la verificación durante el inicio de sesión.
      if (fromLogin) {
        if (
          !loginVerificationToken
        ) {
          setError(
            'La sesión de verificación no es válida. Volvé a iniciar sesión.'
          );

          return;
        }

        const result =
          await verifyEmail({
            loginVerificationToken,
            code,
          });

        if (!result.data) {
          setError(
            'No pudimos completar el inicio de sesión. Volvé a intentarlo.'
          );

          return;
        }

        // Guarda los tokens y el usuario de la nueva sesión.
        saveAuthSession(
          result.data.accessToken,
          result.data.refreshToken,
          result.data.user
        );

        // Notifica al contexto de autenticación sobre la nueva sesión.
        window.dispatchEvent(
          new Event(
            'saps-session'
          )
        );

        // Si es rol administrativo con perfil incompleto, va directo a /completar-perfil.
        const isAdministrative = ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'].includes(result.data.user.rol);
        const destination = isAdministrative && !result.data.user.id_persona
          ? '/completar-perfil'
          : '/panel';

        navigate(
          destination,
          {
            replace: true,
          }
        );

        return;
      }

      // Realiza la verificación normal del correo.
      await verifyEmail({
        email:
          email.trim(),
        code,
      });

      setVerified(true);

      setNotice(
        'Correo verificado correctamente.'
      );
    } catch (cause) {
      const message =
        messageForError(
          cause
        );

      setError(message);

      if (
        message.startsWith(
          'Superaste los intentos'
        )
      ) {
        setResendAfterAttempts(
          true
        );
      }
    } finally {
      setBusy(false);
    }
  };

  // Solicita un nuevo código de verificación.
  const resend =
    async () => {
      if (
        busy ||
        (
          resendSecondsLeft > 0 &&
          !resendAfterAttempts
        )
      ) {
        return;
      }

      setBusy(true);
      setError('');
      setNotice('');

      try {
        const result =
          await requestEmailVerification(
            email.trim()
          );

        setExpiresAt(
          result.verificationExpiresAt
            ? new Date(
                result.verificationExpiresAt
              ).getTime()
            : Date.now() +
                10 * 60_000
        );

        setResendAvailableAt(
          result.resendAvailableAt
            ? new Date(
                result.resendAvailableAt
              ).getTime()
            : Date.now() +
                RESEND_COOLDOWN_MS
        );

        setNow(
          Date.now()
        );

        setCode('');

        setResendAfterAttempts(
          false
        );

        setNotice(
          'Te enviamos un nuevo código. El anterior dejó de ser válido.'
        );
      } catch (cause) {
        setError(
          messageForError(
            cause
          )
        );
      } finally {
        setBusy(false);
      }
    };

  // Muestra el resultado de la verificación manual.
  if (verified) {
    return (
      <AuthForm
        title="Correo verificado"
        subtitle="Tu correo fue verificado correctamente."
      >
        <div
          role="status"
          className="text-center"
        >
          <i
            className="bi bi-envelope-check auth-success-icon"
            aria-hidden="true"
          />

          <p className="mt-3">
            Correo verificado
            correctamente.
          </p>

          <Link
            className="btn btn-saps w-100"
            to="/login"
          >
            Iniciar sesión
          </Link>
        </div>
      </AuthForm>
    );
  }

  return (
    <AuthForm
      title="Verificar correo electrónico"
      subtitle={
        fromLogin
          ? 'Para continuar, ingresá el código que ya fue enviado a tu correo.'
          : requested
            ? 'Ingresá el código de 4 dígitos que te enviamos.'
            : 'Te enviaremos un código de verificación.'
      }
    >
      <form
        onSubmit={submit}
        aria-busy={busy}
      >
        <fieldset disabled={busy}>
          {!requested ? (
            <div className="mb-3">
              <label
                className="form-label"
                htmlFor="verify-email"
              >
                Correo electrónico
              </label>

              <ValidatedInput
                id="verify-email"
                className="form-control"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
              />
            </div>
          ) : (
            <>
              <div
                className="alert alert-info"
                role="status"
              >
                <i
                  className="bi bi-envelope me-2"
                  aria-hidden="true"
                />

                {fromLogin
                  ? 'Usá el código que recibiste cuando se creó tu cuenta. No generamos otro código automáticamente al iniciar sesión.'
                  : 'Enviamos un código a:'}
              </div>

              <p className="fw-semibold text-break mb-3">
                {email}
              </p>

              <FourDigitCodeInput
                label="Código de verificación"
                value={code}
                onChange={(value) => {
                  setCode(value);
                  setError('');
                }}
                disabled={busy}
              />

              {secondsLeft > 0 ? (
                <p className="small text-muted">
                  El código vence en{' '}
                  <span className="auth-code-timer">
                    {formattedTime}
                  </span>
                  .
                </p>
              ) : (
                <p className="small text-muted">
                  El código expiró. Podés
                  solicitar uno nuevo.
                </p>
              )}
            </>
          )}

          {error && (
            <div
              className="alert alert-danger"
              role="alert"
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              className="alert alert-success"
              role="status"
            >
              {notice}
            </div>
          )}

          <button
            className="btn btn-saps w-100"
            type="submit"
          >
            {busy
              ? 'Procesando…'
              : requested
                ? fromLogin
                  ? 'Verificar y entrar'
                  : 'Verificar'
                : 'Enviar código'}
          </button>
        </fieldset>
      </form>

      {requested && (
        <button
          className="btn btn-outline-secondary w-100 mt-3"
          type="button"
          disabled={
            busy ||
            (
              resendSecondsLeft > 0 &&
              !resendAfterAttempts
            )
          }
          onClick={() =>
            void resend()
          }
        >
          Reenviar código

          {resendSecondsLeft > 0 &&
          !resendAfterAttempts
            ? ` (${formattedResendTime})`
            : ''}
        </button>
      )}
    </AuthForm>
  );
}