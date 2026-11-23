import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import DerivacionModal from '../../components/historia-clinica/DerivacionModal';
import { FloatingFeedbackToast } from '../../components/ui/FormFeedback';
import {
  extractClinicalApiError,
  getHistoriaClinicaContext,
  listarDerivacionesClinicas,
  searchClinicalPatients,
} from '../../services/historia-clinica.service';
import type {
  ClinicalPatientSearchItem,
  DerivacionClinica,
  DerivacionEstado,
  HistoriaClinicaContextData,
} from '../../types/historia-clinica.types';
import {
  derivacionEstadoBadgeClass,
  findEspecialidadNombre,
  findProfesionalNombre,
  findSalitaNombre,
  formatArgentinaDate,
  formatArgentinaDateTime,
} from '../../utils/historia-clinica-format';
import {
  RECOVERABLE_ERROR_TIMEOUT_MS,
  SUCCESS_MESSAGE_TIMEOUT_MS,
  useAutoDismiss,
} from '../../utils/useAutoDismiss';

export default function DerivacionesClinicasPage() {
  const [searchParams] = useSearchParams();

  const [context, setContext] = useState<HistoriaClinicaContextData | null>(null);
  const [selectedSalita, setSelectedSalita] = useState(searchParams.get('salita') || '');
  const [estadoFilter, setEstadoFilter] = useState<DerivacionEstado | ''>('');
  const [derivaciones, setDerivaciones] = useState<DerivacionClinica[]>([]);

  const [patientsCatalog, setPatientsCatalog] = useState<ClinicalPatientSearchItem[]>([]);
  const [newPatientId, setNewPatientId] = useState(searchParams.get('paciente') || '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useAutoDismiss(notice, () => setNotice(null), SUCCESS_MESSAGE_TIMEOUT_MS, Boolean(notice));
  useAutoDismiss(
    error,
    () => setError(null),
    RECOVERABLE_ERROR_TIMEOUT_MS,
    Boolean(error) && Boolean(context)
  );

  const [modalMode, setModalMode] = useState<'create' | 'resolve' | null>(null);
  const [targetDerivacion, setTargetDerivacion] = useState<DerivacionClinica | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const ctx = await getHistoriaClinicaContext();
        if (!active) return;
        setContext(ctx);
        const firstSalita =
          searchParams.get('salita') || ctx.salitas_autorizadas[0]?.id_salita || '';
        setSelectedSalita(firstSalita);

        if (ctx.id_profesional && firstSalita) {
          const patientData = await searchClinicalPatients({ limit: 50, page: 1 }).catch(
            () => null
          );
          if (active && patientData) {
            setPatientsCatalog(patientData.patients);
            if (!searchParams.get('paciente') && patientData.patients[0]) {
              setNewPatientId(patientData.patients[0].id_paciente);
            }
          }
        }
      } catch (err) {
        if (active) setError(extractClinicalApiError(err).message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [searchParams]);

  const loadDerivaciones = useCallback(async () => {
    if (!selectedSalita) {
      setDerivaciones([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const list = await listarDerivacionesClinicas({
        id_salita: selectedSalita,
        estado: estadoFilter || undefined,
      });
      setDerivaciones(list);
    } catch (err) {
      setError(extractClinicalApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [selectedSalita, estadoFilter]);

  useEffect(() => {
    if (selectedSalita) {
      void loadDerivaciones();
    }
  }, [selectedSalita, estadoFilter, loadDerivaciones]);

  const patientNameMap = new Map(
    patientsCatalog.map((p) => [p.id_paciente, `${p.apellidos}, ${p.nombres} (DNI ${p.dni})`])
  );

  return (
    <div className="hc-page">
      <div className="hc-hero d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <h1 className="h3 mb-1">
            <i className="bi bi-arrow-left-right text-primary me-2" />
            Derivaciones clínicas
          </h1>
          <p className="text-muted small mb-0">
            Gestioná solicitudes y autorizaciones vigentes entre salitas.
          </p>
        </div>
      </div>

      {notice && (
        <FloatingFeedbackToast
          variant="success"
          message={notice}
          onDismiss={() => setNotice(null)}
        />
      )}

      {error && !context && (
        <div className="alert alert-danger mb-0" role="alert">
          <i className="bi bi-exclamation-octagon me-2" />
          {error}
        </div>
      )}

      {error && context && (
        <FloatingFeedbackToast
          variant="error"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      <div className="hc-card p-3">
        <div className="row g-3 align-items-end">
          <div className="col-12 col-lg-3">
            <label className="form-label fw-semibold" htmlFor="hc-deriv-salita-filter">
              Salita participante
            </label>
            <select
              id="hc-deriv-salita-filter"
              className="form-select"
              value={selectedSalita}
              onChange={(e) => setSelectedSalita(e.target.value)}
            >
              <option value="">Seleccionar salita...</option>
              {context?.salitas_autorizadas.map((s) => (
                <option key={s.id_salita} value={s.id_salita}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-lg-3">
            <label className="form-label fw-semibold" htmlFor="hc-deriv-estado-filter">
              Estado
            </label>
            <select
              id="hc-deriv-estado-filter"
              className="form-select"
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value as DerivacionEstado | '')}
            >
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="AUTORIZADA">Autorizadas</option>
              <option value="RECHAZADA">Rechazadas</option>
              <option value="REVOCADA">Revocadas</option>
              <option value="VENCIDA">Vencidas</option>
            </select>
          </div>

          {context?.id_profesional && patientsCatalog.length > 0 && (
            <div className="col-12 col-lg-6">
              <label className="form-label fw-semibold" htmlFor="hc-deriv-patient-new">
                Nueva derivación para paciente
              </label>
              <div className="d-flex flex-column flex-sm-row gap-2 align-items-stretch align-items-sm-center">
                <select
                  id="hc-deriv-patient-new"
                  className="form-select"
                  style={{ minWidth: 0, flex: '1 1 0%' }}
                  value={newPatientId}
                  onChange={(e) => setNewPatientId(e.target.value)}
                >
                  {patientsCatalog.map((p) => (
                    <option key={p.id_paciente} value={p.id_paciente}>
                      {p.apellidos}, {p.nombres} ({p.dni})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary text-nowrap flex-shrink-0"
                  disabled={!newPatientId}
                  onClick={() => {
                    setTargetDerivacion(null);
                    setModalMode('create');
                  }}
                >
                  <i className="bi bi-plus-circle me-1" />
                  Solicitar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="hc-card p-5 text-center text-muted">
          <div className="spinner-border text-primary mb-2" role="status" />
          <div>Cargando derivaciones...</div>
        </div>
      ) : derivaciones.length === 0 ? (
        <div className="hc-empty-state">
          <i className="bi bi-inbox fs-1 text-muted d-block mb-2" />
          <h5>Sin derivaciones para mostrar</h5>
          <p className="mb-0">
            No se encontraron derivaciones o autorizaciones con los filtros seleccionados.
          </p>
        </div>
      ) : (
        <>
          {/* Vista móvil */}
          <div className="hc-mobile-list d-md-none">
            {derivaciones.map((item) => {
              const canResolve =
                item.estado === 'PENDIENTE' || item.estado === 'AUTORIZADA';

              return (
                <article key={item.id_derivacion} className="hc-mobile-item">
                  <div className="hc-mobile-item-head">
                    <div>
                      <div className="hc-mobile-item-title">{item.tipo}</div>
                      <div className="small text-muted">Alcance: {item.alcance}</div>
                    </div>
                    <span className={derivacionEstadoBadgeClass(item.estado)}>
                      {item.estado}
                    </span>
                  </div>

                  <div className="small">
                    <strong>Paciente:</strong>{' '}
                    {patientNameMap.get(item.id_paciente) || item.id_paciente}
                  </div>
                  <div className="small">
                    {findSalitaNombre(context?.catalogo_salitas ?? [], item.id_salita_origen)}
                    {' → '}
                    {findSalitaNombre(context?.catalogo_salitas ?? [], item.id_salita_destino)}
                  </div>
                  <div className="small text-muted">
                    Vigencia: {formatArgentinaDate(item.fecha_desde)} al{' '}
                    {formatArgentinaDate(item.fecha_hasta)}
                  </div>
                  <div className="small text-muted">{item.motivo}</div>

                  <div className="hc-mobile-item-actions">
                    <Link
                      to={`/historia-clinica/pacientes/${item.id_paciente}?salita=${encodeURIComponent(selectedSalita)}`}
                      state={{
                        origin: 'derivaciones',
                        returnTo: '/historia-clinica/derivaciones',
                        returnLabel: 'Volver a derivaciones',
                      }}
                      className="btn btn-sm btn-outline-success"
                    >
                      Ver HC
                    </Link>
                    {canResolve && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => {
                          setTargetDerivacion(item);
                          setModalMode('resolve');
                        }}
                      >
                        {item.estado === 'PENDIENTE' ? 'Resolver' : 'Revocar'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Vista escritorio */}
          <div className="hc-card overflow-hidden d-none d-md-block">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Tipo / Alcance</th>
                    <th>Paciente</th>
                    <th>Origen → Destino</th>
                    <th>Destinatario</th>
                    <th>Vigencia</th>
                    <th>Estado</th>
                    <th className="text-end text-nowrap" style={{ width: '120px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {derivaciones.map((item) => {
                    const canResolve =
                      item.estado === 'PENDIENTE' || item.estado === 'AUTORIZADA';

                    return (
                      <tr key={item.id_derivacion}>
                        <td>
                          <div className="fw-semibold">{item.tipo}</div>
                          <div className="small text-muted">Alcance: {item.alcance}</div>
                        </td>
                        <td>
                          <div className="small fw-medium">
                            {patientNameMap.get(item.id_paciente) || item.id_paciente}
                          </div>
                          <Link
                            to={`/historia-clinica/pacientes/${item.id_paciente}?salita=${encodeURIComponent(selectedSalita)}`}
                            state={{
                              origin: 'derivaciones',
                              returnTo: '/historia-clinica/derivaciones',
                              returnLabel: 'Volver a derivaciones',
                            }}
                            className="small text-decoration-none"
                          >
                            Ver HC
                          </Link>
                        </td>
                        <td>
                          <div>
                            {findSalitaNombre(context?.catalogo_salitas ?? [], item.id_salita_origen)}
                            {' → '}
                            {findSalitaNombre(context?.catalogo_salitas ?? [], item.id_salita_destino)}
                          </div>
                          <div className="small text-muted">{item.motivo}</div>
                        </td>
                        <td className="small">
                          {item.id_especialidad_destino && (
                            <div>
                              Esp.:{' '}
                              {findEspecialidadNombre(
                                context?.catalogo_especialidades ?? [],
                                item.id_especialidad_destino
                              )}
                            </div>
                          )}
                          {item.id_profesional_destino && (
                            <div>
                              Prof.:{' '}
                              {findProfesionalNombre(
                                context?.catalogo_profesionales ?? [],
                                item.id_profesional_destino
                              )}
                            </div>
                          )}
                        </td>
                        <td className="small">
                          <div>{formatArgentinaDate(item.fecha_desde)}</div>
                          <div>al {formatArgentinaDate(item.fecha_hasta)}</div>
                        </td>
                        <td>
                          <span className={derivacionEstadoBadgeClass(item.estado)}>
                            {item.estado}
                          </span>
                          {item.fecha_resolucion && (
                            <div className="small text-muted mt-1">
                              {formatArgentinaDateTime(item.fecha_resolucion)}
                            </div>
                          )}
                        </td>
                        <td className="text-end text-nowrap">
                          {canResolve && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary text-nowrap"
                              onClick={() => {
                                setTargetDerivacion(item);
                                setModalMode('resolve');
                              }}
                            >
                              {item.estado === 'PENDIENTE' ? 'Resolver' : 'Revocar'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {context && modalMode && (
        <DerivacionModal
          open
          mode={modalMode}
          context={context}
          idPaciente={targetDerivacion?.id_paciente || newPatientId}
          patientLabel={
            patientNameMap.get(targetDerivacion?.id_paciente || newPatientId) ||
            targetDerivacion?.id_paciente
          }
          defaultSalitaOrigen={selectedSalita}
          targetDerivacion={targetDerivacion}
          activeSalitaForResolve={selectedSalita}
          onClose={() => {
            setModalMode(null);
            setTargetDerivacion(null);
          }}
          onSaved={(msg) => {
            setNotice(msg);
            void loadDerivaciones();
          }}
        />
      )}
    </div>
  );
}
