import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import useManagedPatients from '../../context/useManagedPatients';
import { useAuth } from '../../context/AuthContext';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import PaginationControls from '../../components/ui/PaginationControls';
import {
  createTutorRequest,
  getOwnPatientTutors,
  getOwnTutorRequests,
  type PatientTutor,
  type TutorRequest,
  type TutorRequestDirection,
} from '../../services/tutor-requests.service';
import { authError } from '../../utils/auth-errors';
import { FloatingFeedbackToast } from '../../components/ui/FormFeedback';
import { useAutoDismiss } from '../../utils/useAutoDismiss';
import { formatManagedKinship } from '../../utils/kinship';
import { formatFechaHora } from '../../utils/agenda-display';

export default function PersonasACargoPage() {
  const { items, loading, error, retry } = useManagedPatients();
  const { patient: titular } = useAuth();
  const [requests, setRequests] = useState<TutorRequest[]>([]);
  const [responsibles, setResponsibles] = useState<PatientTutor[]>([]);
  const [direction, setDirection] = useState<TutorRequestDirection>('GESTIONAR_A_OTRO');
  const [dni, setDni] = useState('');
  const [parentesco, setParentesco] = useState('');

  // Estados de carga independientes para no bloquear una sección si la otra falla
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState('');
  const [responsiblesLoading, setResponsiblesLoading] = useState(true);
  const [responsiblesError, setResponsiblesError] = useState('');

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [revision, setRevision] = useState(0);
  const [requestsPage, setRequestsPage] = useState(1);

  useAutoDismiss(success, () => setSuccess(''), 15000);
  useAutoDismiss(formError, () => setFormError(''), 15000);

  // Actualización automática por WebSockets
  const { ultimoEventoPaciente, resyncTick } = useAgendaSocket();
  const lastPatientEventIdRef = useRef<string | null>(
    ultimoEventoPaciente?.id ?? null
  );
  const lastResyncTickRef = useRef<number>(resyncTick);

  useEffect(() => {
    if (!ultimoEventoPaciente) return;
    if (lastPatientEventIdRef.current === ultimoEventoPaciente.id) return;
    lastPatientEventIdRef.current = ultimoEventoPaciente.id;

    retry();
    setRevision((v) => v + 1);
  }, [ultimoEventoPaciente, retry]);

  useEffect(() => {
    if (resyncTick > 0 && resyncTick !== lastResyncTickRef.current) {
      lastResyncTickRef.current = resyncTick;
      retry();
      setRevision((v) => v + 1);
    }
  }, [resyncTick, retry]);

  // Carga independiente con Promise.allSettled para evitar que un fallo en tutores bloquee solicitudes
  useEffect(() => {
    let active = true;
    setRequestsLoading(true);
    setRequestsError('');
    setResponsiblesLoading(true);
    setResponsiblesError('');

    Promise.allSettled([getOwnTutorRequests(), getOwnPatientTutors()])
      .then(([reqRes, respRes]) => {
        if (!active) return;
        if (reqRes.status === 'fulfilled') {
          setRequests(reqRes.value);
        } else {
          setRequestsError(authError(reqRes.reason));
        }

        if (respRes.status === 'fulfilled') {
          setResponsibles(respRes.value);
        } else {
          setResponsiblesError(authError(respRes.reason));
        }
      })
      .finally(() => {
        if (active) {
          setRequestsLoading(false);
          setResponsiblesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [revision]);

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    setSuccess('');
    try {
      await createTutorRequest({
        direccion: direction,
        dni_persona_destino: dni.replace(/\D/g, ''),
        parentesco,
      });
      setDni('');
      setParentesco('');
      setSuccess('Solicitud enviada. La vinculación quedará pendiente hasta que la salita verifique la documentación y la apruebe.');
      setRevision((value) => value + 1);
    } catch (cause) {
      setFormError(authError(cause));
    } finally {
      setBusy(false);
    }
  };

  const ageInYears = (birth: string | null) => {
    if (!birth) return null;
    const date = new Date(`${birth}T12:00:00`);
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    if (
      today.getMonth() < date.getMonth() ||
      (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())
    ) {
      age -= 1;
    }
    return age;
  };

  return (
    <section>
      <div className="mb-4">
        <h1 className="h3 fw-bold text-dark mb-1">Personas a cargo</h1>
        <p className="text-muted mb-0">
          Consultá los familiares o dependientes vinculados a tu cuenta y el estado de tus solicitudes de autorización.
        </p>
      </div>

      {/* Formulario para solicitar nueva vinculación */}
      <div className="card border-0 shadow-sm p-4 bg-white rounded-3 mb-4">
        <h2 className="h5 fw-bold text-dark mb-2">Solicitar una vinculación</h2>
        <p className="small text-muted mb-3">
          La solicitud registra el pedido en el sistema. La persona titular y quien solicita gestionar deben presentar sus DNI y la documentación acreditante en su salita asignada para su verificación y aprobación definitiva.
        </p>

        <form onSubmit={submitRequest}>
          <fieldset disabled={busy}>
            <div className="mb-3">
              <label className="form-label fw-semibold small text-secondary w-100">
                ¿Qué tipo de autorización solicitás?
                <select
                  className="form-select mt-1"
                  value={direction}
                  onChange={(event) => setDirection(event.target.value as TutorRequestDirection)}
                >
                  <option value="GESTIONAR_A_OTRO">Quiero gestionar los turnos de otra persona (familiar o dependiente)</option>
                  <option value="DELEGAR_MI_GESTION">Quiero autorizar a otra persona para que gestione mis turnos</option>
                </select>
              </label>
            </div>

            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold small text-secondary w-100" htmlFor="vinculacion-dni">
                  DNI de {direction === 'GESTIONAR_A_OTRO' ? 'la persona a cargo' : 'la persona que autorizás'}
                  <input
                    id="vinculacion-dni"
                    className="form-control mt-1"
                    inputMode="numeric"
                    autoComplete="off"
                    minLength={7}
                    maxLength={15}
                    pattern="[0-9. -]{7,20}"
                    required
                    placeholder="Ej. 38521904"
                    value={dni}
                    onChange={(event) => setDni(event.target.value)}
                  />
                </label>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold small text-secondary w-100" htmlFor="vinculacion-relacion">
                  Tipo de vínculo o autorización
                  <input
                    id="vinculacion-relacion"
                    className="form-control mt-1"
                    placeholder="Madre, padre, hijo/a, tutor/a, persona autorizada…"
                    required
                    maxLength={50}
                    value={parentesco}
                    onChange={(event) => setParentesco(event.target.value)}
                  />
                </label>
              </div>
            </div>

            <button type="submit" className="btn btn-saps mt-3 d-inline-flex align-items-center gap-2" disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                  <span>Enviando solicitud…</span>
                </>
              ) : (
                <>
                  <i className="bi bi-send" aria-hidden="true" />
                  <span>Enviar solicitud</span>
                </>
              )}
            </button>
          </fieldset>
        </form>

        {formError && !success && (
          <FloatingFeedbackToast variant="error" message={formError} onDismiss={() => setFormError('')} />
        )}
        {success && <FloatingFeedbackToast variant="success" message={success} onDismiss={() => setSuccess('')} />}
      </div>

      {/* Sección 1: Personas a cargo habilitadas */}
      <div className="mb-4">
        <h2 className="h5 fw-bold text-dark mb-3 d-flex align-items-center gap-2">
          <i className="bi bi-people text-success" aria-hidden="true" />
          <span>Personas a cargo habilitadas</span>
        </h2>

        {loading && (
          <div className="card border-0 shadow-sm p-4 text-center text-muted mb-3" role="status">
            <div className="spinner-border spinner-border-sm text-success me-2" />
            <span>Consultando personas a cargo habilitadas…</span>
          </div>
        )}

        {error && !loading && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between gap-2 mb-3" role="alert">
            <span>{error}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={retry}>
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && !items.length && (
          <div className="card border-0 shadow-sm p-4 text-center text-muted mb-3">
            <i className="bi bi-people fs-2 d-block mb-2 text-secondary" />
            <p className="mb-0">
              No tenés personas a cargo habilitadas para gestionar turnos. Cuando la salita apruebe tu solicitud, aparecerán aquí.
            </p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="row g-3">
            {items.map((person) => {
              const age = ageInYears(person.fecha_nacimiento);
              return (
                <div key={person.id_paciente} className="col-12 col-md-6">
                  <article className="person-card h-100 bg-white">
                    <div className="person-card-header mb-3">
                      <div>
                        <span className="patient-selector-kicker">
                          Persona vinculada a tu cuenta
                        </span>
                        <h3 className="h5 fw-bold text-dark mb-0">
                          {person.apellidos}, {person.nombres}
                        </h3>
                      </div>
                      <span className="person-card-badge text-capitalize">
                        {formatManagedKinship(person, titular)}
                      </span>
                    </div>

                    <div className="person-card-info">
                      <div>
                        <span>DNI</span>
                        <strong className="text-nowrap">{person.dni}</strong>
                      </div>
                      <div>
                        <span>Teléfono</span>
                        <strong className="text-nowrap">{person.telefono || 'Sin registrar'}</strong>
                      </div>
                      <div>
                        <span>Condición</span>
                        <strong>
                          {age === null ? 'Edad no registrada' : age < 18 ? 'Menor de edad' : 'Adulto'}
                        </strong>
                      </div>
                      <div>
                        <span>Autorización</span>
                        <strong className="text-success">
                          <i className="bi bi-shield-check me-1" />
                          Activa · Habilitada
                        </strong>
                      </div>
                      {person.fecha_hasta && (
                        <div>
                          <span>Válida hasta</span>
                          <strong className="text-nowrap">
                            {person.fecha_hasta.split('-').reverse().join('/')}
                          </strong>
                        </div>
                      )}
                    </div>

                    <div className="d-flex flex-wrap gap-2 pt-2 border-top">
                      <Link
                        className="btn btn-sm btn-saps d-inline-flex align-items-center justify-content-center gap-1 text-nowrap flex-grow-1 flex-sm-grow-0"
                        style={{ minHeight: '38px' }}
                        to={`/solicitar-turno?paciente=${person.id_paciente}`}
                      >
                        <i className="bi bi-calendar-plus" aria-hidden="true" />
                        <span>Solicitar turno</span>
                      </Link>
                      <Link
                        className="btn btn-sm btn-outline-success d-inline-flex align-items-center justify-content-center gap-1 text-nowrap flex-grow-1 flex-sm-grow-0"
                        style={{ minHeight: '38px' }}
                        to={`/mis-turnos?paciente=${person.id_paciente}`}
                      >
                        <i className="bi bi-calendar-check" aria-hidden="true" />
                        <span>Ver turnos</span>
                      </Link>
                      <Link
                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center gap-1 text-nowrap flex-grow-1 flex-sm-grow-0"
                        style={{ minHeight: '38px' }}
                        to={`/mi-historia?paciente=${person.id_paciente}`}
                      >
                        <i className="bi bi-journal-medical" aria-hidden="true" />
                        <span>Historia clínica</span>
                      </Link>
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sección 2: Personas autorizadas sobre tu perfil titular */}
      <div className="mb-4">
        <h2 className="h5 fw-bold text-dark mb-3 d-flex align-items-center gap-2">
          <i className="bi bi-person-check text-success" aria-hidden="true" />
          <span>Personas autorizadas sobre tu perfil titular</span>
        </h2>

        {responsiblesLoading ? (
          <div className="card border-0 shadow-sm p-4 text-center text-muted mb-3" role="status">
            <div className="spinner-border spinner-border-sm text-success me-2" />
            <span>Consultando autorizaciones…</span>
          </div>
        ) : responsiblesError ? (
          <div className="alert alert-danger d-flex align-items-center justify-content-between gap-2 mb-3" role="alert">
            <span>{responsiblesError}</span>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => setRevision((v) => v + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : responsibles.length === 0 ? (
          <div className="card border-0 shadow-sm p-4 text-center text-muted mb-3">
            <i className="bi bi-shield-lock fs-2 d-block mb-2 text-secondary" />
            <p className="mb-0">No hay otras personas autorizadas para gestionar tus turnos.</p>
          </div>
        ) : (
          <div className="d-grid gap-2 mb-3">
            {responsibles.map((tutor) => {
              const today = new Date().toLocaleDateString('en-CA', {
                timeZone: 'America/Argentina/Buenos_Aires',
              });
              const active =
                tutor.puede_gestionar_turnos &&
                tutor.fecha_desde <= today &&
                (!tutor.fecha_hasta || tutor.fecha_hasta >= today);
              const status = !tutor.puede_gestionar_turnos
                ? 'Revocada'
                : tutor.fecha_hasta && tutor.fecha_hasta < today
                ? 'Vencida'
                : tutor.fecha_desde > today
                ? 'Programada'
                : 'Activa';

              return (
                <div key={tutor.id_tutor} className="card border-0 shadow-sm p-3 bg-white">
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
                    <strong className="text-dark">
                      {tutor.apellidos}, {tutor.nombres}
                    </strong>
                    <span
                      className={`badge ${
                        active
                          ? 'bg-success-subtle text-success border border-success-subtle'
                          : 'bg-secondary-subtle text-secondary'
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="d-flex flex-wrap gap-3 small text-secondary">
                    <span>
                      DNI: <strong className="text-dark text-nowrap">{tutor.dni}</strong>
                    </span>
                    <span>
                      Parentesco: <strong className="text-dark text-capitalize">{tutor.parentesco}</strong>
                    </span>
                    {active && (
                      <span className="text-success">
                        <i className="bi bi-check-circle me-1" />
                        Puede solicitar, consultar y cancelar turnos
                      </span>
                    )}
                  </div>
                  {tutor.fecha_modificacion && (
                    <small className="text-muted mt-2 d-block pt-1 border-top">
                      Última modificación: {formatFechaHora(tutor.fecha_modificacion)}
                      {tutor.modificado_por?.nombre_usuario ? ` · por ${tutor.modificado_por.nombre_usuario}` : ''}
                    </small>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sección 3: Estado de tus solicitudes */}
      <div>
        <h2 className="h5 fw-bold text-dark mb-3 d-flex align-items-center gap-2">
          <i className="bi bi-clock-history text-success" aria-hidden="true" />
          <span>Estado de tus solicitudes</span>
        </h2>

        {requestsLoading ? (
          <div className="card border-0 shadow-sm p-4 text-center text-muted" role="status">
            <div className="spinner-border spinner-border-sm text-success me-2" />
            <span>Consultando solicitudes…</span>
          </div>
        ) : requestsError ? (
          <div className="alert alert-danger d-flex align-items-center justify-content-between gap-2" role="alert">
            <span>{requestsError}</span>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => setRevision((v) => v + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : requests.length === 0 ? (
          <div className="card border-0 shadow-sm p-4 text-center text-muted">
            <i className="bi bi-inbox fs-2 d-block mb-2 text-secondary" />
            <p className="mb-0">No tenés solicitudes de vinculación registradas.</p>
          </div>
        ) : (
          <>
            <div className="table-responsive shadow-sm rounded-3 bg-white border">
              <table className="table align-middle table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Tipo de solicitud</th>
                    <th>DNI</th>
                    <th>Vínculo declarado</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {requests
                    .slice((requestsPage - 1) * 15, requestsPage * 15)
                    .map((request) => (
                      <tr key={request.id_solicitud}>
                        <td>
                          {request.direccion === 'GESTIONAR_A_OTRO'
                            ? 'Gestionar a otra persona'
                            : 'Delegar mis turnos'}
                        </td>
                        <td>
                          <span className="text-nowrap fw-medium">{request.dni_persona_destino}</span>
                        </td>
                        <td>{request.parentesco}</td>
                        <td>
                          {request.estado === 'PENDIENTE' ? (
                            <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle d-inline-flex align-items-center gap-1">
                              <i className="bi bi-clock" aria-hidden="true" />
                              <span>Pendiente de revisión</span>
                            </span>
                          ) : request.estado === 'APROBADA' ? (
                            <span className="badge bg-success-subtle text-success-emphasis border border-success-subtle d-inline-flex align-items-center gap-1">
                              <i className="bi bi-check-circle" aria-hidden="true" />
                              <span>Aprobada</span>
                            </span>
                          ) : (
                            <span className="badge bg-danger-subtle text-danger-emphasis border border-danger-subtle d-inline-flex align-items-center gap-1">
                              <i className="bi bi-x-circle" aria-hidden="true" />
                              <span>Rechazada</span>
                            </span>
                          )}
                          {request.motivo_rechazo && (
                            <div className="small text-muted mt-1">Motivo: {request.motivo_rechazo}</div>
                          )}
                        </td>
                        <td>
                          <span className="text-nowrap">{formatFechaHora(request.fecha_creacion)}</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <PaginationControls
              page={requestsPage}
              totalPages={Math.ceil(requests.length / 15)}
              totalItems={requests.length}
              itemsPerPage={15}
              onPageChange={setRequestsPage}
              loading={requestsLoading}
              itemLabel="solicitudes"
              className="mt-3"
            />
          </>
        )}
      </div>
    </section>
  );
}
