import { useMemo, useState, type FormEvent } from 'react';

import { ActionInlineFeedback } from '../ui/FormFeedback';
import { focusFieldById, focusFirstInvalidControl } from '../../utils/form-feedback';

import {
  extractClinicalApiError,
  resolverDerivacionClinica,
  solicitarDerivacionClinica,
} from '../../services/historia-clinica.service';
import type {
  DerivacionAlcance,
  DerivacionClinica,
  DerivacionTipo,
  HistoriaClinicaContextData,
} from '../../types/historia-clinica.types';
import { getTodayArgentinaIsoDate } from '../../utils/historia-clinica-format';

interface DerivacionModalProps {
  open: boolean;
  mode: 'create' | 'resolve';
  context: HistoriaClinicaContextData;
  idPaciente: string;
  patientLabel?: string;
  defaultSalitaOrigen?: string;
  targetDerivacion?: DerivacionClinica | null;
  activeSalitaForResolve?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function DerivacionModal({
  open,
  mode,
  context,
  idPaciente,
  patientLabel,
  defaultSalitaOrigen,
  targetDerivacion,
  activeSalitaForResolve,
  onClose,
  onSaved,
}: DerivacionModalProps) {
  const today = getTodayArgentinaIsoDate();
  const [tipo, setTipo] = useState<DerivacionTipo>('DERIVACION');
  const [alcance, setAlcance] = useState<DerivacionAlcance>('ESPECIALIDAD');
  const [idSalitaOrigen, setIdSalitaOrigen] = useState(
    defaultSalitaOrigen || context.salitas_autorizadas[0]?.id_salita || ''
  );
  const [idSalitaDestino, setIdSalitaDestino] = useState('');
  const [idEspecialidadDestino, setIdEspecialidadDestino] = useState('');
  const [idProfesionalDestino, setIdProfesionalDestino] = useState('');
  const [motivo, setMotivo] = useState('');
  const [fechaDesde, setFechaDesde] = useState(today);
  const [fechaHasta, setFechaHasta] = useState(today);

  const [resolveEstado, setResolveEstado] = useState<
    'AUTORIZADA' | 'RECHAZADA' | 'REVOCADA'
  >('AUTORIZADA');
  const [resolveMotivo, setResolveMotivo] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destinationSalitas = useMemo(
    () => context.catalogo_salitas.filter((s) => s.id_salita !== idSalitaOrigen),
    [context.catalogo_salitas, idSalitaOrigen]
  );

  if (!open) return null;

  const isResolve = mode === 'resolve' && Boolean(targetDerivacion);

  const availableResolveOptions = targetDerivacion?.estado === 'PENDIENTE'
    ? [
        { value: 'AUTORIZADA', label: 'AUTORIZADA (Aprobar acceso/derivación)' },
        { value: 'RECHAZADA', label: 'RECHAZADA (Denegar solicitud)' },
      ]
    : [{ value: 'REVOCADA', label: 'REVOCADA (Revocar autorización vigente)' }];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!event.currentTarget.checkValidity()) {
      const invalidEl = focusFirstInvalidControl(event.currentTarget);
      const fallbackMessage =
        (invalidEl instanceof HTMLInputElement ||
          invalidEl instanceof HTMLSelectElement ||
          invalidEl instanceof HTMLTextAreaElement) &&
        invalidEl.validationMessage
          ? invalidEl.validationMessage
          : 'Revisá los campos obligatorios resaltados.';
      setError(fallbackMessage);
      return;
    }

    setSaving(true);

