import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { CompletePersonInput, PersonProfile } from '../../types/auth.types';
import {
  correctManagedPerson,
  getManagedAccounts,
  setManagedAccountStatus,
  type ManagedAccount,
} from '../../services/access-management.service';
import type { Salita } from '../../types/salita.types';
import { authError } from '../../utils/auth-errors';
import PersonProfileFields from './PersonProfileFields';
import ConfirmationModal from './ConfirmationModal';
import PaginationControls from './PaginationControls';

export default function AccessManagementPanel({
  revision,
  salitas,
}: {
  revision: number;
  salitas: Salita[];
}) {
  const { user, reloadProfile } = useAuth();
  const [role, setRole] = useState('');
  const [clinic, setClinic] = useState('');
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<PersonProfile | null>(null);
  const [draft, setDraft] = useState<CompletePersonInput>({
    dni: '',
    nombres: '',
    apellidos: '',
  });
  const [statusTarget, setStatusTarget] = useState<ManagedAccount | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const editor = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const load = async () => {
      try {
        const result = await getManagedAccounts(page, search, role, clinic);
        if (!active) return;
        setAccounts(result.items);
        setTotal(result.total);
        setPages(result.totalPages);
      } catch (cause) {
        if (active) setError(authError(cause));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [page, revision, refresh, search, role, clinic]);

  const edit = (person: PersonProfile) => {
    setTarget(person);
    setDraft({
      dni: person.dni,
      nombres: person.nombres,
      apellidos: person.apellidos,
      fecha_nacimiento: person.fecha_nacimiento,
      sexo: person.sexo,
      telefono: person.telefono ?? '',
      direccion: person.direccion ?? '',
      localidad: person.localidad ?? '',
      provincia: person.provincia ?? '',
      codigo_postal: person.codigo_postal ?? '',
    });
    setError('');
    setMessage('');
  };

  useEffect(() => {
    if (target) {
      editor.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [target]);

  const savePerson = async () => {
    if (!target || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await correctManagedPerson(target.id_persona, {
        ...draft,
        direccion: draft.direccion?.trim() || null,
      });
      if (target.id_persona === user?.id_persona) await reloadProfile();
      setTarget(null);
      setMessage('Datos personales actualizados correctamente.');
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(authError(cause));
    } finally {
      setBusy(false);
      setConfirmSave(false);
    }
  };

  const changeStatus = async () => {
    if (!statusTarget || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await setManagedAccountStatus(
        statusTarget.id_usuario,
        !statusTarget.activo
      );
      setMessage(
        statusTarget.activo
          ? `La cuenta de ${statusTarget.nombre_usuario} fue dada de baja.`
          : `La cuenta de ${statusTarget.nombre_usuario} fue reactivada.`
      );
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(authError(cause));
    } finally {
      setBusy(false);
      setStatusTarget(null);
    }
  };

  const hasActiveFilters = Boolean(search || role || clinic);

  return (
    <section
      id="administrar-accesos"
      className="mt-4 border-top pt-4"
      style={{ scrollMarginTop: '6rem' }}
    >
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h2 className="h5 fw-bold mb-1">
            <i className="bi bi-people-fill text-success me-2" aria-hidden="true" />
            Cuentas y personal administrativo
          </h2>
          <p className="text-muted small mb-0">
            {user?.rol === 'SUPER_ADMIN'
              ? 'Administrá las cuentas de superadministradores, administradores de salitas municipales y personal de recepción.'
              : 'Consultá y gestioná las cuentas de administración y recepción de tus salitas con asignación vigente.'}
          </p>
        </div>
      </div>

      {/* Barra de filtros compacta y profesional */}
      <div className="card border-0 bg-light p-3 mb-4 rounded-3 shadow-none">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchInput.trim());
            setPage(1);
            setRefresh((value) => value + 1);
          }}
        >
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-5">
              <label
                htmlFor="search-accounts"
                className="form-label small fw-semibold text-muted mb-1"
              >
                <i className="bi bi-search me-1" aria-hidden="true" />
                Buscar por usuario o correo
              </label>
              <div className="input-group input-group-sm">
                <input
                  id="search-accounts"
                  className="form-control"
                  type="search"
                  placeholder="Nombre de usuario o correo..."
                  maxLength={100}
                  value={searchInput}
                  disabled={busy}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-success d-inline-flex align-items-center"
                  disabled={busy || loading}
                >
                  <i className="bi bi-search me-1" aria-hidden="true" />
                  Buscar
                </button>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-md-3">
              <label
                htmlFor="filter-role"
                className="form-label small fw-semibold text-muted mb-1"
              >
                <i className="bi bi-person-badge me-1" aria-hidden="true" />
                Cargo
              </label>
              <select
                id="filter-role"
                className="form-select form-select-sm"
                value={role}
                disabled={busy}
                onChange={(event) => {
                  setRole(event.target.value);
                  if (event.target.value === 'SUPER_ADMIN') setClinic('');
                  setPage(1);
                }}
              >
                <option value="">
                  {user?.rol === 'SUPER_ADMIN'
                    ? 'Todos los cargos'
                    : 'Todos los cargos de la sala'}
                </option>
                {user?.rol === 'SUPER_ADMIN' && (
                  <option value="SUPER_ADMIN">Superadministrador</option>
                )}
                <option value="ADMIN_SALITA">Administrador de sala</option>
                <option value="RECEPCION">Recepción</option>
              </select>
            </div>

            <div className="col-12 col-sm-6 col-md-4">
              <label
                htmlFor="filter-clinic"
                className="form-label small fw-semibold text-muted mb-1"
              >
                <i className="bi bi-hospital me-1" aria-hidden="true" />
                Sala asignada
              </label>
              <select
                id="filter-clinic"
                className="form-select form-select-sm"
                value={clinic}
                disabled={busy || role === 'SUPER_ADMIN'}
                onChange={(event) => {
                  setClinic(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">
                  {user?.rol === 'SUPER_ADMIN'
                    ? 'Todas las salas'
                    : 'Todas mis salas'}
                </option>
                {salitas.map((salita) => (
                  <option key={salita.id_salita} value={salita.id_salita}>
                    {salita.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>

        <div className="d-flex flex-wrap align-items-center justify-content-between mt-3 pt-2 border-top border-light-subtle">
          <span className="badge bg-white text-dark border px-2 py-1 fw-medium">
            <i className="bi bi-check-circle text-success me-1" aria-hidden="true" />
            {total} {total === 1 ? 'cuenta encontrada' : 'cuentas encontradas'}
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn-link btn-sm text-decoration-none text-muted p-0"
              onClick={() => {
                setSearchInput('');
                setSearch('');
                setRole('');
                setClinic('');
                setPage(1);
              }}
            >
              <i className="bi bi-x-circle me-1" aria-hidden="true" />
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger mb-3" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2" aria-hidden="true" />
          {error}
        </div>
      )}

      {message && (
        <div className="alert alert-success mb-3" role="status">
          <i className="bi bi-check-circle-fill me-2" aria-hidden="true" />
          {message}
        </div>
      )}

      {/* Editor rápido de perfil */}
      {target && (
        <form
          ref={editor}
          className="border rounded-3 p-3 p-md-4 mb-4 bg-light shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            setConfirmSave(true);
          }}
        >
          <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
            <h3 className="h6 fw-bold mb-0 text-success">
              <i className="bi bi-pencil-square me-2" aria-hidden="true" />
              Corregir datos de {target.nombres} {target.apellidos}
            </h3>
            <button
              type="button"
              className="btn-close"
              aria-label="Cerrar formulario"
              onClick={() => setTarget(null)}
            />
          </div>
          <fieldset disabled={busy}>
            <PersonProfileFields value={draft} onChange={setDraft} />
            <div className="d-flex flex-wrap gap-2 mt-3 pt-2 border-top">
              <button className="btn btn-success" type="submit">
                <i className="bi bi-check-lg me-1" aria-hidden="true" />
                Guardar cambios
              </button>
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => setTarget(null)}
              >
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}

      {/* Listado de cuentas */}
      {loading ? (
        <div className="text-center py-5 text-muted" role="status">
          <div className="spinner-border spinner-border-sm text-success me-2" />
          Cargando cuentas administrativas…
        </div>
      ) : !error && (
        <>
          <div className="row g-3">
            {accounts.map((account) => {
              const isSuperAdmin = account.rol.codigo === 'SUPER_ADMIN';
              const isRecepcion = account.rol.codigo === 'RECEPCION';
              const isSelf = account.id_usuario === user?.id_usuario;

              return (
                <div className="col-12 col-xl-6" key={account.id_usuario}>
                  <article className="card h-100 border rounded-3 shadow-none p-3 d-flex flex-column justify-content-between">
                    <div>
                      <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-2 pb-2 border-bottom">
                        <div className="d-flex align-items-center gap-2">
                          <div
                            className={`p-2 rounded-circle ${
                              isSuperAdmin
                                ? 'bg-primary-subtle text-primary'
                                : isRecepcion
                                ? 'bg-warning-subtle text-warning'
                                : 'bg-success-subtle text-success'
                            }`}
                          >
                            <i
                              className={`bi ${
                                isSuperAdmin
                                  ? 'bi-shield-check'
                                  : isRecepcion
                                  ? 'bi-person-lines-fill'
                                  : 'bi-person-badge'
                              } fs-5`}
                              aria-hidden="true"
                            />
                          </div>
                          <div>
                            <h3 className="h6 fw-bold mb-0 text-dark">
                              {account.nombre_usuario}
                            </h3>
                            <small className="text-muted">
                              {account.persona
                                ? `${account.persona.nombres} ${account.persona.apellidos}`
                                : 'Perfil personal pendiente'}
                            </small>
                          </div>
                        </div>

                        <div className="d-flex align-items-center gap-1">
                          <span
                            className={`badge ${
                              isSuperAdmin
                                ? 'bg-primary-subtle text-primary border border-primary-subtle'
                                : isRecepcion
                                ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                                : 'bg-info-subtle text-info border border-info-subtle'
                            } rounded-pill`}
                          >
                            {account.rol.nombre}
                          </span>
                          <span
                            className={`badge ${
                              account.activo
                                ? 'bg-success-subtle text-success border border-success-subtle'
                                : 'bg-danger-subtle text-danger border border-danger-subtle'
                            } rounded-pill`}
                          >
                            {account.activo ? 'Activa' : 'Inactiva'}
                          </span>
                        </div>
                      </div>

                      <div className="small text-muted d-flex flex-column gap-1 mb-3">
                        <div className="d-flex align-items-center gap-2 text-dark">
                          <i className="bi bi-envelope text-muted" aria-hidden="true" />
                          <span className="text-break">{account.email}</span>
                        </div>

                        <div className="d-flex align-items-center gap-2">
                          <i className="bi bi-hospital text-muted" aria-hidden="true" />
                          <span>
                            {isSuperAdmin
                              ? 'Alcance global municipal'
                              : account.asignaciones
                                  .map((a) => a.salita?.nombre)
                                  .filter(Boolean)
                                  .join(', ') || 'Sin sala vigente asignada'}
                          </span>
                        </div>

                        {account.persona ? (
                          <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-person-vcard text-muted" aria-hidden="true" />
                            <span>
                              DNI {account.persona.dni}
                              {account.persona.telefono
                                ? ` · Tel: ${account.persona.telefono}`
                                : ''}
                            </span>
                          </div>
                        ) : (
                          <div className="text-warning small">
                            <i className="bi bi-exclamation-circle me-1" aria-hidden="true" />
                            Debe completar sus datos al ingresar.
                          </div>
                        )}
                      </div>
                    </div>

                    {user?.rol === 'SUPER_ADMIN' && (
                      <div className="d-flex flex-wrap gap-2 pt-2 border-top mt-auto">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1"
                          disabled={busy || !account.persona}
                          onClick={() => account.persona && edit(account.persona)}
                        >
                          <i className="bi bi-pencil" aria-hidden="true" />
                          Editar datos
                        </button>

                        <button
                          type="button"
                          className={`btn btn-sm ${
                            account.activo
                              ? 'btn-outline-danger'
                              : 'btn-outline-success'
                          } d-inline-flex align-items-center gap-1`}
                          disabled={busy || isSelf}
                          onClick={() => setStatusTarget(account)}
                        >
                          <i
                            className={`bi ${
                              account.activo
                                ? 'bi-person-x'
                                : 'bi-person-check'
                            }`}
                            aria-hidden="true"
                          />
                          {account.activo ? 'Dar de baja' : 'Reactivar'}
                        </button>

                        {isSelf && (
                          <span className="text-muted small align-self-center ms-auto">
                            (Tu cuenta activa)
                          </span>
                        )}
                      </div>
                    )}
                  </article>
                </div>
              );
            })}
          </div>

          {total === 0 && (
            <div className="text-center py-5 text-muted border rounded-3 bg-light">
              <i className="bi bi-person-x fs-2 text-muted d-block mb-2" />
              <p className="fw-semibold mb-1">No hay registros disponibles</p>
              <p className="small mb-0">
                {hasActiveFilters
                  ? 'Probá ajustando o limpiando los filtros de búsqueda.'
                  : 'Aún no se crearon cuentas en este alcance.'}
              </p>
            </div>
          )}

          {/* Paginación estandarizada */}
          <div className="mt-4">
            <PaginationControls
              page={page}
              totalPages={pages}
              totalItems={total}
              itemsPerPage={10}
              onPageChange={setPage}
              loading={loading || busy}
              itemLabel="cuentas"
            />
          </div>
        </>
      )}

      <ConfirmationModal
        open={Boolean(statusTarget)}
        title={
          statusTarget?.activo
            ? 'Dar de baja la cuenta'
            : 'Reactivar cuenta'
        }
        message={`${statusTarget?.nombre_usuario ?? ''}: ${
          statusTarget?.activo
            ? 'se impedirá el acceso y se revocarán sus sesiones activas. Sus datos y registros se conservarán.'
            : 'podrá volver a ingresar al sistema normalmente.'
        }`}
        confirmText="Confirmar"
        loading={busy}
        onClose={() => {
          if (!busy) setStatusTarget(null);
        }}
        onConfirm={() => void changeStatus()}
      />

      <ConfirmationModal
        open={confirmSave}
        title="Guardar datos personales"
        message="¿Confirmás la corrección de los datos personales de esta persona?"
        confirmText="Guardar"
        loading={busy}
        onClose={() => {
          if (!busy) setConfirmSave(false);
        }}
        onConfirm={() => void savePerson()}
      />
    </section>
  );
}
