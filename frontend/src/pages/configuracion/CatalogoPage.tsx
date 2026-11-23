import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import { Link } from 'react-router-dom';

import {
  getCatalogo,
  getZonas,
  guardarCatalogo,
  getParametros,
  guardarParametro,
} from '../../services/configuracion.service';
import { getAdminSalitas } from '../../services/salitas.service';
import { useAuth } from '../../context/AuthContext';
import type { Salita } from '../../types/salita.types';

import type {
  CatalogoInput,
  CatalogoRegistro,
  CatalogoTipo,
  Zona,
  Parametro,
} from '../../types/configuracion.types';

import ConfirmationModal from '../../components/ui/ConfirmationModal';
import PaginationControls from '../../components/ui/PaginationControls';
import { useAgendaSocket } from '../../context/AgendaSocketContext';

import { authError } from '../../utils/auth-errors';

// Títulos utilizados según el catálogo seleccionado.
const titles = {
  zonas: 'Zonas',
  barrios: 'Barrios',
  especialidades: 'Especialidades',
};

// Genera el estado inicial del formulario.
const empty = (): CatalogoInput => ({
  nombre: '',
  activo: true,
});

// Normaliza textos para realizar búsquedas y comparar duplicados.
const normalize = (value: string) =>
  value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');

export default function CatalogoPage({
  tipo,
}: {
  tipo: CatalogoTipo;
}) {
  const { user } = useAuth();
  const canEditCatalog = user?.rol === 'SUPER_ADMIN';
  // Datos del catálogo.
  const [rows, setRows] = useState<CatalogoRegistro[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [clinics, setClinics] = useState<Salita[]>([]);
  const [clinicSettings, setClinicSettings] = useState<Parametro[]>([]);
  const [selectedClinic, setSelectedClinic] = useState('');
  const [clinicSpecialties, setClinicSpecialties] = useState<string[]>([]);

  // Estado del formulario.
  const [form, setForm] = useState<CatalogoInput>(empty);
  const [editing, setEditing] = useState<string>();

  // Filtros del listado y paginación.
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('todos');
  const [zoneFilter, setZoneFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const { ultimoEventoTerritorial, resyncTick } = useAgendaSocket();

  // Estados generales de la pantalla.
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [revision, setRevision] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [specialtyConfirmOpen, setSpecialtyConfirmOpen] = useState(false);
  const [expandedSpecialties, setExpandedSpecialties] = useState<Record<string, boolean>>({});

  const toggleSpecialtyExpand = (id: string) => {
    setExpandedSpecialties((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const renderAssignedClinics = (rowId: string, isMobile = false) => {
    const assigned = clinics.filter((clinic) =>
      clinicSettings.some(
        (setting) =>
          setting.id_salita === clinic.id_salita &&
          Array.isArray(setting.valor) &&
          setting.valor.includes(rowId)
      )
    );
    const isExpanded = Boolean(expandedSpecialties[rowId]);

    if (assigned.length === 0) {
      return (
        <span className="text-muted small fst-italic">
          Sin salitas asignadas
        </span>
      );
    }

    const visibleClinics = isExpanded ? assigned : assigned.slice(0, 3);
    const remaining = assigned.length - 3;

    return (
      <div className={isMobile ? 'my-1.5' : ''}>
        <div className="d-flex align-items-center gap-1.5 mb-1.5 flex-wrap">
          <span
            className="badge bg-primary-subtle text-primary border border-primary-subtle py-1 px-2"
            style={{ fontSize: '11px' }}
          >
            <i className="bi bi-hospital me-1" />
            {assigned.length} {assigned.length === 1 ? 'salita asignada' : 'salitas asignadas'}
          </span>
        </div>

        <div className="d-flex flex-wrap gap-1 align-items-center">
          {visibleClinics.map((clinic) => (
            <span
              key={clinic.id_salita}
              className="badge bg-light text-dark border py-1 px-2 fw-normal"
              style={{ fontSize: '11.5px' }}
            >
              {clinic.nombre}
            </span>
          ))}

          {remaining > 0 && (
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-decoration-none fw-semibold text-success ms-1 d-inline-flex align-items-center gap-0.5"
              style={{ fontSize: '11.5px' }}
              onClick={() => toggleSpecialtyExpand(rowId)}
            >
              {isExpanded ? (
                <>
                  <i className="bi bi-chevron-up" />
                  <span>Ver menos</span>
                </>
              ) : (
                <>
                  <i className="bi bi-chevron-down" />
                  <span>+{remaining} más (Ver todas)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  // Referencias para desplazamiento y foco al editar.
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Carga los registros del catálogo.
  useEffect(() => {
    let active = true;

    setLoading(true);
    setReady(false);
    setError('');

    void Promise.all([
      getCatalogo(tipo),
      tipo === 'barrios'
        ? getZonas()
        : Promise.resolve([]),
      tipo === 'especialidades' ? getAdminSalitas().then(response => response.data) : Promise.resolve([]),
      tipo === 'especialidades' ? getParametros() : Promise.resolve([]),
    ])
      .then(([data, zones, clinicRows, settings]) => {
        if (active) {
          setRows(data);
          setZonas(zones);
          setClinics(clinicRows);
          if (clinicRows.length === 1) setSelectedClinic(clinicRows[0]!.id_salita);
          setClinicSettings(settings.filter(setting => setting.clave === 'salita.especialidades'));
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
  }, [tipo, revision]);

  // Actualización reactiva ante eventos territoriales o reconexión del socket
  useEffect(() => {
    if (!ready) return;
    setRevision((v) => v + 1);
  }, [ultimoEventoTerritorial, resyncTick]);

  useEffect(() => {
    const setting = clinicSettings.find(item => item.id_salita === selectedClinic);
    setClinicSpecialties(Array.isArray(setting?.valor)
      ? setting.valor.filter((id): id is string => typeof id === 'string')
      : rows.filter((row) => row.activo).map((row) => row.id));
  }, [selectedClinic, clinicSettings, rows]);

  const saveClinicSpecialties = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!selectedClinic || busy || loading || !ready) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const current = clinicSettings.find(item => item.id_salita === selectedClinic);
      await guardarParametro({
        id_salita: selectedClinic,
        clave: 'salita.especialidades',
        valor: clinicSpecialties,
        descripcion: 'Especialidades disponibles en esta SAPS',
        es_publica: false,
      }, current?.id_configuracion);
      setSuccess('Especialidades de la SAPS guardadas.');
      setRevision(value => value + 1);
    } catch (cause) {
      setError(authError(cause));
    } finally {
      setBusy(false);
    }
  };

  // Actualiza parcialmente los datos del formulario.
  const change = (patch: Partial<CatalogoInput>) => {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
  };

  // Limpia el formulario y finaliza la edición.
  const reset = () => {
    setEditing(undefined);
    setForm(empty());
  };

  // Carga un registro existente en el formulario.
  const edit = (row: CatalogoRegistro) => {
    setEditing(row.id);

    setForm({
      nombre: row.nombre,
      activo: row.activo,

      ...(tipo === 'barrios'
        ? {
            id_zona: row.id_zona,
            codigo_postal: row.codigo_postal,
          }
        : {
            descripcion: row.descripcion,
          }),

      ...(tipo === 'especialidades'
        ? {
            codigo: row.codigo,
            requiere_profesional: row.requiere_profesional,
          }
        : {}),
    });

    setError('');
    setSuccess('');

    // Lleva al usuario nuevamente al formulario.
    formRef.current?.scrollIntoView({
      block: 'start',
    });

    nameRef.current?.focus({
      preventScroll: true,
    });
  };

  // Guarda un nuevo registro o actualiza uno existente.
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();

    if (busy || loading || !ready) {
      return;
    }

    setError('');
    setSuccess('');

    // El nombre es obligatorio.
    if (tipo === 'especialidades' && !editing && !selectedClinic) {
      setError('Seleccioná primero la sala a la que se asignará la nueva especialidad.');
      return;
    }

    if (!form.nombre.trim()) {
      setError('Ingresá un nombre.');
      return;
    }

    // Incluye inactivos para permitir encontrar y reactivar registros.
    const duplicatedName = rows.some(
      (row) =>
        row.id !== editing &&
        (
          tipo !== 'barrios' ||
          row.id_zona === form.id_zona
        ) &&
        normalize(row.nombre) === normalize(form.nombre)
    );

    if (duplicatedName) {
      setError(
        'Ya existe ese nombre. Buscalo en el listado para editarlo o reactivarlo.'
      );
      return;
    }

    // El código de una especialidad también debe ser único.
    if (
      tipo === 'especialidades' &&
      rows.some(
        (row) =>
          row.id !== editing &&
          normalize(row.codigo ?? '') ===
            normalize(form.codigo ?? '')
      )
    ) {
      setError(
        'Ya existe una especialidad con ese código.'
      );
      return;
    }

    // Normaliza los datos antes de enviarlos al servicio.
    const input: CatalogoInput = {
      nombre: form.nombre.trim(),
      activo: form.activo,

      ...(tipo === 'barrios'
        ? {
            id_zona: form.id_zona,
            codigo_postal:
              form.codigo_postal?.trim() || null,
          }
        : {
            descripcion:
              form.descripcion?.trim() || null,
          }),

      ...(tipo === 'especialidades'
        ? {
            codigo: form.codigo
              ?.trim()
              .toUpperCase(),
            requiere_profesional:
              form.requiere_profesional ?? true,
          }
        : {}),
    };

    setBusy(true);

    try {
      const saved = await guardarCatalogo(
        tipo,
        input,
        editing
      );

      if (tipo === 'especialidades' && !editing) {
        const id = String(saved.id_especialidad);
        const setting = clinicSettings.find((item) => item.id_salita === selectedClinic);
        const previous = Array.isArray(setting?.valor)
          ? setting.valor.filter((value): value is string => typeof value === 'string')
          : rows.filter((row) => row.activo).map((row) => row.id);
        try {
          await guardarParametro({
            id_salita: selectedClinic,
            clave: 'salita.especialidades',
            valor: [...new Set([...previous, id])],
            descripcion: 'Especialidades disponibles en esta SAPS',
            es_publica: false,
          }, setting?.id_configuracion);
        } catch (cause) {
          setEditing(id);
          setRows((current) => [...current, { ...input, id }]);
          setError(`La especialidad se creó, pero falta asignarla a la sala. Seleccionala en Especialidades por SAPS y guardá. ${authError(cause)}`);
          return;
        }
      }

      reset();

      setSuccess(tipo === 'especialidades' && !editing ? 'Especialidad creada y asignada a la sala.' : 'Registro guardado.');

      // Fuerza una nueva carga del listado.
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(authError(cause));
    } finally {
      setBusy(false);
    }
  };

  // Aplica búsqueda por texto, estado y zona para barrios.
  const filtered = rows.filter(
    (row) =>
      normalize(
        `${row.nombre} ${row.codigo ?? ''}`
      ).includes(normalize(search)) &&
      (
        status === 'todos' ||
        row.activo === (status === 'activos')
      ) &&
      (
        tipo !== 'barrios' ||
        !zoneFilter ||
        row.id_zona === zoneFilter
      )
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginatedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <ConfirmationModal
        open={confirmOpen}
        title={editing ? 'Guardar cambios' : 'Crear registro'}
        subtitle="Esta acción requiere confirmación."
        message={editing ? '¿Querés guardar los cambios del registro?' : '¿Querés crear este registro?'}
        detail={
          <>
            <div className="fw-semibold">{form.nombre || 'Sin nombre'}</div>
            <div className="text-muted small mt-1">{tipo === 'especialidades' ? 'Especialidad / catálogo' : 'Configuración del sistema'}</div>
          </>
        }
        confirmText={editing ? 'Guardar cambios' : 'Guardar'}
        cancelText="Cancelar"
        variant="primary"
        icon="bi-check-lg"
        loading={busy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void submit();
        }}
      />

      <ConfirmationModal
        open={specialtyConfirmOpen}
        title="Guardar especialidades de la SAPS"
        message="¿Querés actualizar las especialidades disponibles en esta sala?"
        detail={
          <div className="fw-semibold">
            {clinics.find((clinic) => clinic.id_salita === selectedClinic)?.nombre || 'SAPS no seleccionada'}
          </div>
        }
        confirmText="Guardar especialidades"
        variant="primary"
        icon="bi-list-check"
        loading={busy}
        onClose={() => setSpecialtyConfirmOpen(false)}
        onConfirm={() => {
          setSpecialtyConfirmOpen(false);
          void saveClinicSpecialties();
        }}
      />

      <div className="dashboard-header">
        <h1>{titles[tipo]}</h1>

        <p>
          Creá, editá o reactivá los registros que utiliza
          el sistema.
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
            type="button"
            className="btn btn-outline-danger ms-2"
            disabled={busy}
            onClick={() =>
              setRevision((value) => value + 1)
            }
          >
            Recargar listado
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

      {tipo === 'especialidades' && (
        <form onSubmit={(event) => {
          event.preventDefault();
          setSpecialtyConfirmOpen(true);
        }} className="dashboard-panel p-3 mb-4">
          <h2 className="h5">Especialidades por SAPS</h2>
          <p className="text-muted">Seleccioná una sala y marcá las especialidades que ofrece. Desmarcar una especialidad la deshabilita para nuevos turnos de esa sala; no elimina los turnos existentes.</p>
          <Link to="/profesionales" className="btn btn-outline-success mb-3">Asociar especialidades a profesionales</Link>
          <fieldset disabled={loading || busy || !ready}>
            <label className="form-label" htmlFor="specialty-clinic">SAPS / sala</label>
            <select id="specialty-clinic" className="form-select mb-3" value={selectedClinic}
              onChange={event => { setSelectedClinic(event.target.value); setSuccess(''); }} required>
              <option value="">Seleccionar SAPS</option>
              {clinics.map(clinic => (
                <option key={clinic.id_salita} value={clinic.id_salita}>
                  {clinic.nombre}{clinic.activo ? '' : ' (inactiva)'}
                </option>
              ))}
            </select>
            {selectedClinic && (
              <>
                {!clinicSettings.some((setting) => setting.id_salita === selectedClinic) && (
                  <p className="small text-muted">Esta sala todavía no tiene una selección propia. Se conserva la oferta anterior hasta guardar las especialidades que atenderá.</p>
                )}
                <div className="row g-2 mb-3">
                  {rows.filter(row => row.activo || clinicSpecialties.includes(row.id)).map(row => (
                    <label key={row.id} className="col-md-6">
                      <input type="checkbox" className="form-check-input me-2"
                        checked={clinicSpecialties.includes(row.id)}
                        onChange={event => setClinicSpecialties(current => event.target.checked
                          ? [...current, row.id] : current.filter(id => id !== row.id))} />
                      {row.nombre}{row.activo ? '' : ' (inactiva)'}
                    </label>
                  ))}
                </div>
                {!rows.some(row => row.activo) && <p>No hay especialidades activas en el catálogo. El superadministrador puede cargarlas.</p>}
                <button className="btn btn-saps" type="submit">{busy ? 'Guardando…' : 'Guardar especialidades de la SAPS'}</button>
              </>
            )}
          </fieldset>
        </form>
      )}

      <div className="row g-4">
        {/* Formulario */}
        {canEditCatalog && <div className="col-xl-4">
          <form
            ref={formRef}
            className="dashboard-panel p-3 configuration-form"
            onSubmit={(event) => {
              event.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <h2 className="h5">
              {editing
                ? 'Editar registro'
                : 'Nuevo registro'}
            </h2>

            <fieldset
              disabled={busy || loading || !ready}
            >
              {tipo === 'especialidades' && !editing && (
                <label className="form-label w-100">Asignar nueva especialidad a la sala *
                  <select className="form-select" value={selectedClinic} required
                    onChange={(event) => setSelectedClinic(event.target.value)}>
                    <option value="">Seleccionar sala</option>
                    {clinics.filter((clinic) => clinic.activo).map((clinic) => (
                      <option key={clinic.id_salita} value={clinic.id_salita}>{clinic.nombre}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="form-label w-100">
                Nombre

                <input
                  ref={nameRef}
                  className="form-control"
                  required
                  maxLength={
                    tipo === 'barrios'
                      ? 120
                      : 100
                  }
                  value={form.nombre}
                  onChange={(e) =>
                    change({
                      nombre: e.target.value,
                    })
                  }
                />
              </label>

              {/* Campos específicos de barrios */}
              {tipo === 'barrios' ? (
                <>
                  <label className="form-label w-100">
                    Zona

                    <select
                      className="form-select"
                      required
                      value={form.id_zona ?? ''}
                      onChange={(e) =>
                        change({
                          id_zona: e.target.value,
                        })
                      }
                    >
                      <option value="">
                        Seleccionar zona
                      </option>

                      {zonas
                        .filter(
                          (zona) =>
                            zona.activo ||
                            zona.id_zona === form.id_zona
                        )
                        .map((zona) => (
                          <option
                            key={zona.id_zona}
                            value={zona.id_zona}
                          >
                            {zona.nombre}

                            {!zona.activo
                              ? ' (inactiva)'
                              : ''}
                          </option>
                        ))}
                    </select>
                  </label>

                  <Link
                    to="/configuracion/zonas"
                    className="d-inline-block mb-3"
                  >
                    Administrar zonas
                  </Link>

                  <label className="form-label w-100">
                    Código postal (opcional)

                    <input
                      className="form-control"
                      maxLength={12}
                      value={
                        form.codigo_postal ?? ''
                      }
                      onChange={(e) =>
                        change({
                          codigo_postal:
                            e.target.value,
                        })
                      }
                    />
                  </label>
                </>
              ) : (
                <label className="form-label w-100">
                  Descripción (opcional)

                  <textarea
                    className="form-control"
                    rows={3}
                    value={form.descripcion ?? ''}
                    onChange={(e) =>
                      change({
                        descripcion: e.target.value,
                      })
                    }
                  />
                </label>
              )}

              {/* Campos específicos de especialidades */}
              {tipo === 'especialidades' && (
                <>
                  <label className="form-label w-100">
                    Código

                    <input
                      className="form-control"
                      required
                      maxLength={30}
                      value={form.codigo ?? ''}
                      onChange={(e) =>
                        change({
                          codigo: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="form-check mb-3">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={
                        form.requiere_profesional ??
                        true
                      }
                      onChange={(e) =>
                        change({
                          requiere_profesional:
                            e.target.checked,
                        })
                      }
                    />

                    Requiere profesional
                  </label>
                </>
              )}

              {/* Estado del registro */}
              <label className="form-check my-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={form.activo}
                  onChange={(e) =>
                    change({
                      activo: e.target.checked,
                    })
                  }
                />

                Activo
              </label>

              <p className="small text-muted">
                Los registros inactivos se conservan, pero
                dejan de estar disponibles para nuevas
                selecciones.
              </p>

              <div className="d-flex flex-wrap gap-2">
                <button className="btn btn-saps">
                  {busy
                    ? 'Guardando…'
                    : 'Guardar'}
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
              </div>
            </fieldset>
          </form>
        </div>

        }
        {/* Listado de registros */}
        <div className={canEditCatalog ? 'col-xl-8' : 'col-12'}>
          <section className="dashboard-panel">
            <div className="p-3">
              <h2 className="h5">
                Registros ({filtered.length})
              </h2>

              <div className="row g-2">
                <label className={tipo === 'barrios' ? 'col-sm-4' : 'col-sm-8'}>
                  Buscar

                  <input
                    className="form-control"
                    type="search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Nombre o código"
                  />
                </label>

                {tipo === 'barrios' && (
                  <label className="col-sm-4">
                    Zona

                    <select
                      className="form-select"
                      value={zoneFilter}
                      onChange={(e) => {
                        setZoneFilter(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">Todas las zonas</option>
                      {zonas.map((zona) => (
                        <option key={zona.id_zona} value={zona.id_zona}>
                          {zona.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="col-sm-4">
                  Estado

                  <select
                    className="form-select"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="todos">
                      Todos
                    </option>

                    <option value="activos">
                      Activos
                    </option>

                    <option value="inactivos">
                      Inactivos
                    </option>
                  </select>
                </label>
              </div>
            </div>

            {loading ? (
              <p
                role="status"
                className="p-3"
              >
                Cargando registros…
              </p>
            ) : (
              <>
                {/* Vista móvil compacta (< 768px) */}
                <div className="d-md-none p-3 d-flex flex-column gap-2">
                  {paginatedRows.map((row) => (
                    <article
                      key={row.id}
                      className="bg-white border rounded-3 p-3 shadow-xs"
                      style={{
                        borderLeft: `4px solid ${row.activo ? '#16a34a' : '#94a3b8'}`,
                      }}
                    >
                      <div className="d-flex align-items-start justify-content-between gap-2 mb-1.5">
                        <div className="min-w-0">
                          <h3 className="h6 fw-bold text-dark mb-0.5 text-truncate">
                            {row.nombre}
                          </h3>
                          <div className="text-muted small">
                            {tipo === 'barrios'
                              ? zonas.find((z) => z.id_zona === row.id_zona)?.nombre ?? 'Sin zona asignada'
                              : row.codigo || row.descripcion || '—'}
                          </div>
                        </div>
                        <span
                          className={`badge rounded-pill flex-shrink-0 ${
                            row.activo
                              ? 'bg-success-subtle text-success border border-success-subtle'
                              : 'bg-secondary-subtle text-secondary border border-secondary-subtle'
                          }`}
                        >
                          {row.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>

                      {tipo === 'especialidades' && (
                        <div className="small text-muted mb-2">
                          <span className="fw-semibold text-dark">Salitas asignadas:</span>
                          {renderAssignedClinics(row.id, true)}
                        </div>
                      )}

                      <div className="pt-2 border-top d-flex justify-content-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success text-nowrap d-inline-flex align-items-center gap-1.5 py-1 px-2.5"
                          disabled={busy || !canEditCatalog}
                          onClick={() => edit(row)}
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
                        <th scope="col">
                          Nombre
                        </th>

                        <th scope="col">
                          {tipo === 'barrios'
                            ? 'Zona'
                            : 'Detalle'}
                        </th>

                        {tipo === 'especialidades' && <th scope="col" style={{ minWidth: '220px' }}>SAPS / salas</th>}
                        <th scope="col">
                          Estado
                        </th>

                        <th scope="col" className="text-end">
                          Acciones
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedRows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>
                              {row.nombre}
                            </strong>
                          </td>

                          <td>
                            {tipo === 'barrios'
                              ? zonas.find(
                                  (zona) =>
                                    zona.id_zona ===
                                    row.id_zona
                                )?.nombre ??
                                'Sin zona disponible'
                              : row.codigo ||
                                row.descripcion ||
                                '—'}
                          </td>

                          {tipo === 'especialidades' && (
                            <td>
                              {renderAssignedClinics(row.id, false)}
                            </td>
                          )}
                          <td>
                            <span
                              className={`badge rounded-pill ${
                                row.activo
                                  ? 'bg-success-subtle text-success border border-success-subtle'
                                  : 'bg-secondary-subtle text-secondary border border-secondary-subtle'
                              }`}
                            >
                              {row.activo
                                ? 'Activo'
                                : 'Inactivo'}
                            </span>
                          </td>

                          <td className="text-end text-nowrap">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success text-nowrap d-inline-flex align-items-center gap-1 py-1 px-2.5"
                              disabled={busy || !canEditCatalog}
                              onClick={() =>
                                edit(row)
                              }
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

                {!filtered.length && (
                  <p className="p-3 text-muted text-center mb-0">
                    No hay registros para estos filtros.
                  </p>
                )}

                {/* Controles de paginación de 15 registros */}
                <div className="p-3 border-top">
                  <PaginationControls
                    page={page}
                    totalPages={totalPages}
                    totalItems={filtered.length}
                    itemsPerPage={PAGE_SIZE}
                    onPageChange={setPage}
                    itemLabel="registros"
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