    try {
      if (isResolve && targetDerivacion) {
        const chosenEstado =
          targetDerivacion.estado === 'AUTORIZADA' ? 'REVOCADA' : resolveEstado;
        if (
          (chosenEstado === 'RECHAZADA' || chosenEstado === 'REVOCADA') &&
          resolveMotivo.trim().length < 3
        ) {
          setError('Ingresá el motivo de rechazo o revocación (mínimo 3 caracteres).');
          focusFieldById('hc-resolve-motivo', 40);
          setSaving(false);
          return;
        }

        await resolverDerivacionClinica(targetDerivacion.id_derivacion, {
          id_salita: activeSalitaForResolve || targetDerivacion.id_salita_destino,
          estado: chosenEstado,
          motivo: resolveMotivo.trim() || null,
        });
        onSaved(`Derivación actualizada a estado ${chosenEstado}.`);
      } else {
        if (!idSalitaOrigen || !idSalitaDestino) {
          setError('Seleccioná salita origen y salita destino distintas.');
          focusFieldById(!idSalitaOrigen ? 'hc-deriv-origen' : 'hc-deriv-destino', 40);
          setSaving(false);
          return;
        }
        if (alcance === 'ESPECIALIDAD' && !idEspecialidadDestino) {
          setError('Seleccioná la especialidad destino requerida.');
          focusFieldById('hc-deriv-esp', 40);
          setSaving(false);
          return;
        }
        if (
          (alcance === 'PROFESIONAL' || alcance === 'LONGITUDINAL') &&
          !idProfesionalDestino
        ) {
          setError('Seleccioná el profesional destino.');
          focusFieldById('hc-deriv-prof', 40);
          setSaving(false);
          return;
        }

        await solicitarDerivacionClinica({
          id_paciente: idPaciente,
          id_salita_origen: idSalitaOrigen,
          id_salita_destino: idSalitaDestino,
          tipo: alcance === 'LONGITUDINAL' ? 'AUTORIZACION_ACCESO' : tipo,
          alcance,
          id_profesional_destino: idProfesionalDestino || null,
          id_especialidad_destino:
            alcance === 'LONGITUDINAL' ? null : idEspecialidadDestino || null,
          motivo: motivo.trim(),
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta,
        });
        onSaved('Solicitud de derivación / autorización registrada en estado PENDIENTE.');
      }

      onClose();
    } catch (err) {
      setError(extractClinicalApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }} />
      <div
        className="modal d-block fade show"
        role="dialog"
        aria-modal="true"
        style={{ zIndex: 1055 }}
      >
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <h5 className="modal-title d-flex align-items-center gap-2">
                <i className="bi bi-arrow-left-right text-primary" />
                {isResolve ? 'Resolver derivación / autorización' : 'Solicitar derivación clínica'}
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Cerrar"
                disabled={saving}
                onClick={onClose}
              />
            </div>

            <form noValidate onSubmit={(e) => void handleSubmit(e)}>
              <div className="modal-body d-grid gap-3">

                {patientLabel && (
                  <div className="small text-muted">
                    Paciente: <strong>{patientLabel}</strong>
                  </div>
                )}

