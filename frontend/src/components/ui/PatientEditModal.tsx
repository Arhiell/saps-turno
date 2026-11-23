import { useState, useEffect } from 'react';
import ValidatedInput from './ValidatedInput';
import ConfirmationModal from './ConfirmationModal';
import { personFieldsError } from '../../utils/field-validation';
import type { Patient, PatientSex, UpdatePatientRequest } from '../../types/patient.types';

interface PatientEditModalProps {
  open: boolean;
  patient: Patient;
  saving: boolean;
  error?: string;
  onClose: () => void;
  onSave: (form: UpdatePatientRequest) => Promise<void>;
}

export default function PatientEditModal({
  open,
  patient,
  saving,
  error: externalError,
  onClose,
  onSave,
}: PatientEditModalProps) {
  const [form, setForm] = useState<UpdatePatientRequest>({});
  const [validationError, setValidationError] = useState('');
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);

  // Inicializa el formulario al abrir el modal con los datos actuales del paciente
  useEffect(() => {
    if (open && patient) {
      setForm({
        nombres: patient.nombres,
        apellidos: patient.apellidos,
        fecha_nacimiento: patient.fecha_nacimiento,
        sexo: patient.sexo,
        telefono: patient.telefono,
        email: patient.email,
        direccion: patient.direccion,
        localidad: patient.localidad ?? '',
        provincia: patient.provincia ?? '',
        codigo_postal: patient.codigo_postal,
        obra_social: patient.obra_social,
        numero_afiliado: patient.numero_afiliado,
        contacto_emergencia_nombre: patient.contacto_emergencia_nombre,
        contacto_emergencia_telefono: patient.contacto_emergencia_telefono,
      });
      setValidationError('');
      setConfirmExitOpen(false);
    }
  }, [open, patient]);

  if (!open) return null;

  // Detecta si existen cambios sin guardar
  const hasChanges = () => {
    if (!patient) return false;
    return (
      (form.nombres ?? '') !== (patient.nombres ?? '') ||
      (form.apellidos ?? '') !== (patient.apellidos ?? '') ||
      (form.fecha_nacimiento ?? '') !== (patient.fecha_nacimiento ?? '') ||
      (form.sexo ?? null) !== (patient.sexo ?? null) ||
      (form.telefono ?? '') !== (patient.telefono ?? '') ||
      (form.email ?? '') !== (patient.email ?? '') ||
      (form.direccion ?? '') !== (patient.direccion ?? '') ||
      (form.localidad ?? '') !== (patient.localidad ?? '') ||
      (form.provincia ?? '') !== (patient.provincia ?? '') ||
      (form.codigo_postal ?? '') !== (patient.codigo_postal ?? '') ||
      (form.obra_social ?? '') !== (patient.obra_social ?? '') ||
      (form.numero_afiliado ?? '') !== (patient.numero_afiliado ?? '') ||
      (form.contacto_emergencia_nombre ?? '') !== (patient.contacto_emergencia_nombre ?? '') ||
      (form.contacto_emergencia_telefono ?? '') !== (patient.contacto_emergencia_telefono ?? '')
    );
  };

  const handleFieldChange = (field: keyof UpdatePatientRequest, value: string | null) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRequestClose = () => {
    if (saving) return;
    if (hasChanges()) {
      setConfirmExitOpen(true);
    } else {
      onClose();
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError('');

    const err = personFieldsError(form);
    if (err) {
      setValidationError(err);
      return;
    }

    await onSave(form);
  };

  return (
    <>
      <ConfirmationModal
        open={confirmExitOpen}
        title="Cambios sin guardar"
        subtitle="Si salís ahora, se perderán las modificaciones no guardadas."
        message="¿Querés salir de la edición del paciente sin guardar los cambios?"
        confirmText="Salir sin guardar"
        cancelText="Continuar editando"
        variant="warning"
        icon="bi-exclamation-triangle"
        onClose={() => setConfirmExitOpen(false)}
        onConfirm={() => {
          setConfirmExitOpen(false);
          onClose();
        }}
      />

      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }} />

      <div
        className="modal d-block fade show"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-edit-modal-title"
        style={{ zIndex: 1055 }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !saving) {
            handleRequestClose();
          }
        }}
      >
        <div
          className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
          role="document"
          style={{
            width: '95%',
            maxWidth: '960px',
            margin: '1.5rem auto',
          }}
        >
          <div className="modal-content border-0 shadow-lg">
            {/* Cabecera fija */}
            <div className="modal-header bg-white border-bottom py-3 px-4 d-flex align-items-center justify-content-between">
              <div>
                <h5 className="modal-title fw-bold text-dark mb-0 d-flex align-items-center gap-2" id="patient-edit-modal-title">
                  <i className="bi bi-pencil-square text-success" />
                  Editar ficha del paciente
                </h5>
                <small className="text-muted d-block mt-0.5">
                  {patient.apellidos}, {patient.nombres} — DNI {patient.dni}
                </small>
              </div>

              <button
                type="button"
                className="btn-close"
                aria-label="Cerrar modal"
                disabled={saving}
                onClick={handleRequestClose}
              />
            </div>

            {/* Formulario con scroll independiente */}
            <form onSubmit={handleSubmit} className="d-flex flex-column" style={{ minHeight: 0 }}>
              <div
                className="modal-body p-4"
                style={{
                  maxHeight: 'calc(85vh - 140px)',
                  overflowY: 'auto',
                }}
              >
                {(validationError || externalError) && (
                  <div className="alert alert-danger d-flex align-items-center gap-2 mb-4" role="alert">
                    <i className="bi bi-exclamation-octagon-fill fs-5 flex-shrink-0" />
                    <div>{validationError || externalError}</div>
                  </div>
                )}

                {/* SECCIÓN 1: DATOS PERSONALES */}
                <div className="mb-4">
                  <h6 className="fw-bold text-success border-bottom pb-2 mb-3 d-flex align-items-center gap-2">
                    <i className="bi bi-person-lines-fill" />
                    1. Datos personales
                  </h6>

                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold text-secondary">
                        DNI <span className="text-muted fw-normal">(no editable)</span>
                      </label>
                      <input
                        type="text"
                        className="form-control bg-light"
                        value={patient.dni}
                        disabled
                        readOnly
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-semibold text-secondary">
                        Nombres <span className="text-danger">*</span>
                      </label>
                      <ValidatedInput
                        field="nombres"
                        type="text"
                        className="form-control"
                        value={form.nombres ?? ''}
                        disabled={saving}
                        onChange={(e) => handleFieldChange('nombres', e.target.value)}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-semibold text-secondary">
                        Apellidos <span className="text-danger">*</span>
                      </label>
                      <ValidatedInput
                        field="apellidos"
                        type="text"
                        className="form-control"
                        value={form.apellidos ?? ''}
                        disabled={saving}
                        onChange={(e) => handleFieldChange('apellidos', e.target.value)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary">
                        Fecha de nacimiento
                      </label>
                      <ValidatedInput
                        field="fecha_nacimiento"
                        type="date"
                        className="form-control"
                        value={form.fecha_nacimiento ?? ''}
                        disabled={saving}
                        onChange={(e) => handleFieldChange('fecha_nacimiento', e.target.value || null)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary">
                        Sexo biológico / legal
                      </label>
                      <select
                        className="form-select"
                        value={form.sexo ?? ''}
                        disabled={saving}
                        onChange={(e) =>
                          handleFieldChange('sexo', e.target.value ? (e.target.value as PatientSex) : null)
                        }
                      >
                        <option value="">No informado</option>
                        <option value="FEMENINO">Femenino</option>
                        <option value="MASCULINO">Masculino</option>
                        <option value="X">X</option>
                        <option value="NO_INFORMA">No informa</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECCIÓN 2: CONTACTO Y DOMICILIO */}
                <div className="mb-4">
                  <h6 className="fw-bold text-success border-bottom pb-2 mb-3 d-flex align-items-center gap-2">
                    <i className="bi bi-geo-alt-fill" />
                    2. Contacto y domicilio
                  </h6>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary">
                        Teléfono principal
                      </label>
                      <ValidatedInput
                        field="telefono"
                        type="text"
                        className="form-control"
                        placeholder="Ej. 3794123456"
                        value={form.telefono ?? ''}
                        disabled={saving}
                        onChange={(e) => handleFieldChange('telefono', e.target.value || null)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary">
                        Correo electrónico
                      </label>
                      <ValidatedInput
                        field="email"
                        type="email"
                        className="form-control"
                        placeholder="ejemplo@correo.com"
                        value={form.email ?? ''}
                        disabled={saving}
                        onChange={(e) => handleFieldChange('email', e.target.value || null)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary">
                        Dirección (calle y número)
                      </label>
                      <ValidatedInput
                        field="direccion"
                        type="text"
                        className="form-control"
                        placeholder="Ej. Av. 3 de Abril 1234"
                        value={form.direccion ?? ''}
                        disabled={saving}
                        onChange={(e) => handleFieldChange('direccion', e.target.value || null)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary">
                        Localidad
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej. Corrientes"
                        value={form.localidad ?? ''}
                        disabled={saving}
                        onChange={(e) => handleFieldChange('localidad', e.target.value)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary">
                        Provincia
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej. Corrientes"
                        value={form.provincia ?? ''}
                        disabled={saving}
                        onChange={(e) => handleFieldChange('provincia', e.target.value)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary">
                        Código postal
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej. 3400"
                        value={form.codigo_postal ?? ''}
                        disabled={saving}
                        onChange={(e) => handleFieldChange('codigo_postal', e.target.value || null)}
                      />
                    </div>
                  </div>
                </div>

                {/* SECCIÓN 3: DATOS SANITARIOS Y EMERGENCIA */}
                <div>
                  <h6 className="fw-bold text-success border-bottom pb-2 mb-3 d-flex align-items-center gap-2">
                    <i className="bi bi-shield-plus" />
                    3. Cobertura médica y contacto de emergencia
                  </h6>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary">
                        Obra social / Cobertura
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej. IOSCOR, PAMI, Ninguna"
                        value={form.obra_social ?? ''}
                        disabled={saving}
                        onChange={(e) => handleFieldChange('obra_social', e.target.value || null)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary">
                        Número de afiliado
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej. 12345678/00"
                        value={form.numero_afiliado ?? ''}
                        disabled={saving}
                        onChange={(e) => handleFieldChange('numero_afiliado', e.target.value || null)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary">
                        Contacto de emergencia (Nombre y apellido)
                      </label>
                      <ValidatedInput
                        field="contacto_emergencia_nombre"
                        type="text"
                        className="form-control"
                        placeholder="Nombre del familiar o allegado"
                        value={form.contacto_emergencia_nombre ?? ''}
                        disabled={saving}
                        onChange={(e) => handleFieldChange('contacto_emergencia_nombre', e.target.value || null)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary">
                        Teléfono del contacto de emergencia
                      </label>
                      <ValidatedInput
                        field="contacto_emergencia_telefono"
                        type="text"
                        className="form-control"
                        placeholder="Ej. 3794987654"
                        value={form.contacto_emergencia_telefono ?? ''}
                        disabled={saving}
                        onChange={(e) => handleFieldChange('contacto_emergencia_telefono', e.target.value || null)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Pie fijo con acciones */}
              <div className="modal-footer bg-light border-top py-3 px-4 d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={saving}
                  onClick={handleRequestClose}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn btn-saps d-inline-flex align-items-center"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      Guardando cambios…
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-lg me-1.5" />
                      Guardar cambios
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
