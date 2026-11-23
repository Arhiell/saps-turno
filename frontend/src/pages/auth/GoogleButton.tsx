import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { authError } from '../../utils/auth-errors';

// Interfaz mínima utilizada del SDK de Google Identity Services.
interface GoogleIdentity {
  initialize: (options: {
    client_id: string;
    callback: (result: { credential: string }) => void;
  }) => void;

  renderButton: (
    element: HTMLElement,
    options: {
      theme: string;
      size: string;
      text: string;
      locale: string;
    }
  ) => void;
}

// Extiende Window con la API cargada por Google Identity Services.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleIdentity;
      };
    };
  }
}

// Conserva una única promesa para evitar cargar el SDK varias veces.
let googleScript: Promise<void> | null = null;

// Carga el SDK de Google Identity Services de forma dinámica.
const loadGoogle = () =>
  googleScript ??=
    new Promise<void>((resolve, reject) => {
      if (window.google) {
        resolve();
        return;
      }

      const script = document.createElement('script');

      script.src = 'https://accounts.google.com/gsi/client?hl=es';
      script.async = true;

      script.onload = () => {
        resolve();
      };

      script.onerror = () => {
        googleScript = null;
        script.remove();

        reject(
          new Error(
            'No se pudo cargar Google. Volvé a intentar.'
          )
        );
      };

      document.head.appendChild(script);
    });

interface GoogleButtonProps {
  disabled?: boolean;
}

// Botón de autenticación mediante Google.
export default function GoogleButton({
  disabled = false,
}: GoogleButtonProps) {
  const container = useRef<HTMLDivElement>(null);

  const { loginWithGoogle } = useAuth();

  // Mantiene disponible la versión más reciente de la función de login
  // sin obligar a reinicializar el SDK de Google.
  const loginRef = useRef(loginWithGoogle);
  loginRef.current = loginWithGoogle;

  // Evita procesar más de un intento de autenticación simultáneamente.
  const locked = useRef(false);

  // Mantiene actualizado el estado disabled dentro del callback de Google.
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as
    | string
    | undefined;

  // Inicializa Google Identity Services y renderiza su botón oficial.
  useEffect(() => {
    if (!clientId) {
      return;
    }

    let active = true;

    void loadGoogle()
      .then(() => {
        if (
          !active ||
          !container.current ||
          !window.google
        ) {
          return;
        }

        window.google.accounts.id.initialize({
          client_id: clientId,

          callback: (result) => {
            if (
              !active ||
              locked.current ||
              disabledRef.current
            ) {
              return;
            }

            locked.current = true;
            setBusy(true);
            setError('');

            void loginRef
              .current(result.credential)
              .then(() =>
                navigate('/panel', {
                  replace: true,
                })
              )
              .catch((cause) => {
                if (active) {
                  setError(
                    authError(cause)
                  );
                }
              })
              .finally(() => {
                locked.current = false;

                if (active) {
                  setBusy(false);
                }
              });
          },
        });

        window.google.accounts.id.renderButton(
          container.current,
          {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            locale: 'es',
          }
        );
      })
      .catch((cause) => {
        if (active) {
          setError(
            authError(cause)
          );
        }
      });

    // Ignora respuestas posteriores al desmontaje del componente.
    return () => {
      active = false;
    };
  }, [clientId, navigate]);

  return (
    <div
      className="auth-google"
      aria-busy={busy}
    >
      {clientId ? (
        // Contenedor donde Google renderiza su botón oficial.
        <div
          className="auth-google-control"
          ref={container}
          aria-disabled={busy || disabled}
          inert={busy || disabled}
        />
      ) : (
        <>
          {/* Alternativa visual cuando Google no está configurado. */}
          <button
            type="button"
            className="btn btn-outline-secondary w-100"
            disabled
          >
            <i
              className="bi bi-google me-2"
              aria-hidden="true"
            />
            Continuar con Google
          </button>

          <p className="small text-muted mt-2 mb-0">
            Google no está disponible en este momento.
          </p>
        </>
      )}

      {/* Estado del proceso de autenticación. */}
      {busy && (
        <p role="status">
          Ingresando con Google…
        </p>
      )}

      {/* Error de carga o autenticación con Google. */}
      {error && (
        <div
          className="alert alert-danger mt-2"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}