                {isResolve && targetDerivacion ? (
                  <>
                    <div className="p-3 bg-light rounded border small">
                      <div>
                        <strong>Tipo:</strong> {targetDerivacion.tipo} |{' '}
                        <strong>Alcance:</strong> {targetDerivacion.alcance} |{' '}
                        <strong>Estado actual:</strong> {targetDerivacion.estado}
                      </div>
                      <div className="mt-1">
                        <strong>Motivo original:</strong> {targetDerivacion.motivo}
                      </div>
                    </div>

                    <div>
                      <label className="form-label fw-semibold" htmlFor="hc-resolve-estado">
                        Resolución *
                      </label>
                      <select
                        id="hc-resolve-estado"
                        className="form-select"
                        value={
                          targetDerivacion.estado === 'AUTORIZADA'
                            ? 'REVOCADA'
                            : resolveEstado
                        }
                        onChange={(e) =>
                          setResolveEstado(
                            e.target.value as 'AUTORIZADA' | 'RECHAZADA' | 'REVOCADA'
                          )
                        }
                      >
                        {availableResolveOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label fw-semibold" htmlFor="hc-resolve-motivo">
                        Observación / motivo de resolución{' '}
                        {(targetDerivacion.estado === 'AUTORIZADA' ||
                          resolveEstado === 'RECHAZADA') &&
                          '*'}
                      </label>
                      <textarea
                        id="hc-resolve-motivo"
                        className="form-control"
                        rows={3}
                        maxLength={1000}
                        value={resolveMotivo}
                        onChange={(e) => setResolveMotivo(e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold" htmlFor="hc-deriv-tipo">
                        Tipo *
                      </label>
                      <select
                        id="hc-deriv-tipo"
                        className="form-select"
                        value={alcance === 'LONGITUDINAL' ? 'AUTORIZACION_ACCESO' : tipo}
                        disabled={alcance === 'LONGITUDINAL'}
                        onChange={(e) => setTipo(e.target.value as DerivacionTipo)}
                      >
                        <option value="DERIVACION">Derivación clínica</option>
                        <option value="AUTORIZACION_ACCESO">Autorización de acceso</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold" htmlFor="hc-deriv-alcance">
                        Alcance *
                      </label>
                      <select
                        id="hc-deriv-alcance"
                        className="form-select"
                        value={alcance}
                        onChange={(e) => setAlcance(e.target.value as DerivacionAlcance)}
                      >
                        <option value="ESPECIALIDAD">Por especialidad</option>
                        <option value="PROFESIONAL">Por profesional específico</option>
                        <option value="LONGITUDINAL">Acceso longitudinal (autorización)</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold" htmlFor="hc-deriv-origen">
                        Salita origen *
                      </label>
                      <select
                        id="hc-deriv-origen"
                        className="form-select"
                        value={idSalitaOrigen}
                        onChange={(e) => setIdSalitaOrigen(e.target.value)}
                        required
                      >
                        <option value="">Seleccionar salita...</option>
                        {context.salitas_autorizadas.map((s) => (
                          <option key={s.id_salita} value={s.id_salita}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold" htmlFor="hc-deriv-destino">
                        Salita destino *
                      </label>
                      <select
                        id="hc-deriv-destino"
                        className="form-select"
                        value={idSalitaDestino}
                        onChange={(e) => setIdSalitaDestino(e.target.value)}
                        required
                      >
                        <option value="">Seleccionar salita destino...</option>
                        {destinationSalitas.map((s) => (
                          <option key={s.id_salita} value={s.id_salita}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    {alcance !== 'LONGITUDINAL' && (
                      <div className="col-md-6">
                        <label className="form-label fw-semibold" htmlFor="hc-deriv-esp">
                          Especialidad destino {alcance === 'ESPECIALIDAD' ? '*' : '(opcional)'}
                        </label>
                        <select
                          id="hc-deriv-esp"
                          className="form-select"
                          value={idEspecialidadDestino}
                          onChange={(e) => setIdEspecialidadDestino(e.target.value)}
                          required={alcance === 'ESPECIALIDAD'}
                        >
                          <option value="">Seleccionar especialidad...</option>
                          {context.catalogo_especialidades.map((esp) => (
                            <option key={esp.id_especialidad} value={esp.id_especialidad}>
                              {esp.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="col-md-6">
                      <label className="form-label fw-semibold" htmlFor="hc-deriv-prof">
                        Profesional destino {alcance !== 'ESPECIALIDAD' ? '*' : '(opcional)'}
                      </label>
                      <select
                        id="hc-deriv-prof"
                        className="form-select"
                        value={idProfesionalDestino}
                        onChange={(e) => setIdProfesionalDestino(e.target.value)}
                        required={alcance !== 'ESPECIALIDAD'}
                      >
                        <option value="">Seleccionar profesional...</option>
                        {context.catalogo_profesionales.map((prof) => (
                          <option key={prof.id_profesional} value={prof.id_profesional}>
                            {prof.apellidos}, {prof.nombres} (Mat. {prof.matricula})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold" htmlFor="hc-deriv-desde">
                        Vigencia desde *
                      </label>
                      <input
                        id="hc-deriv-desde"
                        type="date"
                        className="form-control"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold" htmlFor="hc-deriv-hasta">
                        Vigencia hasta *
                      </label>
                      <input
                        id="hc-deriv-hasta"
                        type="date"
                        className="form-control"
                        value={fechaHasta}
                        min={fechaDesde}
                        onChange={(e) => setFechaHasta(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label fw-semibold" htmlFor="hc-deriv-motivo">
                        Motivo clínico / autorización *
                      </label>
                      <textarea
                        id="hc-deriv-motivo"
                        className="form-control"
                        rows={3}
                        minLength={5}
                        maxLength={1000}
                        placeholder="Justificación clínica de la derivación o solicitud de acceso (mínimo 5 caracteres)..."
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer flex-column align-items-stretch gap-2">
                {error && (
                  <ActionInlineFeedback
                    variant="error"
                    message={error}
                    onDismiss={() => setError(null)}
                  />
                )}
                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={saving}
                    onClick={onClose}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving
                      ? 'Procesando...'
                      : isResolve
                        ? 'Confirmar resolución'
                        : 'Enviar solicitud'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
