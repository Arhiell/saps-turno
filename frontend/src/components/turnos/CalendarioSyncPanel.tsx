
import { useEffect, useState } from 'react';

import {
  getCalendarioSync,
  sincronizarFeriados,
} from '../../services/cierre-calendario.service';

import type {
  SyncStatus,
  SyncResult,
} from '../../types/cierre-calendario.types';

import { agendaDateTime } from '../../utils/agenda-display';
import { authError } from '../../utils/auth-errors';

import ConfirmationModal from '../ui/ConfirmationModal';

// Define las propiedades del panel de sincronización.
interface Props {
  superAdmin: boolean;
  disabled: boolean;
  onUpdated: () => void;
  onBusyChange: (busy: boolean) => void;
}

// Gestiona la sincronización de feriados nacionales con ArgentinaDatos.
export default function CalendarioSyncPanel({
  superAdmin,
  disabled,
  onUpdated,
  onBusyChange,
}: Props) {
  // Almacena el estado y los resultados de la sincronización.
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  // Controla los errores, la carga y la confirmación.
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [revision, setRevision] = useState(0);

  // Consulta el estado de sincronización al cargar o actualizar el panel.
  useEffect(() => {
    let active = true;

    void getCalendarioSync()
      .then((data) => {
        if (active) {
          setStatus(data);
          setError('');
        }
      })
      .catch((cause) => {
        if (active) {
          setError(authError(cause));
        }
      });

    // Evita actualizar el estado después de desmontar el componente.
    return () => {
      active = false;
    };
  }, [revision]);

  // Prioriza los resultados recientes sobre el resumen almacenado.
  const years =
    result?.resultados ??
    status?.resumen.resultados ??
    [];

  return (
    <section
      className="dashboard-panel p-3 mb-3"
      aria-busy={busy}
    >
      {/* Encabezado e información de la sincronización automática. */}
      <h2 className="h5">
        Feriados nacionales · ArgentinaDatos
      </h2>

      <p className="small mb-1">
        Actualización automática: sábado a las 03:00,
        hora argentina. Se consulta el año actual y el siguiente.
      </p>

      {/* Muestra la última sincronización válida y el último intento. */}
      <p className="small">
        Última actualización válida del año actual:{' '}

        <strong>
          {status?.ultimo_exito
            ? agendaDateTime(status.ultimo_exito)
            : 'Sin sincronización válida registrada'}
        </strong>

        {status?.ultimo_intento && (
          <>
            {' · Último intento: '}
            {agendaDateTime(status.ultimo_intento)}
            {' ('}
            {status.modo === 'MANUAL'
              ? 'manual'
              : 'automático'}
            {')'}
          </>
        )}
      </p>

      {/* Informa si existe una sincronización en curso. */}
      {status?.resumen.estado === 'EN_CURSO' && (
        <p role="status">
          Hay una sincronización pendiente de finalizar.
          Actualizá el estado en unos momentos.
        </p>
      )}

      {/* Muestra los errores de consulta o sincronización. */}
      {error && (
        <p
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* Presenta el mensaje de la última sincronización manual. */}
      {result && (
        <p
          className="alert alert-info"
          role="status"
        >
          {result.mensaje}
        </p>
      )}

      {/* Detalla los resultados de sincronización por año. */}
      {!!years.length && (
        <ul className="mb-3">
          {years.map((y) => (
            <li key={y.anio}>
              <strong>
                {y.anio}:
              </strong>{' '}

              {y.estado === 'OK' ? (
                <>
                  nuevos: {y.nuevos}
                  {' · '}
                  actualizados: {y.actualizados}
                  {' · '}
                  sin cambios: {y.sin_cambios}

                  {/* Informa los turnos pendientes de revisión. */}
                  {!!y.turnos_pendientes && (
                    <span className="text-danger">
                      {' · '}
                      {y.turnos_pendientes} turnos pendientes al sincronizar
                    </span>
                  )}

                  {/* Indica coincidencias con cierres cargados manualmente. */}
                  {!!y.coincidencias_manuales && (
                    <>
                      {' · '}
                      {y.coincidencias_manuales} coincidencias con carga manual
                    </>
                  )}

                  {/* Advierte sobre fechas conservadas que no llegaron de la fuente. */}
                  {!!y.no_recibidos_conservados && (
                    <span className="text-warning-emphasis">
                      {' · '}
                      {y.no_recibidos_conservados} fechas no recibidas se conservan;
                      revisar con la fuente
                    </span>
                  )}
                </>
              ) : (
                y.mensaje
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Acciones disponibles para actualizar feriados y calendario. */}
      <div className="d-flex flex-wrap gap-2">
        {/* Solo el superadministrador puede iniciar la sincronización manual. */}
        {superAdmin && (
          <button
            className="btn btn-outline-success"
            disabled={disabled || busy}
            onClick={() => setConfirming(true)}
          >
            Actualizar feriados nacionales
          </button>
        )}

        {/* Actualiza el estado y solicita recargar el calendario. */}
        <button
          className="btn btn-outline-secondary"
          disabled={disabled || busy}
          onClick={() => {
            setResult(null);
            setRevision((v) => v + 1);
            onUpdated();
          }}
        >
          Actualizar estado y calendario
        </button>
      </div>

      {/* Solicita confirmación antes de sincronizar los feriados. */}
      <ConfirmationModal
        open={confirming}
        title="Actualizar feriados nacionales"
        confirmText="Sincronizar ahora"
        loading={busy}
        message="Se consultará ArgentinaDatos y se actualizarán sus feriados en el calendario institucional."
        notice="Los feriados nuevos impiden nuevas reservas de inmediato. Los turnos existentes quedan pendientes para revisión; no se reprograman automáticamente. Los cierres manuales se conservan."
        onClose={() => {
          if (!busy) {
            setConfirming(false);
          }
        }}
        onConfirm={() => {
          // Evita ejecutar sincronizaciones simultáneas desde el panel.
          if (busy) {
            return;
          }

          // Informa el inicio del proceso y limpia los resultados anteriores.
          setBusy(true);
          onBusyChange(true);
          setError('');
          setResult(null);

          // Ejecuta la sincronización y actualiza el calendario.
          void sincronizarFeriados()
            .then((data) => {
              setResult(data);
              setRevision((v) => v + 1);
              onUpdated();
            })
            .catch((cause) => {
              setError(authError(cause));
            })
            .finally(() => {
              // Restablece los estados al finalizar el proceso.
              setBusy(false);
              onBusyChange(false);
              setConfirming(false);
            });
        }}
      />
    </section>
  );
}
