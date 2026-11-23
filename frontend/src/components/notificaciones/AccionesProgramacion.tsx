import {
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import type {
  EnvioAdministrativo,
} from '../../types/notificacion.types';

import {
  cancelarEnvio,
} from '../../services/notificaciones.service';

import {
  authError,
} from '../../utils/auth-errors';

import ConfirmationModal
  from '../ui/ConfirmationModal';

interface AccionesProgramacionProps {
  envio: EnvioAdministrativo;
  onChanged: () => void;
}

export default function AccionesProgramacion({
  envio,
  onChanged,
}: AccionesProgramacionProps) {
  // Controla la confirmación de cancelación.
  const [
    confirmar,
    setConfirmar,
  ] = useState(false);

  // Controla el estado de la operación.
  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  // Determina si la programación todavía puede editarse o cancelarse.
  const editable =
    envio.estado ===
      'PENDIENTE' &&
    !!envio.fecha_programada &&
    Date.parse(
      envio.fecha_programada
    ) > Date.now();

  // Cancela una notificación programada.
  const cancelar =
    async () => {
      if (busy) {
        return;
      }

      setBusy(true);
      setError('');

      try {
        await cancelarEnvio(
          envio.id_envio
        );

        setConfirmar(false);

        onChanged();
      } catch (error) {
        setError(
          authError(error)
        );

        setConfirmar(false);
      } finally {
        setBusy(false);
      }
    };

  return (
    <div className="d-grid gap-2">
      <Link
        className="btn btn-sm btn-outline-success"
        to={`/notificaciones/${envio.id_envio}`}
      >
        Ver detalle
      </Link>

      {editable && (
        <>
          <Link
            className="btn btn-sm btn-outline-primary"
            to={`/notificaciones/${envio.id_envio}/editar`}
          >
            Editar
          </Link>

          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            disabled={busy}
            onClick={() =>
              setConfirmar(true)
            }
          >
            Cancelar envío
          </button>
        </>
      )}

      {error && (
        <p
          className="text-danger small"
          role="alert"
        >
          {error}
        </p>
      )}

      <ConfirmationModal
        open={confirmar}
        title="Cancelar notificación programada"
        message={envio.titulo}
        detail={
          <p>
            Esta notificación no se enviará.
            Quedará registrada como cancelada
            en el historial.
          </p>
        }
        confirmText="Cancelar envío"
        cancelText="Volver"
        variant="warning"
        loading={busy}
        onClose={() => {
          if (!busy) {
            setConfirmar(false);
          }
        }}
        onConfirm={() =>
          void cancelar()
        }
      />
    </div>
  );
}