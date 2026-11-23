import { ActionInlineFeedback } from '../ui/FormFeedback';
import ValidatedInput from '../ui/ValidatedInput';
import { focusFirstInvalidControl } from '../../utils/form-feedback';

import {
  useEffect,
  useState,
} from 'react';

import type {
  Professional,
  ProfessionalSex,
} from '../../types/profesional.types';

export interface ProfessionalFormData {
  dni: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  sexo: ProfessionalSex;
  telefono: string;
  email: string;
  direccion: string;
  localidad: string;
  provincia: string;
  codigo_postal: string;
  matricula: string;
}

interface ProfesionalFormProps {
  professional?: Professional | null;
  loading?: boolean;
  error?: string | null;
  onDismissError?: () => void;
  onSubmit: (
    data: ProfessionalFormData
  ) => Promise<void>;
  onCancel: () => void;
}

// Valores iniciales del formulario.
const emptyForm: ProfessionalFormData = {
  dni: '',
  nombres: '',
  apellidos: '',
  fecha_nacimiento: '',
  sexo: 'NO_INFORMA',
  telefono: '',
  email: '',
  direccion: '',
  localidad: '',
  provincia: '',
  codigo_postal: '',
  matricula: '',
};

const ProfesionalForm = ({
  professional,
  loading = false,
  error,
  onDismissError,
  onSubmit,
  onCancel,
}: ProfesionalFormProps) => {
  const [form, setForm] =
    useState<ProfessionalFormData>(
      emptyForm
    );
  const [validationError, setValidationError] = useState<string | null>(null);

  // Carga los datos cuando se edita un profesional.
  useEffect(() => {
    if (!professional) {
      setForm(emptyForm);
      return;
    }

    const persona =
      professional.persona;

    setForm({
      dni: persona.dni,
      nombres: persona.nombres,
      apellidos: persona.apellidos,
      fecha_nacimiento:
        persona.fecha_nacimiento ?? '',
      sexo:
        persona.sexo ?? 'NO_INFORMA',
      telefono:
        persona.telefono ?? '',
      email:
        persona.email ?? '',
      direccion:
        persona.direccion ?? '',
      localidad:
        persona.localidad ?? '',
      provincia:
        persona.provincia ?? '',
      codigo_postal:
        persona.codigo_postal ?? '',
      matricula:
        professional.matricula,
    });
  }, [professional]);

  // Actualiza un campo del formulario.
  const handleChange = (
    field: keyof ProfessionalFormData,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  // Normaliza y envía los datos del formulario.
  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setValidationError(null);

    if (!event.currentTarget.checkValidity()) {
      const invalidEl = focusFirstInvalidControl(event.currentTarget);
      const fallbackMsg =
        (invalidEl instanceof HTMLInputElement ||
          invalidEl instanceof HTMLSelectElement ||
          invalidEl instanceof HTMLTextAreaElement) &&
        invalidEl.validationMessage
          ? invalidEl.validationMessage
          : 'Revisá los campos obligatorios resaltados.';
      setValidationError(fallbackMsg);
      return;
    }

    await onSubmit({
      ...form,
      dni: form.dni.trim(),
      nombres: form.nombres.trim(),
      apellidos: form.apellidos.trim(),
      telefono: form.telefono.trim(),
      email: form.email.trim(),
      direccion: form.direccion.trim(),
      localidad: form.localidad.trim(),
      provincia: form.provincia.trim(),
      codigo_postal:
        form.codigo_postal.trim(),
      matricula:
        form.matricula.trim(),
    });
  };

  const activeError = validationError || error || null;

  return (
    <form noValidate onSubmit={handleSubmit}>
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white py-3">
          <h5 className="mb-0 fw-bold">
            <i className="bi bi-person-badge me-2 text-success" />
            Datos profesionales
          </h5>
        </div>

        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">
                Matrícula *
              </label>

              <ValidatedInput
                field="matricula"
                type="text"
                className="form-control"
                value={form.matricula}
                onChange={(event) =>
                  handleChange(
                    'matricula',
                    event.target.value
                  )
                }
                required
              />
            </div>

            <div className="col-md-4">
              <label className="form-label">
                DNI *
              </label>

              <ValidatedInput
                field="dni"
                type="text"
                className="form-control"
                value={form.dni}
                onChange={(event) =>
                  handleChange(
                    'dni',
                    event.target.value
                  )
                }
                required
              />
            </div>

            <div className="col-md-4">
              <label className="form-label">
                Estado
              </label>

              <input
                type="text"
                className="form-control"
                value={
                  professional
                    ? professional.activo
                      ? 'Activo'
                      : 'Inactivo'
                    : 'Nuevo profesional'
                }
                disabled
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">
                Nombres *
              </label>

              <ValidatedInput
                field="nombres"
                type="text"
                className="form-control"
                value={form.nombres}
                onChange={(event) =>
                  handleChange(
                    'nombres',
                    event.target.value
                  )
                }
                required
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">
                Apellidos *
              </label>

              <ValidatedInput
                field="apellidos"
                type="text"
                className="form-control"
                value={form.apellidos}
                onChange={(event) =>
                  handleChange(
                    'apellidos',
                    event.target.value
                  )
                }
                required
              />
            </div>

            <div className="col-md-4">
              <label className="form-label">
                Fecha de nacimiento
              </label>

              <ValidatedInput
                field="fecha_nacimiento"
                type="date"
                className="form-control"
                value={form.fecha_nacimiento}
                onChange={(event) =>
                  handleChange(
                    'fecha_nacimiento',
                    event.target.value
                  )
                }
              />
            </div>

            <div className="col-md-4">
              <label className="form-label">
                Sexo
              </label>

              <select
                className="form-select"
                value={form.sexo}
                onChange={(event) =>
                  handleChange(
                    'sexo',
                    event.target.value
                  )
                }
              >
                <option value="NO_INFORMA">
                  No informa
                </option>

                <option value="FEMENINO">
                  Femenino
                </option>

                <option value="MASCULINO">
                  Masculino
                </option>

                <option value="X">
                  X
                </option>
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">
                Teléfono
              </label>

              <ValidatedInput
                field="telefono"
                type="text"
                className="form-control"
                value={form.telefono}
                onChange={(event) =>
                  handleChange(
                    'telefono',
                    event.target.value
                  )
                }
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">
                Email
              </label>

              <ValidatedInput
                field="email"
                type="email"
                className="form-control"
                value={form.email}
                onChange={(event) =>
                  handleChange(
                    'email',
                    event.target.value
                  )
                }
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">
                Dirección
              </label>

              <ValidatedInput
                field="direccion"
                type="text"
                className="form-control"
                value={form.direccion}
                onChange={(event) =>
                  handleChange(
                    'direccion',
                    event.target.value
                  )
                }
              />
            </div>

            <div className="col-md-4">
              <label className="form-label">
                Localidad
              </label>

              <input
                type="text"
                className="form-control"
                value={form.localidad}
                onChange={(event) =>
                  handleChange(
                    'localidad',
                    event.target.value
                  )
                }
              />
            </div>

            <div className="col-md-4">
              <label className="form-label">
                Provincia
              </label>

              <input
                type="text"
                className="form-control"
                value={form.provincia}
                onChange={(event) =>
                  handleChange(
                    'provincia',
                    event.target.value
                  )
                }
              />
            </div>

            <div className="col-md-4">
              <label className="form-label">
                Código postal
              </label>

              <input
                type="text"
                className="form-control"
                value={form.codigo_postal}
                onChange={(event) =>
                  handleChange(
                    'codigo_postal',
                    event.target.value
                  )
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex flex-column gap-2 mb-4">
        {activeError && (
          <ActionInlineFeedback
            variant="error"
            message={activeError}
            onDismiss={() => {
              setValidationError(null);
              onDismissError?.();
            }}
          />
        )}
        <div className="d-flex justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="btn btn-saps"
            disabled={loading}
          >
            {loading ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                />
                Guardando...
              </>
            ) : (
              <>
                <i className="bi bi-check-lg me-2" />
                {professional
                  ? 'Guardar cambios'
                  : 'Registrar profesional'}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ProfesionalForm;