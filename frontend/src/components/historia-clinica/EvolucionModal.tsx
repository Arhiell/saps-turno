import { useState, type FormEvent } from 'react';

import {
  extractClinicalApiError,
  rectificarEvolucionClinica,
  registrarEvolucionClinica,
} from '../../services/historia-clinica.service';
import type { EvolucionClinica } from '../../types/historia-clinica.types';
import { formatArgentinaDateTime } from '../../utils/historia-clinica-format';

interface EvolucionModalProps {
  open: boolean;
  mode: 'create' | 'rectify';
  idSalita: string;
  idConsulta: string;
  targetEvolucion?: EvolucionClinica | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function EvolucionModal({
  open,
  mode,
  idSalita,
  idConsulta,
  targetEvolucion,
  onClose,
  onSaved,
}: EvolucionModalProps) {
  const [evolucion, setEvolucion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [motivoCorreccion, setMotivoCorreccion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const isRectify = mode === 'rectify' && Boolean(targetEvolucion);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (evolucion.trim().length < 3) {
      setError('Ingresá el detalle clínico de la evolución (mínimo 3 caracteres).');
      return;
    }

    if (isRectify && motivoCorreccion.trim().length < 3) {
      setError('Indicá el motivo de la rectificación (mínimo 3 caracteres).');
      return;
    }

    setSaving(true);
    try {
      if (isRectify && targetEvolucion) {
        await rectificarEvolucionClinica(targetEvolucion.id_evolucion, {
          id_salita: idSalita,
          evolucion: evolucion.trim(),
          motivo_correccion: motivoCorreccion.trim(),
          observaciones: observaciones.trim() || null,
        });
        onSaved('Evolución rectificada correctamente. El registro original permanece trazable.');
      } else {
        await registrarEvolucionClinica(idConsulta, {
          id_salita: idSalita,
          evolucion: evolucion.trim(),
          observaciones: observaciones.trim() || null,
        });
        onSaved('Evolución clínica registrada correctamente.');
      }

      setEvolucion('');
      setObservaciones('');
      setMotivoCorreccion('');
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
                <i className={`bi ${isRectify ? 'bi-pencil-square' : 'bi-file-earmark-plus'} text-primary`} />
                {isRectify ? 'Rectificar evolución clínica' : 'Registrar nueva evolución clínica'}
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Cerrar"
                disabled={saving}
                onClick={onClose}
              />
            </div>

            <form onSubmit={(e) => void handleSubmit(e)}>
              <div className="modal-body d-grid gap-3">
                {error && (
                  <div className="alert alert-danger mb-0" role="alert">
                    {error}
                  </div>
                )}

                {isRectify && targetEvolucion && (
                  <div className="hc-rectification-box">
                    <div className="small text-muted mb-1">
                      Evolución original v{targetEvolucion.version} ({formatArgentinaDateTime(targetEvolucion.fecha_evolucion)}) — Inmutable
                    </div>
                    <p className="mb-1 fw-medium">{targetEvolucion.evolucion}</p>
                    {targetEvolucion.observaciones && (
                      <p className="mb-0 small text-muted">
                        Observaciones originales: {targetEvolucion.observaciones}
                      </p>
                    )}
                  </div>
                )}

                {isRectify && (
                  <div>
                    <label className="form-label fw-semibold" htmlFor="hc-motivo-correccion">
                      Motivo de la rectificación *
                    </label>
                    <input
                      id="hc-motivo-correccion"
                      type="text"
                      className="form-control"
                      maxLength={300}
                      placeholder="Ej.: Aclaración de dosis indicada o corrección de hallazgo clínico"
                      value={motivoCorreccion}
                      onChange={(e) => setMotivoCorreccion(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="form-label fw-semibold" htmlFor="hc-evolucion-texto">
                    {isRectify ? 'Nuevo texto de evolución rectificada *' : 'Detalle de evolución *'}
                  </label>
                  <textarea
                    id="hc-evolucion-texto"
                    className="form-control"
                    rows={4}
                    maxLength={4000}
                    placeholder="Describí la evolución clínica del paciente..."
                    value={evolucion}
                    onChange={(e) => setEvolucion(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label fw-semibold" htmlFor="hc-evolucion-obs">
                    Observaciones adicionales (opcional)
                  </label>
                  <textarea
                    id="hc-evolucion-obs"
                    className="form-control"
                    rows={2}
                    maxLength={2000}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
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
                    ? 'Guardando...'
                    : isRectify
                      ? 'Confirmar rectificación'
                      : 'Registrar evolución'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
