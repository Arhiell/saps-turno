import ValidatedInput from '../ui/ValidatedInput';
import { useState, type FormEvent } from 'react';

import {
  updateProfessionalClinic,
  updateProfessionalSpecialty,
} from '../../services/profesionales.service';

import { authError } from '../../utils/auth-errors';

// Propiedades necesarias para editar la vigencia de una asignación.
interface Props {
  profesional: string;
  relacion: string;
  tipo: 'salita' | 'especialidad';
  desde: string;
  hasta: string | null;
  activo: boolean;
  onSaved: () => Promise<void>;
  onSuccess?: (message: string) => void;
}

// Permite editar la vigencia de una salita o especialidad
// asignada a un profesional.
export default function AsignacionVigencia({
  profesional,
  relacion,
  tipo,
  desde,
  hasta,
  activo,
  onSaved,
  onSuccess,
}: Props) {
  // Controla si el formulario de edición está visible.
  const [open, setOpen] = useState(false);

  // Datos de vigencia de la asignación.
  const [start, setStart] = useState(desde);
  const [end, setEnd] = useState(hasta ?? '');
  const [enabled, setEnabled] = useState(activo);

  // Estados para controlar la petición y los errores.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Guarda los cambios realizados sobre la asignación.
  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (busy) return;

    setError('');

    // La fecha final no puede ser anterior a la inicial.
    if (end && end < start) {
      setError(
        'La fecha final debe ser igual o posterior al inicio.',
      );
      return;
    }

    setBusy(true);

    try {
      // Selecciona el servicio según el tipo de asignación.
      const update =
        tipo === 'salita'
          ? updateProfessionalClinic
          : updateProfessionalSpecialty;

      await update(
        profesional,
        relacion,
        {
          fecha_desde: start,
          fecha_hasta: end || null,
          activo: enabled,
        },
      );

      // Actualiza los datos del componente padre sin mostrar
      // nuevamente la pantalla de carga completa.
      await onSaved();

      setOpen(false);

      onSuccess?.(
        tipo === 'salita'
          ? 'Se actualizó el período de la salita.'
          : 'Se actualizó el período de la especialidad.',
      );
    } catch (cause) {
      setError(authError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      {/* Estado actual de la asignación */}
      <span
        className={`badge me-2 ${
          activo
            ? 'text-bg-success'
            : 'text-bg-secondary'
        }`}
      >
        {activo ? 'Activa' : 'Inactiva'}
      </span>

      {/* Abre o cierra el formulario de edición */}
      <button
        type="button"
        className="btn btn-sm btn-outline-success"
        disabled={busy}
        aria-expanded={open}
        onClick={() => {
          setStart(desde);
          setEnd(hasta ?? '');
          setEnabled(activo);
          setError('');
          setOpen(!open);
        }}
      >
        Editar vigencia
      </button>

      {/* Formulario para modificar la vigencia */}
      {open && (
        <form
          onSubmit={submit}
          className="mt-3 p-3 border rounded bg-light"
        >
          {error && (
            <div
              className="alert alert-danger"
              role="alert"
            >
              {error}
            </div>
          )}

          <fieldset disabled={busy}>
            <label className="form-label w-100">
              Desde

              <ValidatedInput
                className="form-control"
                type="date"
                required
                value={start}
                onChange={(e) =>
                  setStart(e.target.value)
                }
              />
            </label>

            <label className="form-label w-100">
              Hasta (opcional)

              <ValidatedInput
                className="form-control"
                type="date"
                min={start}
                value={end}
                onChange={(e) =>
                  setEnd(e.target.value)
                }
              />
            </label>

            <label className="form-check my-2">
              <input
                className="form-check-input"
                type="checkbox"
                checked={enabled}
                onChange={(e) =>
                  setEnabled(e.target.checked)
                }
              />

              Asignación activa
            </label>

            <div className="d-flex flex-wrap gap-2">
              <button className="btn btn-saps">
                {busy
                  ? 'Guardando…'
                  : 'Guardar vigencia'}
              </button>

              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </div>
  );
}