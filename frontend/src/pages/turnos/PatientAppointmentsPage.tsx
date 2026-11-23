import {
  useEffect,
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import {
  getTurnos,
} from '../../services/turnos.service';

import type {
  Turno,
  TurnosFilters,
} from '../../types/turno.types';

import TurnoCard from '../../components/ui/TurnoCard';
import useManagedPatients from '../../context/useManagedPatients';
import ManagedPatientSelector from '../../components/ui/ManagedPatientSelector';
import PaginationControls from '../../components/ui/PaginationControls';
import { useAuth } from '../../context/AuthContext';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import { formatManagedKinship } from '../../utils/kinship';
import { formatFechaHora } from '../../utils/agenda-display';

import {
  getEstadoClass,
} from '../../utils/turno-status';

export default function PatientAppointmentsPage() {
  const { patient: titularPatient } = useAuth();
  const selection = useManagedPatients();

  const managedDependent = selection.items.find(
    (m) => m.id_paciente === selection.selected?.id_paciente
  );
  const isViewingDependent = Boolean(selection.selected && managedDependent);
  const kinText = managedDependent ? formatManagedKinship(managedDependent, titularPatient) : '';
  // FILTROS

  // Período seleccionado:
  // próximos, anteriores o historial completo.
  const [
    periodo,
    setPeriodo,
  ] = useState<TurnosFilters['periodo']>();

  // Estado seleccionado para filtrar los turnos.
  const [
    estado,
    setEstado,
  ] = useState('');

  //PAGINACIÓN

  const [pageState, setPageState] = useState({ patientId: '', page: 1 });
  const page = pageState.patientId === selection.id ? pageState.page : 1;
  const setPage = (value: number | ((current: number) => number)) => {
    setPageState(current => {
      const currentPage = current.patientId === selection.id ? current.page : 1;
      return {
        patientId: selection.id,
        page: typeof value === 'function' ? value(currentPage) : value,
      };
    });
  };

  const [pages, setPages] = useState(0);
  const [totalItems, setTotalItems] = useState<number | null>(null);

  // ESTADO DE LA PÁGINA
  const [items, setItems] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Permite volver a cargar los turnos sin reiniciar la página actual.
  const [revision, setRevision] = useState(0);

  // WebSocket central: actualización reactiva en segundo plano
  const { ultimoEvento, resyncTick } = useAgendaSocket();

  useEffect(() => {
    if (!ultimoEvento) return;
    const evtPatientId = (ultimoEvento as any).id_paciente;
    const isTargetPatient = !evtPatientId || evtPatientId === selection.id;
    if (isTargetPatient) {
      setRevision((v) => v + 1);
    }
  }, [ultimoEvento, selection.id]);

  useEffect(() => {
    if (resyncTick > 0) {
      setRevision((v) => v + 1);
    }
  }, [resyncTick]);

  //  CARGA DE TURNOS (15 registros por página)
  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');
    if (selection.loading || selection.error || !selection.selected) {
      setLoading(selection.loading);
      return;
    }

    void getTurnos({
      id_paciente: selection.id,
      periodo,
      ...(
        estado === 'REPROGRAMADO'
          ? {
              reprogramados: 'true',
            }
          : estado
            ? {
                estado,
              }
            : {}
      ),
      orden: 'desc',
      page,
      limit: 15,
    })
      .then((response) => {
        if (active) {
          setItems(response.data.turnos);
          setPages(response.data.pagination.totalPages);
          setTotalItems(response.data.pagination.total);
        }
      })
      .catch(() => {
        if (active) {
          setError('No se pudieron cargar tus turnos.');
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
  }, [
    periodo,
    estado,
    page,
    revision,
    selection.id, selection.loading, selection.error, selection.selected,
  ]);

  // INTERFAZ

  return (
    <section>
      {/* Encabezado y acción principal. */}
      <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
        <div>
          <h1 className="h3">
            Mis turnos
          </h1>

          <p className="text-muted">
            {isViewingDependent
              ? `Turnos e historial de atención de ${selection.selected?.nombres} ${selection.selected?.apellidos}${kinText ? ` (${kinText})` : ''}.`
              : 'Consultá próximos turnos y tu historial de atención.'}
          </p>
        </div>

        <Link
          className="btn btn-saps align-self-start"
          to={`/solicitar-turno?paciente=${selection.id}`}
        >
          Solicitar turno
        </Link>
      </div>

      {/* FILTROS */}
      <ManagedPatientSelector selection={selection} />

      <div className="row g-3 mb-4">
        {/* Filtro por período. */}
        <div className="col-12 col-sm-6">
          <label className="form-label w-100">
            Período

            <select
              className="form-select mt-1"
              value={periodo ?? ''}
              onChange={(event) => {
                setPeriodo(
                  (
                    event.target.value ||
                    undefined
                  ) as TurnosFilters['periodo']
                );

                // Regresa a la primera página
                // cuando cambia el filtro.
                setPage(1);
              }}
            >
              <option value="">
                Historial de turnos completo
              </option>

              <option value="proximos">
                Próximos
              </option>

              <option value="anteriores">
                Anteriores
              </option>
            </select>
          </label>
        </div>

        {/* Filtro por estado. */}
        <div className="col-12 col-sm-6">
          <label className="form-label w-100">
            Estado

            <select
              className="form-select mt-1"
              value={estado}
              onChange={(event) => {
                setEstado(
                  event.target.value
                );

                // Regresa a la primera página
                // cuando cambia el filtro.
                setPage(1);
              }}
            >
              <option value="">
                Todos los estados
              </option>

              {Object.entries({
                SOLICITADO: 'Solicitados',
                CONFIRMADO: 'Confirmados',
                EN_ESPERA: 'En espera',
                CANCELADO: 'Cancelados',
                REPROGRAMADO: 'Reprogramados',
                ATENDIDO: 'Atendidos',
                NO_ASISTIO: 'No asistió',
              }).map(
                ([
                  value,
                  label,
                ]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                )
              )}
            </select>
          </label>
        </div>
      </div>

      {/* ERROR */}

      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}{' '}

          <button
            className="btn btn-outline-danger"
            onClick={() =>
              setRevision(
                (v) => v + 1
              )
            }
          >
            Reintentar
          </button>
        </div>
      )}

      {/* LISTADO DE TURNOS */}

      {loading ? (
        <div className="card border-0 shadow-sm p-4 text-center text-muted" role="status">
          <div>
            <div className="spinner-border spinner-border-sm text-success me-2" aria-hidden="true" />
            <span className="align-middle">Cargando turnos…</span>
          </div>
        </div>
      ) : !error && (
        <>
          {!items.length ? (
            // No existen turnos para los filtros.
            <div className="patient-section">
              <p className="mb-0">
                No tenés turnos registrados para
                estos filtros.
              </p>
            </div>
          ) : (
            <>
              {/* VISTA MÓVIL */}

              <div className="d-grid d-md-none gap-3">
                {items.map(
                  (turno) => (
                    <TurnoCard
                      key={turno.id_turno}
                      turno={turno}
                      patient
                      onChanged={() =>
                        setRevision(
                          (v) => v + 1
                        )
                      }
                    />
                  )
                )}
              </div>

              {/* VISTA ESCRITORIO*/}

              <div className="table-responsive d-none d-md-block shadow-sm rounded-3 bg-white border">
                <table className="table align-middle table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th scope="col" style={{ minWidth: '160px' }}>Fecha y hora</th>
                      <th scope="col" style={{ minWidth: '180px' }}>Profesional / Especialidad</th>
                      <th scope="col" style={{ minWidth: '160px' }}>Salita</th>
                      <th scope="col" style={{ minWidth: '120px' }}>Estado</th>
                      <th scope="col" style={{ minWidth: '160px' }}>Motivo</th>
                      <th scope="col" style={{ minWidth: '140px' }}>Solicitado por</th>
                      <th scope="col" style={{ width: '130px', minWidth: '130px', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map(
                      (t) => (
                        <tr key={t.id_turno}>
                          {/* Fecha y hora uniforme del turno. */}
                          <td>
                            <span className="fw-semibold text-nowrap">
                              {formatFechaHora(t.fecha_hora_inicio)}
                            </span>
                          </td>

                          {/* Profesional y especialidad. */}
                          <td>
                            <span className="d-block text-dark fw-medium">
                              {t.profesional?.persona
                                ? `${t.profesional.persona.apellidos}, ${t.profesional.persona.nombres}`
                                : 'Profesional asignado'}
                            </span>
                            <small className="text-muted">
                              {t.especialidad?.nombre || 'Consulta General'}
                            </small>
                          </td>

                          {/* Salita asignada. */}
                          <td>
                            <span className="text-secondary">
                              {t.salita?.nombre || 'Salita asignada'}
                            </span>
                          </td>

                          {/* Estado actual del turno. */}
                          <td>
                            <span className={getEstadoClass(t.estado.codigo)}>
                              {t.estado.nombre}
                            </span>
                          </td>

                          {/* Motivo legible (sin UUIDs técnicos). */}
                          <td>
                            <span className="text-dark">
                              {t.motivo_consulta || 'Consulta general'}
                            </span>
                          </td>

                          {/* Solicitado por */}
                          <td>
                            <span className="text-secondary small">
                              {t.solicitante?.persona
                                ? `${t.solicitante.persona.apellidos}, ${t.solicitante.persona.nombres}`
                                : t.solicitante?.nombre_usuario || 'Cuenta no disponible'}
                            </span>
                          </td>

                          {/* Acceso al detalle. */}
                          <td className="text-center" style={{ width: '130px', minWidth: '130px' }}>
                            <Link
                              className="btn btn-sm btn-outline-success d-inline-flex align-items-center justify-content-center gap-1 text-nowrap"
                              style={{ minHeight: '36px', whiteSpace: 'nowrap' }}
                              to={`/mis-turnos/${t.id_turno}`}
                              title="Ver detalle completo del turno"
                            >
                              <i className="bi bi-eye" aria-hidden="true" />
                              <span>Ver detalle</span>
                            </Link>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/*  PAGINACIÓN REUTILIZABLE (15 REGISTROS POR PÁGINA) */}
      <PaginationControls
        page={page}
        totalPages={pages}
        totalItems={totalItems}
        itemsPerPage={15}
        onPageChange={(newPage) => setPage(newPage)}
        loading={loading}
        itemLabel="turnos"
        className="mt-4"
      />
    </section>
  );
}
