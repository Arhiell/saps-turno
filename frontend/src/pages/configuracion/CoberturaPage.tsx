import ZonaBarrioSelect from '../../components/ui/ZonaBarrioSelect';
import ValidatedInput from '../../components/ui/ValidatedInput';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import {
  Link,
  useSearchParams,
} from 'react-router-dom';

import {
  getCoberturas,
  guardarCobertura,
} from '../../services/configuracion.service';

import { getSalitas } from '../../services/salitas.service';
import { getBarrios } from '../../services/barrios.service';

import type {
  Cobertura,
} from '../../types/configuracion.types';

import type {
  Salita,
} from '../../types/salita.types';

import type {
  Barrio,
} from '../../types/barrio.types';

import ConfirmationModal from '../../components/ui/ConfirmationModal';
import PaginationControls from '../../components/ui/PaginationControls';
import { useAgendaSocket } from '../../context/AgendaSocketContext';

import { authError } from '../../utils/auth-errors';

// Genera el estado inicial del formulario.
// Si recibe una salita, la deja seleccionada.
const empty = (id = ''): Cobertura => ({
  id_salita: id,
  id_barrio: '',
  es_barrio_sede: false,
  activo: true,
  fecha_desde: new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date()),
  fecha_hasta: null,
});

export default function CoberturaPage() {
  // Permite recibir una salita desde la URL.
  const [params] = useSearchParams();

  // Estado del formulario.
  const [form, setForm] = useState<Cobertura>(() =>
    empty(params.get('salita') ?? '')
  );

  const [editing, setEditing] = useState(false);

  // Datos utilizados por la pantalla.
  const [rows, setRows] = useState<Cobertura[]>([]);
  const [clinics, setClinics] = useState<Salita[]>([]);
  const [barrios, setBarrios] = useState<Barrio[]>([]);

  // Filtro de coberturas por salita y paginación.
  const [filter, setFilter] = useState(
    params.get('salita') ?? ''
  );
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const { ultimoEventoTerritorial, ultimoEventoSalita, resyncTick } = useAgendaSocket();

  // Estados generales.
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [revision, setRevision] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Referencia para volver al formulario al editar.
  const formRef = useRef<HTMLFormElement>(null);

  // Carga coberturas, salitas y barrios.
  useEffect(() => {
    let active = true;

    setLoading(true);
    setReady(false);
    setError('');

    void Promise.all([
      getCoberturas(),
      getSalitas(),
      getBarrios(),
    ])
      .then(([r, c, b]) => {
        if (active) {
          setRows(r);
          setClinics(c.data);
          setBarrios(b.data.barrios);
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
  }, [revision]);

  // Actualización reactiva ante cambios territoriales o de salitas
  useEffect(() => {
    if (!ready) return;
    setRevision((v) => v + 1);
  }, [ultimoEventoTerritorial, ultimoEventoSalita, resyncTick]);

  // Actualiza parcialmente los datos del formulario.
  const change = (patch: Partial<Cobertura>) => {
    setForm((value) => ({
      ...value,
      ...patch,
    }));
  };

  // Limpia el formulario y finaliza la edición.
  const reset = () => {
    setForm(empty(filter));
    setEditing(false);
  };

  // Guarda una nueva cobertura o actualiza una existente.
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();

    if (busy || !ready) return;

    setError('');
    setSuccess('');

    // Evita crear nuevamente una relación existente.
    if (
      !editing &&
      rows.some(
        (row) =>
          row.id_salita === form.id_salita &&
          row.id_barrio === form.id_barrio
      )
    ) {
      setError(
        'Esta relación ya existe. Editala para cambiar sus fechas o reactivarla.'
      );
      return;
    }

    // La fecha final no puede ser anterior al inicio.
    if (
      form.fecha_hasta &&
      form.fecha_hasta < form.fecha_desde
    ) {
      setError(
        'La fecha final no puede ser anterior al inicio.'
      );
      return;
    }

    // Cada salita puede tener solamente un barrio sede.
    if (
      form.es_barrio_sede &&
      rows.some(
        (row) =>
          row.id_salita === form.id_salita &&
          row.id_barrio !== form.id_barrio &&
          row.es_barrio_sede
      )
    ) {
      setError(
        'La salita ya tiene un barrio sede. Quitá esa marca de la relación anterior antes de asignar otra.'
      );
      return;
    }

    setBusy(true);

    try {
      await guardarCobertura(
        form,
        editing
      );

      reset();

      setSuccess('Cobertura guardada.');

      // Fuerza la recarga de los datos.
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(authError(cause));
    } finally {
      setBusy(false);
    }
  };

  // Filtra las coberturas por la salita seleccionada y pagina a 15 registros.
  const visible = rows.filter(
    (row) =>
      !filter ||
      row.id_salita === filter
  );

  const totalPages = Math.ceil(visible.length / PAGE_SIZE) || 1;
  const paginatedVisible = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <ConfirmationModal
        open={confirmOpen}
        title={editing ? 'Guardar cobertura' : 'Crear cobertura'}
        subtitle="Esta acción requiere confirmación."
        message={editing ? '¿Querés guardar los cambios de esta cobertura?' : '¿Querés guardar esta cobertura?'}
        detail={
          <>
            <div className="fw-semibold">{clinics.find(c => c.id_salita === form.id_salita)?.nombre || 'Salita sin nombre'}</div>
            <div className="text-muted small mt-1">{barrios.find(b => b.id_barrio === form.id_barrio)?.nombre || 'Barrio sin nombre'}</div>
          </>
        }
        confirmText="Guardar cobertura"
        cancelText="Cancelar"
        variant="primary"
        icon="bi-geo-alt"
        loading={busy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void submit();
        }}
      />

      <div className="dashboard-header">
        <h1>Cobertura de salitas</h1>

        <p>
          Asigná los barrios atendidos por cada salita y su
          período de vigencia.
        </p>
      </div>

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

      {/* Formulario de creación y edición */}
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          setConfirmOpen(true);
        }}
        className="dashboard-panel p-3 mb-4 configuration-form"
      >
        <h2 className="h5">
          {editing
            ? 'Editar cobertura'
            : 'Asignar barrio'}
        </h2>

        <fieldset
          disabled={loading || busy || !ready}
        >
          <div className="row g-3">
            {/* Selección de salita */}
            <label className="col-md-6 form-label">
              Salita

              <select
                className="form-select"
                required
                disabled={editing}
                value={form.id_salita}
                onChange={(e) =>
                  change({
                    id_salita: e.target.value,
                  })
                }
              >
                <option value="">
                  Seleccionar salita
                </option>

                {clinics
                  .filter(
                    (clinic) =>
                      clinic.activo ||
                      clinic.id_salita === form.id_salita
                  )
                  .map((clinic) => (
                    <option
                      key={clinic.id_salita}
                      value={clinic.id_salita}
                    >
                      {clinic.nombre}
                    </option>
                  ))}
              </select>
            </label>

            {/* Selección de barrio */}
            <div className="col-md-6">
              <ZonaBarrioSelect
                barrios={barrios.filter((barrio) => barrio.activo || barrio.id_barrio === form.id_barrio)}
                value={form.id_barrio}
                disabled={editing}
                onChange={(id_barrio) => change({ id_barrio })}
              />
            </div>

            {/* Período de vigencia */}
            <label className="col-md-6 form-label">
              Desde

              <ValidatedInput field="fecha_desde"
                className="form-control"
                type="date"
                required
                value={form.fecha_desde}
                onChange={(e) =>
                  change({
                    fecha_desde: e.target.value,
                  })
                }
              />
            </label>

            <label className="col-md-6 form-label">
              Hasta (opcional)

              <ValidatedInput field="fecha_hasta"
                className="form-control"
                type="date"
                min={form.fecha_desde}
                value={form.fecha_hasta ?? ''}
                onChange={(e) =>
                  change({
                    fecha_hasta:
                      e.target.value || null,
                  })
                }
              />
            </label>

            {/* Opciones de la cobertura */}
            <div className="col-12 d-flex flex-wrap gap-4">
              <label className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={form.es_barrio_sede}
                  onChange={(e) =>
                    change({
                      es_barrio_sede:
                        e.target.checked,
                    })
                  }
                />

                Es el barrio sede
              </label>

              <label className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) =>
                    change({
                      activo: e.target.checked,
                    })
                  }
                />

                Cobertura activa
              </label>
            </div>

            {/* Acciones del formulario */}
            <div className="col-12 d-flex flex-wrap gap-2">
              <button className="btn btn-saps">
                {busy
                  ? 'Guardando…'
                  : 'Guardar cobertura'}
              </button>

              {editing && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={reset}
                >
                  Cancelar edición
                </button>
              )}

              <Link
                to="/configuracion/barrios"
                className="btn btn-outline-success"
              >
                Administrar barrios
              </Link>
            </div>
          </div>
        </fieldset>
      </form>

      {/* Listado de coberturas */}
      <section className="dashboard-panel">
        <div className="p-3">
          <label className="form-label w-100">
            Filtrar salita

            <select
              className="form-select"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">
                Todas
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
        </div>

        {loading ? (
          <p
            className="p-3"
            role="status"
          >
            Cargando cobertura…
          </p>
        ) : (
          <>
            {/* Vista móvil compacta (< 768px) */}
            <div className="d-md-none p-3 d-flex flex-column gap-2">
              {paginatedVisible.map((row) => (
                <article
                  key={`${row.id_salita}-${row.id_barrio}`}
                  className="bg-white border rounded-3 p-3 shadow-xs position-relative"
                  style={{
                    borderLeft: `4px solid ${row.activo ? 'var(--saps-verde)' : '#94a3b8'}`,
                    marginBottom: '8px',
                  }}
                >
                  <div className="d-flex align-items-start justify-content-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <h3 className="h6 fw-bold text-dark mb-0 text-truncate">
                        {clinics.find((c) => c.id_salita === row.id_salita)?.nombre ?? 'Salita no disponible'}
                      </h3>
                      <div className="d-flex align-items-center gap-1.5 mt-0.5">
                        <i className="bi bi-geo-alt text-success small" />
                        <span className="small text-muted text-truncate">
                          {barrios.find((b) => b.id_barrio === row.id_barrio)?.nombre ?? 'Barrio no disponible'}
                        </span>
                        {row.es_barrio_sede && (
                          <span className="badge bg-success-subtle text-success border border-success-subtle py-0.5 px-1.5 rounded-pill" style={{ fontSize: '10px' }}>
                            Sede
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`badge rounded-pill flex-shrink-0 ${
                        row.activo
                          ? 'bg-success-subtle text-success border border-success-subtle'
                          : 'bg-secondary-subtle text-secondary border border-secondary-subtle'
                      }`}
                    >
                      {row.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>

                  <div className="small text-muted py-1 my-1">
                    <span className="fw-semibold">Vigencia:</span> {row.fecha_desde} / {row.fecha_hasta ?? 'Sin fin'}
                  </div>

                  <div className="pt-2 border-top d-flex justify-content-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success text-nowrap d-inline-flex align-items-center gap-1.5 py-1 px-2.5"
                      disabled={busy}
                      onClick={() => {
                        setEditing(true);
                        setForm({ ...row });
                        setError('');
                        setSuccess('');
                        formRef.current?.scrollIntoView({ block: 'start' });
                      }}
                    >
                      <i className="bi bi-pencil" aria-hidden="true" />
                      <span>Editar</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {/* Vista escritorio (>= 768px) */}
            <div className="d-none d-md-block table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th scope="col">Salita</th>
                    <th scope="col">Barrio</th>
                    <th scope="col">Vigencia</th>
                    <th scope="col">Estado</th>
                    <th scope="col" className="text-end">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedVisible.map((row) => (
                    <tr key={`${row.id_salita}-${row.id_barrio}`}>
                      <td>
                        <strong>
                          {clinics.find(
                            (clinic) => clinic.id_salita === row.id_salita
                          )?.nombre ?? 'Salita no disponible'}
                        </strong>
                      </td>

                      <td>
                        {barrios.find(
                          (barrio) => barrio.id_barrio === row.id_barrio
                        )?.nombre ?? 'Barrio no disponible'}

                        {row.es_barrio_sede && (
                          <span className="badge bg-success-subtle text-success border border-success-subtle ms-2">
                            Sede
                          </span>
                        )}
                      </td>

                      <td className="small text-muted">
                        {row.fecha_desde} / {row.fecha_hasta ?? 'Sin fin'}
                      </td>

                      <td>
                        <span
                          className={`badge rounded-pill ${
                            row.activo
                              ? 'bg-success-subtle text-success border border-success-subtle'
                              : 'bg-secondary-subtle text-secondary border border-secondary-subtle'
                          }`}
                        >
                          {row.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>

                      <td className="text-end text-nowrap">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success text-nowrap d-inline-flex align-items-center gap-1.5 py-1 px-2.5"
                          disabled={busy}
                          onClick={() => {
                            setEditing(true);
                            setForm({ ...row });
                            setError('');
                            setSuccess('');
                            formRef.current?.scrollIntoView({ block: 'start' });
                          }}
                        >
                          <i className="bi bi-pencil" />
                          <span>Editar</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!visible.length && (
              <p className="p-3 text-muted text-center mb-0">
                No hay coberturas para este filtro.
              </p>
            )}

            {/* Controles de paginación de 15 registros */}
            <div className="p-3 border-top">
              <PaginationControls
                page={page}
                totalPages={totalPages}
                totalItems={visible.length}
                itemsPerPage={PAGE_SIZE}
                onPageChange={setPage}
                itemLabel="coberturas"
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}