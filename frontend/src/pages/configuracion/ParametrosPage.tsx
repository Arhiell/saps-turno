import ValidatedInput from '../../components/ui/ValidatedInput';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import { useAuth } from '../../context/AuthContext';

import {
  getParametros,
  guardarParametro,
  getSalitasConfigurables,
} from '../../services/configuracion.service';

import type {
  Parametro,
} from '../../types/configuracion.types';

import type {
  Salita,
} from '../../types/salita.types';

import ConfirmationModal from '../../components/ui/ConfirmationModal';

import { authError } from '../../utils/auth-errors';

// Parámetros disponibles para configurar.
// "numeric" indica si acepta números y "local" si puede configurarse por salita.
const options = [
  {
    key: 'sistema.nombre',
    label: 'Nombre del sistema',
    numeric: false,
    local: false,
  },
  {
    key: 'sistema.descripcion',
    label: 'Descripción del sistema',
    numeric: false,
    local: false,
  },
  {
    key: 'sistema.zona_horaria',
    label: 'Zona horaria',
    numeric: false,
    local: false,
  },
  {
    key: 'agenda.intervalo_default',
    label: 'Duración predeterminada del turno (minutos)',
    numeric: true,
    local: true,
  },
  {
    key: 'notificaciones.recordatorio_horas',
    label: 'Anticipación del recordatorio (horas)',
    numeric: true,
    local: true,
  },
  {
    key: 'turnos.dias_anticipacion',
    label: 'Anticipación para solicitar turnos (días)',
    numeric: true,
    local: true,
  },
  {
    key: 'turnos.cancelacion_horas',
    label: 'Anticipación para cancelar (horas)',
    numeric: true,
    local: true,
  },
  {
    key: 'turnos.cancelacion_minima_horas',
    label: 'Anticipación mínima de cancelación (horas)',
    numeric: true,
    local: false,
  },
  {
    key: 'turnos.sancion_inasistencia_dias',
    label: 'Sanción por inasistencia (días)',
    numeric: true,
    local: false,
  },
  {
    key: 'sanciones.duracion_dias',
    label: 'Duración de sanciones (días)',
    numeric: true,
    local: true,
  },
];

