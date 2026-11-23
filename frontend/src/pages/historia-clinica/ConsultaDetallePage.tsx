import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';

import EstudioModal from '../../components/historia-clinica/EstudioModal';
import EvolucionModal from '../../components/historia-clinica/EvolucionModal';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { FloatingFeedbackToast } from '../../components/ui/FormFeedback';
import { useAuth } from '../../context/AuthContext';
import {
  anularConsultaBorrador,
  extractClinicalApiError,
  firmarConsultaMedica,
  getConsultaMedicaById,
  getHistoriaClinicaContext,
} from '../../services/historia-clinica.service';
import {
  CLINICAL_PERMISSIONS,
  type ConsultaMedicaDetalle,
  type EstudioClinico,
  type EvolucionClinica,
  type HistoriaClinicaContextData,
} from '../../types/historia-clinica.types';
import {
  consultaEstadoBadgeClass,
  estudioEstadoBadgeClass,
  evolucionEstadoBadgeClass,
  findEspecialidadNombre,
  findProfesionalNombre,
  findSalitaNombre,
  formatArgentinaDate,
  formatArgentinaDateTime,
  formatSignedConsultaNotice,
} from '../../utils/historia-clinica-format';
import { type ClinicalNavState } from '../../utils/historia-clinica-navigation';
import {
  RECOVERABLE_ERROR_TIMEOUT_MS,
  SUCCESS_MESSAGE_TIMEOUT_MS,
  useAutoDismiss,
} from '../../utils/useAutoDismiss';

