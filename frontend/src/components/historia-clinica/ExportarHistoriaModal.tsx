import { useState, type FormEvent } from 'react';

import {
  extractClinicalApiError,
  getHistoriaClinicaPaciente,
} from '../../services/historia-clinica.service';

interface ExportarHistoriaModalProps {
  open: boolean;
  idPaciente: string;
  idSalita: string;
  idEspecialidad?: string;
  patientName: string;
  onClose: () => void;
  onExported: (message: string) => void;
}

export default function ExportarHistoriaModal({
  open,
  idPaciente,
  idSalita,
  idEspecialidad,
  patientName,
  onClose,
  onExported,
}: ExportarHistoriaModalProps) {
  const [motivoAcceso, setMotivoAcceso] = useState('Exportación de historia clínica');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (motivoAcceso.trim().length < 3) {
      setError('Ingresá un motivo válido para registrar en la auditoría de exportación.');
      return;
    }

    setLoading(true);
    try {
      await getHistoriaClinicaPaciente(idPaciente, {
        id_salita: idSalita,
        id_especialidad: idEspecialidad || undefined,
        motivo_acceso: motivoAcceso.trim(),
        es_exportacion: true,
      });

      onClose();
      onExported('Exportación registrada en auditoría clínica. Generando vista de impresión...');
      setTimeout(() => {
        window.print();
      }, 150);
    } catch (err) {
      setError(extractClinicalApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop fade show no-print" style={{ zIndex: 1050 }} />
      <div
        className="modal d-block fade show no-print"
        role="dialog"
        aria-modal="true"
        style={{ zIndex: 1055 }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <h5 className="modal-title d-flex align-items-center gap-2">
                <i className="bi bi-printer text-primary" />
                Exportar / Imprimir historia clínica
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Cerrar"
                disabled={loading}
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

                <div className="alert alert-info mb-0 small">
                  Toda exportación de historia clínica queda registrada de forma inmutable en la auditoría clínica (usuario, salita, fecha y motivo).
                </div>

                <div className="small text-muted">
                  Paciente: <strong>{patientName}</strong>
                </div>

                <div>
                  <label className="form-label fw-semibold" htmlFor="hc-export-motivo">
                    Motivo de exportación *
                  </label>
                  <input
                    id="hc-export-motivo"
                    type="text"
                    className="form-control"
                    minLength={3}
                    maxLength={300}
                    value={motivoAcceso}
                    onChange={(e) => setMotivoAcceso(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={loading}
                  onClick={onClose}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Registrando exportación...' : 'Registrar e imprimir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
