import { useRef, useState } from 'react';

import type {
  CompletePersonInput,
  OwnPersonUpdate,
  PersonProfile,
} from '../../types/auth.types';

import { useAuth } from '../../context/AuthContext';
import { updateOwnProfile } from '../../services/auth.service';
import { authError } from '../../utils/auth-errors';
import { fieldError } from '../../utils/field-validation';
import { PROFESSIONAL_MESSAGE_TIMEOUT_MS, useAutoDismiss } from '../../utils/useAutoDismiss';

import PersonProfileFields from './PersonProfileFields';
import ConfirmationModal from './ConfirmationModal';

// Define los campos del perfil que el usuario puede modificar.
const editable = [
  'nombres',
  'apellidos',
  'telefono',
  'direccion',
  'localidad',
  'provincia',
  'codigo_postal',
] as const;

// Gestiona la edición de los datos personales del usuario.
export default function PersonalProfileForm({
  person,
  onClose,
  onSaved,
}: {
  person: PersonProfile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user, updateProfile } = useAuth();

  // Mantiene los cambios temporalmente hasta que se guarden.
  const [draft, setDraft] = useState<CompletePersonInput>({ ...person });

  // Controla el guardado y los mensajes de error.
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState('');

  useAutoDismiss(error, setError, PROFESSIONAL_MESSAGE_TIMEOUT_MS, user?.rol === 'PROFESIONAL');

  // Controla la apertura del modal de confirmación.
  const [confirm, setConfirm] = useState(false);

  // Valida los campos editables del perfil.
  const validate = () => {
    for (const key of editable) {
      const value = String(draft[key] ?? '').trim();

      if (['nombres', 'apellidos'].includes(key) && !value) {
        return 'Nombres y apellidos son obligatorios.';
      }

      const issue = fieldError(key, value);

      if (issue) {
        return issue;
      }
    }

    return '';
  };

  // Guarda únicamente los datos personales modificados.
  const save = async () => {
    if (saving.current) {
      return;
    }

    const issue = validate();

    if (issue) {
      setError(issue);
      setConfirm(false);
      return;
    }

    saving.current = true;
    setBusy(true);
    setError('');

    try {
      const changes: OwnPersonUpdate = {};

      // Compara los valores nuevos con los datos actuales.
      for (const key of editable) {
        const value = String(draft[key] ?? '').trim();

        if (value !== (person[key] ?? '')) {
          // Limpia con null los campos opcionales anulables.
          Object.assign(changes, {
            [key]: value ||
              (['telefono', 'direccion', 'codigo_postal'].includes(key)
                ? null
                : ''),
          });
        }
      }

      // Cierra el formulario si no existen cambios.
      if (!Object.keys(changes).length) {
        onClose();
        return;
      }

      // Actualiza los datos personales en el servidor.
      const result = await updateOwnProfile(changes);

      // Sincroniza el perfil sin recargar la página.
      updateProfile(result.data);

      onSaved();
    } catch (cause) {
      setError(authError(cause));
    } finally {
      saving.current = false;
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <>
      {/* Formulario de edición de datos personales. */}
      <form
        className="patient-section mb-4"
        onSubmit={event => {
          event.preventDefault();

          const issue = validate();

          setError(issue);

          if (!issue) {
            setConfirm(true);
          }
        }}
      >
        <h2 className="h5">
          Editar perfil
        </h2>

        <p className="text-muted">
          DNI, fecha de nacimiento y sexo requieren revisión administrativa.
          Los correos y los datos de tu cuenta se consultan por separado.
        </p>

        {/* Muestra los errores de validación o actualización. */}
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <fieldset disabled={busy}>
          {/* Muestra los campos editables del perfil. */}
          <PersonProfileFields
            value={draft}
            onChange={setDraft}
            editing
          />

          {/* Permite guardar o cancelar los cambios. */}
          <div className="d-flex flex-wrap gap-2 mt-3">
            <button className="btn btn-saps">
              {busy ? 'Guardando…' : 'Guardar cambios'}
            </button>

            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
          </div>
        </fieldset>
      </form>

      {/* Solicita confirmación antes de actualizar el perfil. */}
      <ConfirmationModal
        open={confirm}
        title="Guardar perfil"
        message="¿Querés guardar los cambios de tu perfil?"
        confirmText="Guardar cambios"
        variant="primary"
        icon="bi-person-check"
        loading={busy}
        detail={
          <span className="text-break">
            {draft.nombres} {draft.apellidos}
          </span>
        }
        onClose={() => setConfirm(false)}
        onConfirm={() => void save()}
      />
    </>
  );
}