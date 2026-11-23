import { useRef, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { changeUsername } from '../../services/auth.service';
import { authError } from '../../utils/auth-errors';
import { PROFESSIONAL_MESSAGE_TIMEOUT_MS, useAutoDismiss } from '../../utils/useAutoDismiss';

import ValidatedInput from './ValidatedInput';
import ConfirmationModal from './ConfirmationModal';

// Gestiona el cambio de nombre de usuario para todos los roles.
export default function AccountUsernameForm() {
  const { user, reloadProfile } = useAuth();

  // Controla el formulario y el nuevo nombre de usuario.
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.nombre_usuario ?? '');

  // Controla el procesamiento y los mensajes del formulario.
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isProfessional = user?.rol === 'PROFESIONAL';
  useAutoDismiss(success, setSuccess, PROFESSIONAL_MESSAGE_TIMEOUT_MS, isProfessional);
  useAutoDismiss(error, setError, PROFESSIONAL_MESSAGE_TIMEOUT_MS, isProfessional);

  // Controla la apertura del modal de confirmación.
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Actualiza el nombre de usuario y recarga el perfil.
  const save = async () => {
    if (pending.current) {
      return;
    }

    pending.current = true;
    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await changeUsername(name.trim());

      // Sincroniza los datos de la cuenta sin cerrar la sesión.
      await reloadProfile();

      setEditing(false);
      setSuccess('Nombre de usuario actualizado.');
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
      {/* Solicita confirmación antes de guardar el nuevo usuario. */}
      <ConfirmationModal
        open={confirmOpen}
        title="Cambiar nombre de usuario"
        message="¿Querés guardar este nombre de usuario?"
        detail={
          <div className="fw-semibold text-break">
            {name.trim()}
          </div>
        }
        confirmText="Guardar usuario"
        variant="primary"
        icon="bi-person-check"
        loading={busy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void save()}
      />

      <h2 className="h5">
        Nombre de usuario
      </h2>

      {/* Muestra el nombre de usuario actual. */}
      <p className="patient-username text-break">
        {user?.nombre_usuario}
      </p>

      {/* Muestra los mensajes de confirmación o error. */}
      {success && (
        <p className="text-success" role="status">
          {success}
        </p>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Permite iniciar el cambio de nombre de usuario. */}
      {!editing ? (
        <button
          className="btn btn-outline-success"
          onClick={() => {
            setName(user?.nombre_usuario ?? '');
            setEditing(true);
            setSuccess('');
            setError('');
          }}
        >
          Cambiar usuario
        </button>
      ) : (
        <form
          onSubmit={event => {
            event.preventDefault();
            setConfirmOpen(true);
          }}
        >
          <fieldset disabled={busy}>
            {/* Solicita el nuevo nombre de usuario. */}
            <label className="form-label w-100">
              Nuevo nombre de usuario

              <ValidatedInput
                field="nombre_usuario"
                className="form-control mt-1"
                autoComplete="username"
                required
                minLength={3}
                maxLength={60}
                value={name}
                onChange={event => setName(event.target.value)}
                aria-describedby="username-help"
              />
            </label>

            <p
              className="small text-muted"
              id="username-help"
            >
              Entre 3 y 12 caracteres. Letras sin acentos, números,
              punto, guion o guion bajo.
            </p>

            {/* Permite guardar o cancelar el cambio. */}
            <div className="d-flex flex-wrap gap-2">
              <button className="btn btn-saps">
                {busy ? 'Guardando…' : 'Guardar usuario'}
              </button>

              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError('');
                  setName(user?.nombre_usuario ?? '');
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