export default function ConsultaDetallePage() {
  const { idConsulta } = useParams<{ idConsulta: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navState = (location.state as ClinicalNavState | null) ?? null;
  const { hasPermission, user } = useAuth();

  const isProfessional = user?.rol === 'PROFESIONAL';
  const canCreateConsulta = isProfessional && hasPermission(CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA);
  const canEvoluciones = isProfessional && hasPermission(CLINICAL_PERMISSIONS.REGISTRAR_EVOLUCIONES);
  const canEstudios = isProfessional && hasPermission(CLINICAL_PERMISSIONS.GESTIONAR_ESTUDIOS_CLINICOS);

  const [context, setContext] = useState<HistoriaClinicaContextData | null>(null);
  const [salitaId, setSalitaId] = useState(searchParams.get('salita') || '');
  const [consulta, setConsulta] = useState<ConsultaMedicaDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useAutoDismiss(notice, () => setNotice(null), SUCCESS_MESSAGE_TIMEOUT_MS, Boolean(notice));
  useAutoDismiss(
    error,
    () => setError(null),
    RECOVERABLE_ERROR_TIMEOUT_MS,
    Boolean(error) && Boolean(consulta)
  );

  const [signConfirmOpen, setSignConfirmOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const [evolucionModal, setEvolucionModal] = useState<{
    mode: 'create' | 'rectify';
    target?: EvolucionClinica;
  } | null>(null);
  const [estudioModal, setEstudioModal] = useState<{
    mode: 'status' | 'inform';
    estudio: EstudioClinico;
  } | null>(null);

  const loadData = useCallback(async (targetSalita: string) => {
    if (!idConsulta || !targetSalita) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await getConsultaMedicaById(idConsulta, {
        id_salita: targetSalita,
        id_paciente: searchParams.get('paciente') || undefined,
      });
      setConsulta(detail);
    } catch (err) {
      setError(extractClinicalApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [idConsulta, searchParams]);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const ctx = await getHistoriaClinicaContext();
        if (!active) return;
        setContext(ctx);
        const nextSalita =
          searchParams.get('salita') || ctx.salitas_autorizadas[0]?.id_salita || '';
        setSalitaId(nextSalita);
        if (nextSalita) {
          await loadData(nextSalita);
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(extractClinicalApiError(err).message);
          setLoading(false);
        }
      }
    };
    void init();
    return () => {
      active = false;
    };
  }, [loadData, searchParams]);

  const handleSignConsulta = async () => {
    if (!consulta || !salitaId || actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      const signed = await firmarConsultaMedica(consulta.id_consulta, {
        id_salita: salitaId,
        id_paciente: consulta.id_paciente,
      });
      if (signed?.estado && signed.estado !== 'FIRMADA') {
        setError('No se pudo completar la firma de la consulta; el registro continúa en borrador.');
        return;
      }
      setNotice(formatSignedConsultaNotice(Boolean(signed?.turno_actualizado)));
      setSignConfirmOpen(false);
      await loadData(salitaId);
    } catch (err) {
      const parsed = extractClinicalApiError(err);
      setError(parsed.message);
      if (parsed.status === 409) {
        setSignConfirmOpen(false);
        await loadData(salitaId);
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancelDraft = async () => {
    if (!consulta || !salitaId) return;
    if (motivoAnulacion.trim().length < 3) {
      setError('Ingresá un motivo de anulación válido (mínimo 3 caracteres).');
      return;
    }

    setActionBusy(true);
    setError(null);
    try {
      await anularConsultaBorrador(consulta.id_consulta, {
        id_salita: salitaId,
        id_paciente: consulta.id_paciente,
        motivo_anulacion: motivoAnulacion.trim(),
      });
      setNotice('Borrador de consulta anulado.');
      setCancelModalOpen(false);
      setMotivoAnulacion('');
      await loadData(salitaId);
    } catch (err) {
      setError(extractClinicalApiError(err).message);
    } finally {
      setActionBusy(false);
    }
  };

  const isOwnDraft =
    consulta?.estado === 'BORRADOR' &&
    context?.id_profesional === consulta.id_profesional_autor;

  const dossierUrl =
    navState?.dossierReturnTo ||
    (consulta
      ? `/historia-clinica/pacientes/${consulta.id_paciente}?salita=${encodeURIComponent(salitaId)}`
      : '/historia-clinica');

  return (
    <div className="hc-page">
      <div className="hc-hero d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <h1 className="h3 mb-1">
            <i className="bi bi-file-earmark-medical text-success me-2" />
            Detalle de consulta clínica
          </h1>
          <p className="text-muted small mb-0">
            Registro clínico de la consulta médica y seguimiento asociado.
          </p>
        </div>

        <div className="hc-hero-actions">
          {navState?.returnTo && navState.origin !== 'buscador' && (
            <Link to={navState.returnTo} className="btn btn-outline-primary btn-sm">
              <i className="bi bi-arrow-left-circle me-1" />
              {navState.returnLabel || 'Volver al origen'}
            </Link>
          )}
          <Link
            to={dossierUrl}
            state={navState}
            className="btn btn-outline-secondary btn-sm"
          >
            <i className="bi bi-arrow-left me-1" />
            {consulta ? 'Volver al expediente' : 'Volver al buscador'}
          </Link>
        </div>
      </div>

      {notice && (
        <FloatingFeedbackToast
          variant="success"
          message={notice}
          onDismiss={() => setNotice(null)}
        />
      )}

      {error && !consulta && (
        <div className="alert alert-danger mb-0" role="alert">
          <i className="bi bi-exclamation-octagon me-2" />
          {error}
        </div>
      )}

      {error && consulta && (
        <FloatingFeedbackToast
          variant="error"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      {loading ? (
        <div className="hc-card p-5 text-center text-muted">
          <div className="spinner-border text-success mb-2" role="status" />
          <div>Cargando consulta médica...</div>
        </div>
      ) : !consulta ? (
        <div className="hc-empty-state">
          <h5>No fue posible mostrar esta consulta</h5>
          <p className="mb-0">Verificá la salita seleccionada o tu alcance sobre el paciente.</p>
        </div>
      ) : (
        <>
          <div className="hc-card p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
              <div>
                <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                  <span className={consultaEstadoBadgeClass(consulta.estado)}>
                    {consulta.estado === 'BORRADOR'
                      ? 'Pendiente de firma'
                      : consulta.estado === 'FIRMADA'
                        ? 'Consulta firmada'
                        : 'Consulta anulada'}
                  </span>
                </div>
                <h2 className="h4 mb-1">{consulta.motivo_consulta}</h2>
                <div className="small text-muted">
                  Atención: {formatArgentinaDateTime(consulta.fecha_atencion)} | Salita:{' '}
                  {findSalitaNombre(context?.catalogo_salitas ?? [], consulta.id_salita)} | Especialidad:{' '}
                  {findEspecialidadNombre(context?.catalogo_especialidades ?? [], consulta.id_especialidad)} | Profesional:{' '}
                  {findProfesionalNombre(context?.catalogo_profesionales ?? [], consulta.id_profesional)}
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2">
                {canCreateConsulta && isOwnDraft && (
                  <>
                    <Link
                      to={`/historia-clinica/consultas/${consulta.id_consulta}/editar?salita=${encodeURIComponent(salitaId)}&paciente=${encodeURIComponent(consulta.id_paciente)}`}
                      state={navState}
                      className="btn btn-outline-primary btn-sm"
                    >
                      <i className="bi bi-pencil-square me-1" />
                      Continuar editando
                    </Link>
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      onClick={() => setSignConfirmOpen(true)}
                    >
                      <i className="bi bi-patch-check me-1" />
                      Firmar consulta
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => setCancelModalOpen(true)}
                    >
                      <i className="bi bi-x-circle me-1" />
                      Anular borrador
                    </button>
                  </>
                )}
                {canEvoluciones && consulta.estado === 'FIRMADA' && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setEvolucionModal({ mode: 'create' })}
                  >
                    <i className="bi bi-plus-circle me-1" />
                    Agregar evolución
                  </button>
                )}
              </div>
            </div>

            {consulta.estado === 'FIRMADA' && (
              <div className="alert alert-success border border-success-subtle py-2 px-3 small mb-3" role="status">
                <i className="bi bi-patch-check-fill me-1" />
                Registro firmado el {formatArgentinaDateTime(consulta.firmada_en)}. Protegido contra modificaciones directas; cualquier corrección posterior debe realizarse mediante una evolución o rectificación trazable.
              </div>
            )}

            {consulta.estado === 'ANULADA' && (
              <div className="alert alert-danger py-2 px-3 small mb-3">
                Consulta anulada el {formatArgentinaDateTime(consulta.anulada_en)} — Motivo: {consulta.motivo_anulacion}
              </div>
            )}

            <div className="row g-3">
              <div className="col-md-4">
                <span className="hc-meta-label">Síntomas / Anamnesis</span>
                <p className="mb-0">{consulta.sintomas || '—'}</p>
              </div>
              <div className="col-md-4">
                <span className="hc-meta-label">Examen físico</span>
                <p className="mb-0">{consulta.examen_fisico || '—'}</p>
              </div>
              <div className="col-md-4">
                <span className="hc-meta-label">Observaciones</span>
                <p className="mb-0">{consulta.observaciones || '—'}</p>
              </div>
            </div>
          </div>

          <div className="hc-card p-4">
            <h3 className="h5 mb-3">Diagnósticos ({consulta.diagnosticos.length})</h3>
            {consulta.diagnosticos.length === 0 ? (
              <p className="text-muted small mb-0">Sin diagnósticos registrados.</p>
            ) : (
              <ul className="list-group list-group-flush">
                {consulta.diagnosticos.map((d) => (
                  <li key={d.id_diagnostico} className="list-group-item px-0">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                      <div>
                        <strong>{d.descripcion}</strong>{' '}
                        {d.codigo && <code className="ms-1">{d.codigo}</code>}
                      </div>
                      <span className="badge text-bg-light border">
                        {d.tipo} · {d.estado}
                      </span>
                    </div>
                    <div className="small text-muted">
                      Fecha: {formatArgentinaDate(d.fecha_diagnostico)}
                      {d.observaciones ? ` — ${d.observaciones}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="hc-card p-4">
            <h3 className="h5 mb-3">Evoluciones clínicas ({consulta.evoluciones.length})</h3>
            {consulta.evoluciones.length === 0 ? (
              <p className="text-muted small mb-0">Sin evoluciones registradas en esta consulta.</p>
            ) : (
              <div className="d-grid gap-3">
                {consulta.evoluciones.map((ev) => (
                  <div key={ev.id_evolucion} className="border rounded p-3">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className={evolucionEstadoBadgeClass(ev.estado)}>
                          {ev.estado}
                        </span>
                        <span className="badge text-bg-light border">v{ev.version}</span>
                        {ev.es_correccion && (
                          <span className="badge text-bg-info">Rectificación</span>
                        )}
                      </div>
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <span className="small text-muted">
                          {formatArgentinaDateTime(ev.fecha_evolucion)}
                        </span>
                        {canEvoluciones &&
                          consulta.estado === 'FIRMADA' &&
                          ev.estado === 'FIRMADA' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() =>
                                setEvolucionModal({ mode: 'rectify', target: ev })
                              }
                            >
                              Rectificar
                            </button>
                          )}
                      </div>
                    </div>
                    {ev.motivo_correccion && (
                      <div className="small text-primary mb-1">
                        <strong>Motivo de rectificación:</strong> {ev.motivo_correccion}
                      </div>
                    )}
                    <p className="mb-1">{ev.evolucion}</p>
                    <div className="small text-muted">
                      Profesional:{' '}
                      {findProfesionalNombre(
                        context?.catalogo_profesionales ?? [],
                        ev.id_profesional_responsable
                      )}
                      {ev.observaciones ? ` | Obs.: ${ev.observaciones}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="row g-3">
            <div className="col-lg-6">
              <div className="hc-card p-4 h-100">
                <h3 className="h5 mb-3">Tratamientos ({consulta.tratamientos.length})</h3>
                {consulta.tratamientos.length === 0 ? (
                  <p className="text-muted small mb-0">Sin tratamientos registrados.</p>
                ) : (
                  <div className="d-grid gap-2">
                    {consulta.tratamientos.map((t) => (
                      <div key={t.id_tratamiento} className="border rounded p-2 small">
                        <div className="fw-semibold">
                          {t.medicacion} — {t.dosis} ({t.frecuencia})
                        </div>
                        <div className="text-muted">
                          Estado: {t.estado} | Desde: {formatArgentinaDate(t.fecha_inicio)}
                          {t.duracion ? ` | Duración: ${t.duracion}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="col-lg-6">
              <div className="hc-card p-4 h-100">
                <h3 className="h5 mb-3">Estudios ({consulta.estudios.length})</h3>
                {consulta.estudios.length === 0 ? (
                  <p className="text-muted small mb-0">Sin estudios solicitados.</p>
                ) : (
                  <div className="d-grid gap-2">
                    {consulta.estudios.map((es) => (
                      <div key={es.id_estudio} className="border rounded p-2 small">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <strong>{es.tipo_estudio}</strong>
                          <span className={estudioEstadoBadgeClass(es.estado)}>
                            {es.estado}
                          </span>
                        </div>
                        <div>{es.descripcion}</div>
                        {es.resultado && (
                          <div className="mt-1 p-2 bg-light rounded">
                            <strong>Resultado ({formatArgentinaDateTime(es.fecha_resultado)}):</strong>{' '}
                            {es.resultado}
                          </div>
                        )}
                        {canEstudios &&
                          (es.estado === 'SOLICITADO' || es.estado === 'EN_PROCESO') && (
                            <div className="d-flex flex-wrap gap-2 mt-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() =>
                                  setEstudioModal({ mode: 'status', estudio: es })
                                }
                              >
                                Cambiar estado
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success"
                                onClick={() =>
                                  setEstudioModal({ mode: 'inform', estudio: es })
                                }
                              >
                                Informar resultado
                              </button>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmationModal
        open={signConfirmOpen}
        title="Firmar consulta médica"
        subtitle="Esta acción es definitiva e irreversible."
        message="¿Confirmás la firma de esta consulta médica? Una vez firmada no podrá editarse ni anularse."
        confirmText="Firmar consulta"
        variant="success"
        icon="bi-patch-check"
        loading={actionBusy}
        onClose={() => setSignConfirmOpen(false)}
        onConfirm={() => void handleSignConsulta()}
      />

      {cancelModalOpen && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1050 }} />
          <div
            className="modal d-block fade show"
            role="dialog"
            aria-modal="true"
            style={{ zIndex: 1055 }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow">
                <div className="modal-header">
                  <h5 className="modal-title text-danger">Anular consulta en borrador</h5>
                  <button
                    type="button"
                    className="btn-close"
                    disabled={actionBusy}
                    onClick={() => setCancelModalOpen(false)}
                  />
                </div>
                <div className="modal-body">
                  <label className="form-label fw-semibold" htmlFor="det-motivo-anular">
                    Motivo de anulación *
                  </label>
                  <textarea
                    id="det-motivo-anular"
                    className="form-control"
                    rows={3}
                    value={motivoAnulacion}
                    onChange={(e) => setMotivoAnulacion(e.target.value)}
                    placeholder="Indicá por qué se anula este borrador..."
                  />
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={actionBusy}
                    onClick={() => setCancelModalOpen(false)}
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={actionBusy}
                    onClick={() => void handleCancelDraft()}
                  >
                    {actionBusy ? 'Anulando...' : 'Confirmar anulación'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {evolucionModal && consulta && (
        <EvolucionModal
          open
          mode={evolucionModal.mode}
          idSalita={salitaId}
          idConsulta={consulta.id_consulta}
          targetEvolucion={evolucionModal.target}
          onClose={() => setEvolucionModal(null)}
          onSaved={(msg) => {
            setNotice(msg);
            void loadData(salitaId);
          }}
        />
      )}

      {estudioModal && (
        <EstudioModal
          open
          mode={estudioModal.mode}
          idSalita={salitaId}
          estudio={estudioModal.estudio}
          onClose={() => setEstudioModal(null)}
          onSaved={(msg) => {
            setNotice(msg);
            void loadData(salitaId);
          }}
        />
      )}
    </div>
  );
}
