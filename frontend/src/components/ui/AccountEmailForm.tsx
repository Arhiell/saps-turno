import { useRef, useState, type FormEvent } from 'react';

import {
  requestEmailChange,
  confirmEmailChange,
} from '../../services/auth.service';

import { useAuth } from '../../context/AuthContext';
import { authError } from '../../utils/auth-errors';
import { PROFESSIONAL_MESSAGE_TIMEOUT_MS, useAutoDismiss } from '../../utils/useAutoDismiss';

import ValidatedInput from './ValidatedInput';

// Gestiona el cambio de correo mediante un código de verificación.
export default function AccountEmailForm() {
  const { user, reloadProfile } = useAuth();

  // Controla el formulario y los datos del nuevo correo.
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const pending = useRef(false);

  // Almacena los mensajes de error y confirmación.
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const isProfessional = user?.rol === 'PROFESIONAL';
  useAutoDismiss(message, setMessage, PROFESSIONAL_MESSAGE_TIMEOUT_MS, isProfessional);
  useAutoDismiss(error, setError, PROFESSIONAL_MESSAGE_TIMEOUT_MS, isProfessional);

  // Solicita o reenvía el código de verificación.
  const send = async () => {
    if (pending.current) {
      return;
    }

    pending.current = true;
    setBusy(true);
    setError('');
    setMessage('');

    try {
      // Envía el código al nuevo correo e invalida el anterior.
      await requestEmailChange(email.trim());

      setSent(true);
      setCode('');
      setMessage(
        'Enviamos un código al nuevo correo. Vence en 10 minutos. Podés reenviarlo después de un minuto.'
      );
    } catch (cause) {
      setError(authError(cause));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  // Procesa la solicitud o confirmación del cambio de correo.
  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (pending.current) {
      return;
    }

    // Solicita el código si todavía no fue enviado.
    if (!sent) {
      await send();
      return;
    }

    pending.current = true;
    setBusy(true);
    setError('');
    setMessage('');

    try {
      // Verifica el código y actualiza el correo de la cuenta.
      await confirmEmailChange(email.trim(), code);

      // Recarga los datos del usuario autenticado.
      await reloadProfile();

      setMessage('Tu correo fue verificado y actualizado.');
      setOpen(false);
      setSent(false);
      setCode('');
      setEmail('');
    } catch (cause) {
      setError(authError(cause));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="patient-section mt-4">
      <h2 className="h5">
        Correo de acceso
      </h2>

      {/* Muestra el correo electrónico actual. */}
      <p className="text-break">
        {user?.email}
      </p>

      {/* Muestra los mensajes de confirmación o error. */}
      {message && (
        <p role="status" className="text-success">
          {message}
        </p>
      )}

      {error && (
        <div role="alert" className="alert alert-danger">
          {error}
        </div>
      )}

      {/* Permite iniciar el cambio de correo. */}
      {!open ? (
        <button
          className="btn btn-outline-success"
          onClick={() => {
            setOpen(true);
            setMessage('');
            setError('');
          }}
        >
          Cambiar correo
        </button>
      ) : (
        <form onSubmit={event => void submit(event)}>
          <p className="text-muted">
            Tu correo actual seguirá vigente hasta verificar el nuevo.
          </p>

          {/* Indica el correo al que se envió el código. */}
          {sent && (
            <p className="text-break">
              Ingresá el código enviado a{' '}
              <strong>{email.trim()}</strong>.
            </p>
          )}

          <fieldset disabled={busy}>
            {/* Solicita el nuevo correo electrónico. */}
            <label className="form-label w-100">
              Nuevo correo

              <ValidatedInput
                type="email"
                className="form-control mt-1"
                required
                maxLength={254}
                value={email}
                readOnly={sent}
                onChange={event => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>

            {/* Solicita el código de verificación recibido. */}
            {sent && (
              <label className="form-label w-100">
                Código de verificación

                <input
                  className="form-control mt-1"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  required
                  value={code}
                  onChange={event => setCode(event.target.value)}
                />
              </label>
            )}

            {/* Acciones para enviar, verificar o cancelar. */}
            <div className="d-flex flex-wrap gap-2 mt-2">
              <button className="btn btn-saps">
                {busy
                  ? 'Procesando…'
                  : sent
                    ? 'Verificar y cambiar correo'
                    : 'Enviar código'}
              </button>

              {sent && (
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => void send()}
                >
                  Reenviar código
                </button>
              )}

              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  setOpen(false);
                  setSent(false);
                  setError('');
                  setMessage('');
                  setCode('');
                  setEmail('');
                }}
              >
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}