export default function ParametrosPage() {
  const { user } = useAuth();

  // Determina si puede administrar parámetros globales.
  const global = user?.rol === 'SUPER_ADMIN';

  // Datos cargados desde la API.
  const [rows, setRows] = useState<Parametro[]>([]);
  const [clinics, setClinics] = useState<Salita[]>([]);

  // Datos del formulario.
  const [editing, setEditing] = useState<string>();
  const [clave, setClave] = useState(
    'agenda.intervalo_default'
  );
  const [salita, setSalita] = useState('');
  const [valor, setValor] = useState('');
  const [description, setDescription] = useState('');
  const [publicValue, setPublicValue] = useState(false);

  // Estados generales de la pantalla.
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [revision, setRevision] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Referencia para volver al formulario al editar.
  const ref = useRef<HTMLFormElement>(null);

  // Obtiene la configuración del parámetro seleccionado.
  const selected = options.find(
    (option) => option.key === clave
  )!;

  // Carga parámetros y salitas disponibles.
  useEffect(() => {
    let active = true;

    setLoading(true);
    setReady(false);
    setError('');

    void Promise.all([
      getParametros(),
      getSalitasConfigurables(global),
    ])
      .then(([parameters, clinicsData]) => {
        if (active) {
          setRows(parameters);
          setClinics(clinicsData);
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
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [revision, global]);

  // Limpia el formulario y sale del modo edición.
  const reset = () => {
    setEditing(undefined);
    setValor('');
    setDescription('');
    setPublicValue(false);
  };

  // Guarda un nuevo parámetro o actualiza uno existente.
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();

    if (busy || !ready) return;

    setError('');
    setSuccess('');

    // El valor es obligatorio.
    if (!valor.trim()) {
      setError('Ingresá un valor.');
      return;
    }

    // Los administradores de salita deben seleccionar su alcance.
    if (!global && !salita) {
      setError('Seleccioná tu salita.');
      return;
    }

    // Evita duplicar una clave dentro del mismo alcance.
    if (
      !editing &&
      rows.some(
        (row) =>
          row.clave === clave &&
          row.id_salita === (salita || null)
      )
    ) {
      setError(
        'El parámetro ya existe para ese alcance. Editá el registro del listado.'
      );
      return;
    }

    // Valida parámetros que solamente aceptan enteros positivos o cero.
    if (
      selected.numeric &&
      (
        !/^[0-9]+$/.test(valor.trim()) ||
        !Number.isSafeInteger(Number(valor)) ||
        Number(valor) < 0
      )
    ) {
      setError(
        'Ingresá un número entero igual o mayor a cero.'
      );
      return;
    }

    setBusy(true);

    try {
      await guardarParametro(
        {
          clave,
          id_salita: salita || null,
          valor: selected.numeric
            ? Number(valor)
            : valor.trim(),
          descripcion:
            description.trim() || null,
          es_publica: global
            ? publicValue
            : false,
        },
        editing,
        global
      );

      reset();

      setSuccess('Parámetro guardado.');

      // Fuerza la recarga de los parámetros.
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(authError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <ConfirmationModal
        open={confirmOpen}
        title={editing ? 'Guardar parámetro' : 'Crear parámetro'}
        message={editing ? '¿Querés guardar los cambios de este parámetro?' : '¿Querés crear este parámetro?'}
        detail={
          <>
            <div className="fw-semibold">{selected.label}</div>
            <div className="text-muted small mt-1">
              {global ? 'Configuración global' : clinics.find((clinic) => clinic.id_salita === salita)?.nombre || 'Salita no seleccionada'}
            </div>
          </>
        }
        confirmText="Guardar parámetro"
        variant="primary"
        icon="bi-sliders"
        loading={busy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void submit();
        }}
      />

      <div className="dashboard-header">
        <h1>
          Parámetros del sistema
        </h1>

        <p>
          Administrá los valores globales o propios de una
          salita.
        </p>
      </div>

      <p className="text-muted">
        Los cambios se guardan en la configuración. Su
        aplicación depende de que cada función del sistema
        utilice ese parámetro.
      </p>

      {/* Mensajes de error y confirmación */}
      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}

          <button
            className="btn btn-outline-danger ms-2"
            disabled={busy}
            onClick={() =>
              setRevision((value) => value + 1)
            }
          >
            Recargar
          </button>
        </div>
      )}

      {success && (
        <div
          className="alert alert-success"
          role="status"
        >
          {success}
        </div>
      )}

      {/* Formulario de parámetros */}
      <form
        ref={ref}
        className="dashboard-panel p-3 mb-4 configuration-form"
        onSubmit={(event) => {
          event.preventDefault();
          setConfirmOpen(true);
        }}
      >
        <h2 className="h5">
          {editing
            ? 'Editar parámetro'
            : 'Nuevo parámetro'}
        </h2>

        <fieldset
          disabled={loading || busy || !ready}
        >
          <div className="row g-3">
            {/* Selección del parámetro */}
            <label className="col-md-6 form-label">
              Parámetro

              <select
                className="form-select"
                value={clave}
                disabled={!!editing}
                onChange={(e) => {
                  setClave(e.target.value);
                  setValor('');
                }}
              >
                {options
                  .filter(
                    (option) =>
                      global || option.local
                  )
                  .map((option) => (
                    <option
                      key={option.key}
                      value={option.key}
                    >
                      {option.label}
                    </option>
                  ))}
              </select>
            </label>

            {/* Define si el parámetro es global o de una salita */}
            <label className="col-md-6 form-label">
              Alcance

              <select
                className="form-select"
                value={salita}
                required={!global}
                disabled={!!editing}
                onChange={(e) =>
                  setSalita(e.target.value)
                }
              >
                <option value="">
                  {global
                    ? 'Global'
                    : 'Seleccionar salita'}
                </option>

                {clinics.map((clinic) => (
                  <option
                    key={clinic.id_salita}
                    value={clinic.id_salita}
                  >
                    {clinic.nombre}
                  </option>
                ))}
              </select>
            </label>

            {/* Valor del parámetro */}
            <label className="col-md-6 form-label">
              Valor

              <ValidatedInput
                className="form-control"
                required
                type={
                  selected.numeric
                    ? 'number'
                    : 'text'
                }
                min={
                  selected.numeric
                    ? 0
                    : undefined
                }
                step={
                  selected.numeric
                    ? 1
                    : undefined
                }
                maxLength={250}
                value={valor}
                onChange={(e) =>
                  setValor(e.target.value)
                }
              />
            </label>

            <label className="col-md-6 form-label">
              Descripción (opcional)

              <input
                className="form-control"
                maxLength={2000}
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
              />
            </label>

            {/* Solo SUPER_ADMIN puede marcar valores públicos */}
            {global && (
              <div className="col-12">
                <label className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={publicValue}
                    onChange={(e) =>
                      setPublicValue(
                        e.target.checked
                      )
                    }
                  />

                  Visible públicamente
                </label>
              </div>
            )}

            {/* Acciones del formulario */}
            <div className="col-12 d-flex flex-wrap gap-2">
              <button className="btn btn-saps">
                {busy
                  ? 'Guardando…'
                  : 'Guardar parámetro'}
              </button>

              {editing && (
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={reset}
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </div>
        </fieldset>
      </form>

      {/* Listado de parámetros */}
      <section className="dashboard-panel">
        {loading ? (
          <p
            className="p-3"
            role="status"
          >
            Cargando parámetros…
          </p>
        ) : (
          <div className="table-responsive">
            <table className="table saps-responsive-table">
              <thead>
                <tr>
                  {[
                    'Parámetro',
                    'Alcance',
                    'Valor',
                    'Acciones',
                  ].map((title) => (
                    <th
                      scope="col"
                      key={title}
                    >
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  // Busca la definición conocida del parámetro.
                  const option = options.find(
                    (item) =>
                      item.key === row.clave
                  );

                  // Determina si el usuario puede editarlo.
                  const editable =
                    option &&
                    (
                      global ||
                      (
                        option.local &&
                        row.id_salita !== null
                      )
                    ) &&
                    (
                      typeof row.valor === 'string' ||
                      typeof row.valor === 'number'
                    );

                  return (
                    <tr key={row.id_configuracion}>
                      <td data-label="Parámetro">
                        {option?.label ?? row.clave}

                        {row.es_publica && (
                          <span className="badge text-bg-secondary ms-2">
                            Público
                          </span>
                        )}
                      </td>

                      <td data-label="Alcance">
                        {row.id_salita
                          ? clinics.find(
                              (clinic) =>
                                clinic.id_salita ===
                                row.id_salita
                            )?.nombre ??
                            'Salita no disponible'
                          : 'Global'}
                      </td>

                      <td data-label="Valor">
                        {typeof row.valor === 'object'
                          ? 'Valor estructurado'
                          : String(row.valor)}
                      </td>

                      <td data-label="Acciones">
                        {editable ? (
                          <button
                            className="btn btn-outline-success"
                            disabled={busy}
                            onClick={() => {
                              setEditing(
                                row.id_configuracion
                              );

                              setClave(row.clave);

                              setSalita(
                                row.id_salita ?? ''
                              );

                              setValor(
                                String(row.valor)
                              );

                              setDescription(
                                row.descripcion ?? ''
                              );

                              setPublicValue(
                                row.es_publica
                              );

                              setError('');
                              setSuccess('');

                              // Regresa al formulario para editar.
                              ref.current?.scrollIntoView({
                                block: 'start',
                              });
                            }}
                          >
                            Editar
                          </button>
                        ) : (
                          <span className="text-muted">
                            Solo consulta
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!rows.length && (
              <p className="p-3 text-muted">
                Todavía no hay parámetros visibles para tu
                cuenta.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
