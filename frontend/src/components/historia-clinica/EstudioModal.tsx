import { useState, type FormEvent } from 'react';

import {
  actualizarEstadoEstudio,
  extractClinicalApiError,
  informarEstudioClinico,
} from '../../services/historia-clinica.service';
import type { EstudioClinico } from '../../types/historia-clinica.types';
import { getNowArgentinaDateTimeLocal, toArgentinaOffsetIso } from '../../utils/historia-clinica-format';

interface EstudioModalProps {
  open: boolean;
  mode: 'status' | 'inform';
  idSalita: string;
  estudio: EstudioClinico | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function EstudioModal({
  open,
  mode,
  idSalita,
  estudio,
  onClose,
  onSaved,
}: EstudioModalProps) {
  const [estado, setEstado] = useState<'EN_PROCESO' | 'CANCELADO'>('EN_PROCESO');
  const [resultado, setResultado] = useState('');
  const [fechaResultado, setFechaResultado] = useState(getNowArgentinaDateTimeLocal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !estudio) return null;

  const isInform = mode === 'inform';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (isInform && resultado.trim().length < 2) {
      setError('Ingresá el resultado clínico del estudio (mínimo 2 caracteres).');
      return;
    }

    setSaving(true);
    try {
      if (isInform) {
        await informarEstudioClinico(estudio.id_estudio, {
          id_salita: idSalita,
          resultado: resultado.trim(),
          fecha_resultado: fechaResultado ? toArgentinaOffsetIso(fechaResultado) : undefined,
        });
        onSaved('Resultado del estudio informado y completado correctamente.');
      } else {
        await actualizarEstadoEstudio(estudio.id_estudio, {
          id_salita: idSalita,
          estado,
        });
        onSaved(`Estado del estudio actualizado a ${estado}.`);
      }

      setResultado('');
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
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <h5 className="modal-title d-flex align-items-center gap-2">
                <i className={`bi ${isInform ? 'bi-clipboard2-check' : 'bi-arrow-repeat'} text-primary`} />
                {isInform ? 'Informar resultado de estudio' : 'Actualizar estado de estudio'}
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

                <div className="p-3 bg-light rounded border">
                  <div className="small text-muted">Estudio solicitado</div>
                  <div className="fw-semibold">{estudio.tipo_estudio}</div>
                  <div className="small">{estudio.descripcion}</div>
                </div>

                {isInform ? (
                  <>
                    <div>
                      <label className="form-label fw-semibold" htmlFor="hc-estudio-resultado">
                        Resultado informado *
                      </label>
                      <textarea
                        id="hc-estudio-resultado"
                        className="form-control"
                        rows={4}
                        maxLength={4000}
                        placeholder="Detallá el informe o hallazgos del estudio..."
                        value={resultado}
                        onChange={(e) => setResultado(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label fw-semibold" htmlFor="hc-estudio-fecha">
                        Fecha del resultado
                      </label>
                      <input
                        id="hc-estudio-fecha"
                        type="datetime-local"
                        className="form-control"
                        value={fechaResultado}
                        onChange={(e) => setFechaResultado(e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="form-label fw-semibold" htmlFor="hc-estudio-estado">
                      Nuevo estado *
                    </label>
                    <select
                      id="hc-estudio-estado"
                      className="form-select"
                      value={estado}
                      onChange={(e) =>
                        setEstado(e.target.value as 'EN_PROCESO' | 'CANCELADO')
                      }
                    >
                      <option value="EN_PROCESO">EN PROCESO</option>
                      <option value="CANCELADO">CANCELADO</option>
                    </select>
                  </div>
                )}
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
                    : isInform
                      ? 'Informar resultado'
                      : 'Actualizar estado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
