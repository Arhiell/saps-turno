
import { useState } from 'react';

import {
  tiposCierre,
  type CierreInput,
} from '../../types/cierre-calendario.types';

import type { Salita } from '../../types/salita.types';

import {
  agendaDate,
  agendaToday,
} from '../../utils/agenda-display';

// Define las propiedades del formulario de cierres institucionales.
interface Props {
  initial?: CierreInput;
  superAdmin: boolean;
  salitas: Salita[];
  onReview: (data: CierreInput) => void;
  onCancel: () => void;
}

// Permite crear o modificar feriados y cierres institucionales.
export default function CierreForm({
  initial,
  superAdmin,
  salitas,
  onReview,
  onCancel,
}: Props) {
  // Inicializa los datos con los valores existentes o predeterminados.
  const [data, setData] = useState<CierreInput>(
    () =>
      initial ?? {
        titulo: '',
        observaciones: '',
        tipo: 'ASUETO',
        alcance: superAdmin ? 'GLOBAL' : 'SALITA',
        id_salita: superAdmin
          ? null
          : salitas.find((s) => s.activo)?.id_salita ?? null,
        fecha_inicio: agendaToday(),
        fecha_fin: agendaToday(),
        dia_completo: true,
        hora_inicio: null,
        hora_fin: null,
        origen: 'Carga administrativa',
        activo: true,
      }
  );

  // Almacena los errores de validación del formulario.
  const [error, setError] = useState('');

  // Actualiza parcialmente los datos del cierre.
  const change = (patch: Partial<CierreInput>) =>
    setData((old) => ({
      ...old,
      ...patch,
    }));

  return (
    <form
      className="dashboard-panel p-3 mb-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');

        // Exige una salita cuando el alcance no es global.
        if (
          data.alcance === 'SALITA' &&
          !data.id_salita
        ) {
          setError('Seleccioná una salita.');
          return;
        }

        // Verifica que la fecha final no sea anterior a la inicial.
        if (data.fecha_fin < data.fecha_inicio) {
          setError(
            'La fecha final debe ser igual o posterior a la inicial.'
          );
          return;
        }

        // Valida la franja horaria cuando el cierre es parcial.
        if (
          !data.dia_completo &&
          (
            !data.hora_inicio ||
            !data.hora_fin ||
            data.hora_inicio >= data.hora_fin
          )
        ) {
          setError(
            'La franja debe tener una hora inicial anterior a la final.'
          );
          return;
        }

        // Comprueba la longitud mínima del título y del origen.
        if (
          data.titulo.trim().length < 3 ||
          data.origen.trim().length < 3
        ) {
          setError(
            'Completá título y origen con al menos 3 caracteres.'
          );
          return;
        }

        // Envía exclusivamente los campos editables, nunca los metadatos de la fila.
        onReview({
          titulo: data.titulo.trim(),
          observaciones: data.observaciones?.trim() || null,
          tipo: data.tipo,
          alcance: data.alcance,
          id_salita:
            data.alcance === 'GLOBAL'
              ? null
              : data.id_salita,
          fecha_inicio: data.fecha_inicio,
          fecha_fin: data.fecha_fin,
          dia_completo: data.dia_completo,
          hora_inicio:
            data.dia_completo
              ? null
              : data.hora_inicio,
          hora_fin:
            data.dia_completo
              ? null
              : data.hora_fin,
          origen: data.origen.trim(),
          activo: data.activo,
        });
      }}
    >
      {/* Encabezado e información general del formulario. */}
      <h2 className="h5">
        {initial
          ? 'Editar feriado o cierre'
          : 'Nuevo feriado o cierre'}
      </h2>

      <p>
        Indicá cuándo cierra la institución.
        Los horarios habituales de los profesionales se conservan.
      </p>

      {/* Muestra los errores de validación. */}
      {error && (
        <p
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="row g-3">
        {/* Selección del tipo de cierre institucional. */}
        <label className="col-md-5 form-label">
          Tipo

          <select
            className="form-select"
            value={data.tipo}
            onChange={(e) =>
              change({
                tipo: e.target.value as CierreInput['tipo'],
              })
            }
          >
            {Object.entries(tiposCierre).map(
              ([key, label]) => (
                <option
                  key={key}
                  value={key}
                >
                  {label}
                </option>
              )
            )}
          </select>
        </label>

        {/* Título administrativo del cierre. */}
        <label className="col-md-7 form-label">
          Título administrativo

          <input
            className="form-control"
            required
            minLength={3}
            maxLength={150}
            value={data.titulo}
            onChange={(e) =>
              change({
                titulo: e.target.value,
              })
            }
            placeholder="Ej.: mantenimiento del edificio"
          />
        </label>

        {/* Define si el cierre afecta a todas las salitas o a una sola. */}
        <label className="col-md-5 form-label">
          Alcance

          <select
            className="form-select"
            value={data.alcance}
            disabled={!superAdmin}
            onChange={(e) =>
              change({
                alcance: e.target.value as CierreInput['alcance'],
                id_salita:
                  e.target.value === 'GLOBAL'
                    ? null
                    : salitas[0]?.id_salita ?? null,
              })
            }
          >
            {superAdmin && (
              <option value="GLOBAL">
                Global: todas las salitas
              </option>
            )}

            <option value="SALITA">
              Una salita
            </option>
          </select>
        </label>

        {/* Permite seleccionar la salita para cierres específicos. */}
        {data.alcance === 'SALITA' && (
          <label className="col-md-7 form-label">
            Salita

            <select
              className="form-select"
              required
              value={data.id_salita ?? ''}
              onChange={(e) =>
                change({
                  id_salita: e.target.value || null,
                })
              }
            >
              <option value="">
                Seleccioná una salita
              </option>

              {salitas.map((s) => (
                <option
                  key={s.id_salita}
                  value={s.id_salita}
                  disabled={
                    !s.activo &&
                    s.id_salita !== data.id_salita
                  }
                >
                  {s.nombre}
                  {!s.activo ? ' (inactiva)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Fecha inicial del cierre. */}
        <label className="col-md-6 form-label">
          Desde (inclusive)

          <input
            type="date"
            className="form-control"
            required
            value={data.fecha_inicio}
            onChange={(e) =>
              change({
                fecha_inicio: e.target.value,
                fecha_fin:
                  data.fecha_fin < e.target.value
                    ? e.target.value
                    : data.fecha_fin,
              })
            }
          />
        </label>

        {/* Fecha final del cierre. */}
        <label className="col-md-6 form-label">
          Hasta (inclusive)

          <input
            type="date"
            className="form-control"
            required
            min={data.fecha_inicio}
            value={data.fecha_fin}
            onChange={(e) =>
              change({
                fecha_fin: e.target.value,
              })
            }
          />
        </label>

        {/* Configura si el cierre es completo y si permanece activo. */}
        <div className="col-12 d-flex flex-wrap gap-4">
          <label className="form-check-label">
            <input
              className="form-check-input me-2"
              type="checkbox"
              checked={data.dia_completo}
              onChange={(e) =>
                change({
                  dia_completo: e.target.checked,
                  hora_inicio: null,
                  hora_fin: null,
                })
              }
            />
            Todo el día
          </label>

          <label className="form-check-label">
            <input
              className="form-check-input me-2"
              type="checkbox"
              checked={data.activo}
              onChange={(e) =>
                change({
                  activo: e.target.checked,
                })
              }
            />
            Cierre activo
          </label>
        </div>

        {/* Solicita la franja horaria para cierres parciales. */}
        {!data.dia_completo && (
          <>
            <label className="col-md-6 form-label">
              Cierra desde

              <input
                className="form-control"
                type="time"
                required
                value={data.hora_inicio?.slice(0, 5) ?? ''}
                onChange={(e) =>
                  change({
                    hora_inicio: e.target.value,
                  })
                }
              />
            </label>

            <label className="col-md-6 form-label">
              Reabre a las

              <input
                className="form-control"
                type="time"
                required
                value={data.hora_fin?.slice(0, 5) ?? ''}
                onChange={(e) =>
                  change({
                    hora_fin: e.target.value,
                  })
                }
              />
            </label>
          </>
        )}

        {/* Registra el origen administrativo del cierre. */}
        <label className="col-12 form-label">
          Origen / disposición administrativa

          <input
            className="form-control"
            required
            minLength={3}
            maxLength={200}
            value={data.origen}
            onChange={(e) =>
              change({
                origen: e.target.value,
              })
            }
            placeholder="Ej.: disposición municipal o comunicación de la salita"
          />
        </label>

        {/* Observaciones internas no visibles para el paciente. */}
        <label className="col-12 form-label">
          Observaciones internas (no se muestran al paciente)

          <textarea
            className="form-control"
            rows={2}
            maxLength={2000}
            value={data.observaciones ?? ''}
            onChange={(e) =>
              change({
                observaciones: e.target.value,
              })
            }
          />
        </label>
      </div>

      {/* Resume el período, alcance y estado del cierre. */}
      <div className="alert alert-info mt-3">
        {data.fecha_inicio && data.fecha_fin && (
          <p className="mb-1">
            {agendaDate(data.fecha_inicio)}
            {' hasta '}
            {agendaDate(data.fecha_fin)}.
          </p>
        )}

        {data.dia_completo
          ? 'Cierre de día completo.'
          : 'Se aplica la misma franja cada día del rango; fuera de ella sigue la atención habitual.'}

        {' '}
        No se repite automáticamente el próximo año.

        {data.alcance === 'GLOBAL' && (
          <strong className="d-block">
            Alcanza a todas las salitas y sus profesionales.
          </strong>
        )}

        {!data.activo && (
          <strong className="d-block">
            Inactivo: no impide reservas.
          </strong>
        )}
      </div>

      {/* Permite revisar el impacto o cancelar la operación. */}
      <div className="d-flex flex-wrap gap-2">
        <button
          className="btn btn-saps"
          type="submit"
        >
          Revisar impacto y continuar
        </button>

        <button
          className="btn btn-outline-secondary"
          type="button"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
