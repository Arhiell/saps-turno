import type { CompletePersonInput } from '../../types/auth.types';

import ValidatedInput from './ValidatedInput';

// Define los campos personales y sus longitudes máximas.
const fields = [
  ['dni', 'DNI', 15],
  ['nombres', 'Nombres', 100],
  ['apellidos', 'Apellidos', 100],
  ['telefono', 'Teléfono', 30],
  ['direccion', 'Dirección', 250],
  ['localidad', 'Localidad', 120],
  ['provincia', 'Provincia', 120],
  ['codigo_postal', 'Código postal', 12],
] as const;

// Muestra los campos del perfil utilizando las validaciones compartidas.
export default function PersonProfileFields({
  value,
  onChange,
  editing = false,
}: {
  value: CompletePersonInput;
  onChange: (value: CompletePersonInput) => void;
  editing?: boolean;
}) {
  return (
    <div className="row g-3">
      {/* Genera los campos de información personal. */}
      {fields.map(([key, label, max]) => (
        <div
          className="col-12 col-md-6"
          key={key}
        >
          <label className="form-label w-100">
            {label}
            {['dni', 'nombres', 'apellidos'].includes(key) ? ' *' : ''}

            <ValidatedInput
              field={key}
              className="form-control mt-1"
              readOnly={editing && key === 'dni'}
              value={value[key] ?? ''}
              maxLength={max}
              type={key === 'telefono' ? 'tel' : 'text'}
              required={['dni', 'nombres', 'apellidos'].includes(key)}
              onChange={event =>
                onChange({
                  ...value,
                  [key]: event.target.value,
                })
              }
            />
          </label>
        </div>
      ))}

      {/* Permite ingresar la fecha de nacimiento. */}
      <div className="col-12 col-md-6">
        <label className="form-label w-100">
          Fecha de nacimiento

          <ValidatedInput
            field="fecha_nacimiento"
            type="date"
            className="form-control mt-1"
            readOnly={editing}
            value={value.fecha_nacimiento ?? ''}
            max={new Date().toISOString().slice(0, 10)}
            onChange={event =>
              onChange({
                ...value,
                fecha_nacimiento: event.target.value || null,
              })
            }
          />
        </label>
      </div>

      {/* Permite seleccionar el sexo de la persona. */}
      <div className="col-12 col-md-6">
        <label className="form-label w-100">
          Sexo

          <select
            className="form-select mt-1"
            value={value.sexo ?? ''}
            disabled={editing}
            onChange={event =>
              onChange({
                ...value,
                sexo: (event.target.value || null) as CompletePersonInput['sexo'],
              })
            }
          >
            <option value="">
              Seleccioná una opción
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

            <option value="NO_INFORMA">
              Prefiero no informar
            </option>
          </select>
        </label>
      </div>
    </div>
  );
}