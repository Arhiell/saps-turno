
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '../../context/AuthContext';

import ConfirmationModal from '../ui/ConfirmationModal';
import AgendaAffectedList from './AgendaAffectedList';
import AgendaReview from './AgendaReview';

import {
  getAgendaImpact,
  getAgendaProposal,
  confirmAgendaProposal,
  type AgendaChange,
  type AffectedTurno,
  type AgendaProposal,
  type AgendaResult,
} from '../../services/agenda-impacto.service';

import {
  guardarHorario,
  guardarBloqueo,
} from '../../services/configuracion.service';

import { authError } from '../../utils/auth-errors';
import { agendaDate } from '../../utils/agenda-display';
import { guardarCierre } from '../../services/cierre-calendario.service';

// Define las propiedades del panel de reprogramación.
interface Props {
  cambio: AgendaChange;
  onClose: () => void;
  onSaved: () => void;
  context?: string;
  persistido?: boolean;
}

// Gestiona los turnos afectados por cambios en la agenda.
export default function AgendaImpactPanel({
  cambio,
  onClose,
  onSaved,
  context,
  persistido = false,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);

  const { user } = useAuth();

  // Verifica los roles autorizados según el tipo de cambio.
  const authorized = (
    cambio.tipo === 'cierre'
      ? ['SUPER_ADMIN', 'ADMIN_SALITA']
      : ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION']
  ).includes(user?.rol ?? '');

  // Almacena los turnos afectados y sus propuestas.
  const [turnos, setTurnos] = useState<AffectedTurno[]>([]);
  const [propuestas, setPropuestas] = useState<AgendaProposal[]>([]);

  const [resultados, setResultados] = useState<
    (AgendaResult & { paciente: string })[]
  >([]);

  // Establece el motivo inicial según el cambio solicitado.
  const [motivo, setMotivo] = useState(
    cambio.tipo === 'cierre'
      ? `Cierre institucional: ${cambio.datos.titulo}`
      : cambio.tipo === 'bloqueo'
        ? cambio.datos.motivo
        : 'Cambio de horario de atención.'
  );

  // Controla el período de búsqueda y los estados del panel.
  const [dias, setDias] = useState(30);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);

  // Obtiene las propuestas que tienen un destino seleccionado.
  const selected = propuestas.filter((p) => p.destino);

  // Consulta los turnos afectados al cargar o modificar el cambio.
  useEffect(() => {
    panelRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });

    if (!authorized) {
      return;
    }

    let active = true;

    setBusy(true);

    void getAgendaImpact(cambio)
      .then((data) => {
        if (active) {
          setTurnos(data.afectados);
          setReady(true);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(authError(cause));
        }
      })
      .finally(() => {
        if (active) {
          setBusy(false);
        }
      });

    // Evita actualizar el estado después de desmontar el componente.
    return () => {
      active = false;
    };
  }, [cambio, authorized]);

  // Actualiza los turnos afectados y limpia las propuestas anteriores.
  const refresh = async () => {
    setReady(false);

    const data = await getAgendaImpact(cambio);

    setTurnos(data.afectados);
    setPropuestas([]);
    setReady(true);
    setRevision((v) => v + 1);
  };

  // Ejecuta acciones asíncronas y centraliza el manejo de errores.
  const run = async (action: () => Promise<void>) => {
    if (busy) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      await action();
    } catch (cause) {
      setError(authError(cause));
    } finally {
      setBusy(false);
    }
  };

  // Actualiza la propuesta seleccionada para un turno.
  const choose = (p: AgendaProposal) =>
    setPropuestas((values) => [
      ...values.filter(
        (v) => v.id_turno !== p.id_turno
      ),
      p,
    ]);

  // Impide acceder al panel sin los permisos correspondientes.
  if (!authorized) {
    return (
      <div className="alert alert-warning">
        No tenés permisos para gestionar esta agenda.
      </div>
    );
  }

  // Identifica el tipo y estado del cambio de agenda.
  const absence = cambio.tipo === 'bloqueo';
  const closure = cambio.tipo === 'cierre';

  const inactive =
    (absence || closure) &&
    !cambio.datos.activo;

  // Genera la descripción del cambio solicitado.
  const description = closure
    ? `${cambio.datos.titulo}: ${agendaDate(cambio.datos.fecha_inicio)} hasta ${agendaDate(cambio.datos.fecha_fin)} · ${
        cambio.datos.dia_completo
          ? 'Todo el día'
          : `${cambio.datos.hora_inicio} a ${cambio.datos.hora_fin} cada día`
      }`
    : absence
      ? `${agendaDate(cambio.datos.fecha)} · ${
          cambio.datos.dia_completo
            ? 'Todo el día'
            : `${cambio.datos.hora_inicio} a ${cambio.datos.hora_fin}`
        }`
      : 'Modificación del horario habitual';

  return (
    <section
      ref={panelRef}
      className="dashboard-panel p-3 mb-4"
      aria-label="Reprogramación de turnos afectados"
      aria-busy={busy}
    >
      {/* Encabezado del panel según el tipo de cambio. */}
      <h2 className="h5">
        {inactive
          ? 'Desactivar ausencia o cierre'
          : closure
            ? 'Reprogramación por cierre institucional'
            : absence
              ? 'Reprogramación por ausencia o cierre'
              : 'Reprogramación por cambio de horario'}
      </h2>

      {/* Información contextual del cambio de agenda. */}
      {context && (
        <p className="fw-semibold mb-1 text-break">
          {context}
        </p>
      )}

      <p className="mb-1">
        {description}
      </p>

      {absence && (
        <p className="text-break">
          Motivo interno: {cambio.datos.motivo}
        </p>
      )}

      {/* Explica el procedimiento según el estado de la configuración. */}
      {persistido ? (
        <p>
          El feriado ya está vigente y bloquea nuevas reservas.
          Elegí los nuevos horarios, revisá y confirmá los turnos
          afectados de tu alcance.
        </p>
      ) : inactive ? (
        <p>
          La regla quedará inactiva. Los turnos reprogramados
          anteriormente no vuelven a su fecha original.
        </p>
      ) : (
        <p>
          1. Elegí nuevos horarios. 2. Revisá y confirmá los turnos.
          3. Guardá{' '}
          {closure
            ? 'el cierre institucional'
            : absence
              ? 'la ausencia'
              : 'el cambio de horario'}.
        </p>
      )}

      <p className="small text-muted">
        {!persistido &&
          'El cambio de agenda todavía no está guardado. '}
        Se conservan profesional, especialidad y salita.
        Elegir horarios no reserva lugares.
      </p>

      {/* Muestra errores y el estado de procesamiento. */}
      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      {busy && (
        <p role="status">
          <span className="spinner-border spinner-border-sm me-2" />
          Procesando agenda…
        </p>
      )}

      {/* Resume los turnos afectados y las propuestas seleccionadas. */}
      {ready && (
        <p className="fw-semibold">
          {closure
            ? `Este cierre afecta ${turnos.length} turnos.`
            : `${turnos.length} afectados.`}{' '}
          {selected.length} listos para revisar ·{' '}
          {turnos.length - selected.length} sin nuevo horario
        </p>
      )}

      {/* Presenta los resultados de la última confirmación. */}
      {!!resultados.length && (
        <div
          className="alert alert-info"
          role="status"
        >
          <strong>
            Resultado de la última confirmación
          </strong>

          {resultados.map((r) => (
            <div
              key={r.id_turno}
              className="text-break"
            >
              <span
                className={`badge me-2 ${
                  r.confirmado
                    ? 'text-bg-success'
                    : 'text-bg-warning'
                }`}
              >
                {r.confirmado
                  ? 'Reprogramado'
                  : 'Pendiente'}
              </span>

              {r.paciente}: {r.mensaje}
            </div>
          ))}
        </div>
      )}

      {/* Bloquea las acciones durante los procesos activos. */}
      <fieldset disabled={busy || confirming || saving}>
        <div className="d-flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => void run(refresh)}
          >
            Actualizar afectados y limpiar selección
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onClose}
          >
            {persistido
              ? 'Volver al calendario'
              : 'Volver al formulario'}
          </button>
        </div>

        {/* Permite seleccionar destinos para los turnos afectados. */}
        {ready && !!turnos.length && (
          <>
            <p>
              Elegí la nueva fecha de cada paciente y después
              uno de los horarios disponibles. Los pacientes
              sin horario quedarán pendientes.
            </p>

            <AgendaAffectedList
              cambio={cambio}
              turnos={turnos}
              propuestas={propuestas}
              busy={busy || confirming}
              revision={revision}
              onChoose={choose}
            />

            {/* Permite solicitar sugerencias automáticas de horarios. */}
            <details className="border rounded p-3 my-3">
              <summary>
                Ayuda opcional: sugerir horarios
              </summary>

              <p className="small mt-2">
                Busca horarios posteriores. Completa solamente
                pacientes que todavía no tienen una elección.
              </p>

              <label className="form-label">
                Período de búsqueda

                <select
                  className="form-select"
                  value={dias}
                  onChange={(e) =>
                    setDias(Number(e.target.value))
                  }
                >
                  {[7, 14, 30, 60, 90].map((d) => (
                    <option
                      key={d}
                      value={d}
                    >
                      {d} días
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="btn btn-outline-secondary ms-2"
                onClick={() =>
                  void run(async () => {
                    const data = await getAgendaProposal(
                      cambio,
                      dias
                    );

                    // Conserva las elecciones existentes y agrega sugerencias.
                    setPropuestas((old) => [
                      ...old.filter((p) => p.destino),
                      ...data.propuestas.filter(
                        (p) =>
                          !old.some(
                            (v) =>
                              v.id_turno === p.id_turno &&
                              v.destino
                          )
                      ),
                    ]);
                  })
                }
              >
                Sugerir horarios
              </button>
            </details>

            {/* Motivo interno de la reprogramación. */}
            <label className="form-label w-100">
              Motivo interno de reprogramación (no se envía al paciente)

              <textarea
                className="form-control"
                rows={2}
                maxLength={500}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </label>

            {/* Abre la revisión de las propuestas seleccionadas. */}
            <button
              type="button"
              className="btn btn-saps"
              disabled={
                !selected.length ||
                selected.length > 100 ||
                motivo.trim().length < 3
              }
              onClick={() => setConfirming(true)}
            >
              Revisar {selected.length} reprogramaciones
            </button>

            {selected.length > 100 && (
              <p role="alert">
                Confirmá hasta 100 turnos por vez; dejá el resto pendiente.
              </p>
            )}
          </>
        )}

        {/* Permite guardar cuando no existen turnos afectados. */}
        {ready && !turnos.length && (
          <div className="alert alert-success">
            <p>
              {persistido
                ? 'No quedan turnos afectados en tu alcance. El feriado permanece vigente.'
                : 'No quedan turnos afectados. Falta confirmar el cambio de agenda.'}
            </p>

            {persistido ? (
              <button
                type="button"
                className="btn btn-saps"
                onClick={onClose}
              >
                Volver al calendario
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-saps"
                onClick={() => setSaving(true)}
              >
                {inactive
                  ? 'Revisar desactivación'
                  : closure
                    ? 'Revisar y guardar cierre institucional'
                    : absence
                      ? 'Revisar y guardar ausencia / cierre'
                      : 'Revisar y guardar horario'}
              </button>
            )}
          </div>
        )}
      </fieldset>

      {/* Confirma las reprogramaciones seleccionadas. */}
      <ConfirmationModal
        open={confirming}
        title="Revisar reprogramaciones"
        confirmText="Confirmar reprogramaciones"
        loading={busy}
        message={`Se intentarán reprogramar ${selected.length} turnos. Se enviarán avisos por los canales disponibles del paciente.`}
        detail={
          <>
            {error && (
              <p
                className="text-danger"
                role="alert"
              >
                {error}
              </p>
            )}

            <AgendaReview
              turnos={turnos}
              propuestas={selected}
            />
          </>
        }
        notice={`El servidor vuelve a comprobar cada horario y cupo. Si alguno dejó de estar disponible, queda pendiente; los confirmados se conservan. ${
          persistido
            ? 'El feriado ya está guardado.'
            : 'Después debés guardar el cambio de agenda.'
        }`}
        onClose={() => {
          if (!busy) {
            setConfirming(false);
          }
        }}
        onConfirm={() =>
          void run(async () => {
            // Envía las propuestas seleccionadas al servidor.
            const data = await confirmAgendaProposal(
              cambio,
              motivo.trim(),
              selected
            );

            // Asocia cada resultado con el nombre del paciente.
            setResultados(
              data.resultados.map((r) => {
                const t = turnos.find(
                  (t) => t.id_turno === r.id_turno
                );

                return {
                  ...r,
                  paciente: t
                    ? `${t.paciente.persona.apellidos}, ${t.paciente.persona.nombres}`
                    : 'Paciente',
                };
              })
            );

            // Limpia las propuestas y actualiza los turnos afectados.
            setConfirming(false);
            setPropuestas([]);

            await refresh();
          })
        }
      />

      {/* Confirma y guarda la configuración de agenda. */}
      <ConfirmationModal
        open={saving}
        title="Confirmar cambio de agenda"
        confirmText="Guardar cambio"
        loading={busy}
        message={description}
        detail={
          <>
            {error && (
              <p
                className="text-danger"
                role="alert"
              >
                {error}
              </p>
            )}

            <p>{context}</p>

            <p>
              {inactive
                ? 'La regla quedará inactiva.'
                : closure
                  ? 'Se cerrará la atención en el alcance y período indicados.'
                  : absence
                    ? cambio.datos.motivo
                    : 'Se actualizará el horario habitual.'}
            </p>
          </>
        }
        notice="Esta acción guarda la configuración. Los turnos ya reprogramados conservan sus cambios."
        onClose={() => {
          if (!busy) {
            setSaving(false);
          }
        }}
        onConfirm={() =>
          void run(async () => {
            // Guarda la configuración según el tipo de cambio.
            if (cambio.tipo === 'horario') {
              await guardarHorario(
                cambio.datos,
                cambio.id
              );
            } else if (cambio.tipo === 'cierre') {
              await guardarCierre(
                cambio.datos,
                cambio.id
              );
            } else {
              await guardarBloqueo(
                cambio.datos,
                cambio.id
              );
            }

            // Informa al componente padre que el cambio fue guardado.
            onSaved();
          })
        }
      />
    </section>
  );
}