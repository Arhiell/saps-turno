import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import DerivacionModal from '../../components/historia-clinica/DerivacionModal';
import EstudioModal from '../../components/historia-clinica/EstudioModal';
import EvolucionModal from '../../components/historia-clinica/EvolucionModal';
import ExportarHistoriaModal from '../../components/historia-clinica/ExportarHistoriaModal';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { FloatingFeedbackToast } from '../../components/ui/FormFeedback';
import { useAuth } from '../../context/AuthContext';
import { getParametros } from '../../services/configuracion.service';
import { getSpecialties } from '../../services/especialidades.service';
import {
  anularConsultaBorrador,
  extractClinicalApiError,
  firmarConsultaMedica,
  getHistoriaClinicaContext,
  getHistoriaClinicaPaciente,
  listarDerivacionesClinicas,
} from '../../services/historia-clinica.service';
import type { Parametro } from '../../types/configuracion.types';
import type { Specialty } from '../../types/profesional.types';
import {
  CLINICAL_PERMISSIONS,
  type ConsultaMedicaItem,
  type DerivacionClinica,
  type EstudioClinico,
  type EvolucionClinica,
  type HistoriaClinicaContextData,
  type HistoriaClinicaDossier,
} from '../../types/historia-clinica.types';
import {
  alergiaGravedadBadgeClass,
  calculateAgeLabel,
  consultaEstadoBadgeClass,
  derivacionEstadoBadgeClass,
  estudioEstadoBadgeClass,
  evolucionEstadoBadgeClass,
  findProfesionalNombre,
  findSalitaNombre,
  formatArgentinaDate,
  formatArgentinaDateTime,
  formatSignedConsultaNotice,
} from '../../utils/historia-clinica-format';
import {
  resolvePrimaryBackTarget,
  type ClinicalNavState,
} from '../../utils/historia-clinica-navigation';
import {
  RECOVERABLE_ERROR_TIMEOUT_MS,
  SUCCESS_MESSAGE_TIMEOUT_MS,
  useAutoDismiss,
} from '../../utils/useAutoDismiss';

type DossierTab =
  | 'resumen'
  | 'antecedentes_personales'
  | 'antecedentes_familiares'
  | 'alergias'
  | 'consultas'
  | 'diagnosticos'
  | 'evoluciones'
  | 'tratamientos'
  | 'estudios'
  | 'derivaciones';

export default function HistoriaClinicaPacientePage() {
  const { idPaciente } = useParams<{ idPaciente: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const navState = (location.state as ClinicalNavState | null) ?? null;
  const { hasPermission, user } = useAuth();

  const isProfessional = user?.rol === 'PROFESIONAL';
  const canCreateConsulta = isProfessional && hasPermission(CLINICAL_PERMISSIONS.CREAR_CONSULTA_CLINICA);
  const canEvoluciones = isProfessional && hasPermission(CLINICAL_PERMISSIONS.REGISTRAR_EVOLUCIONES);
  const canEstudios = isProfessional && hasPermission(CLINICAL_PERMISSIONS.GESTIONAR_ESTUDIOS_CLINICOS);
  const canDerivaciones = hasPermission(
    CLINICAL_PERMISSIONS.GESTIONAR_DERIVACIONES_CLINICAS
  );
  const canCreateDerivacion = isProfessional && canDerivaciones;

  const [context, setContext] = useState<HistoriaClinicaContextData | null>(null);
  const [selectedSalita, setSelectedSalita] = useState(searchParams.get('salita') || '');
  const [selectedEspecialidad, setSelectedEspecialidad] = useState('');
  const [specialtiesList, setSpecialtiesList] = useState<Specialty[]>([]);
  const [clinicSettings, setClinicSettings] = useState<Parametro[]>([]);
  const [loadingEspecialidades, setLoadingEspecialidades] = useState(false);
  const [activeTab, setActiveTab] = useState<DossierTab>('resumen');

  const [dossier, setDossier] = useState<HistoriaClinicaDossier | null>(null);
  const [derivaciones, setDerivaciones] = useState<DerivacionClinica[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(navState?.notice ?? null);

  useAutoDismiss(notice, () => setNotice(null), SUCCESS_MESSAGE_TIMEOUT_MS, Boolean(notice));
  useAutoDismiss(
    error,
    () => {
      setError(null);
      setErrorStatus(null);
    },
    RECOVERABLE_ERROR_TIMEOUT_MS,
    Boolean(error) && errorStatus !== 403 && Boolean(dossier)
  );

  const [signTarget, setSignTarget] = useState<ConsultaMedicaItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ConsultaMedicaItem | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const [evolucionModal, setEvolucionModal] = useState<{
    mode: 'create' | 'rectify';
    idConsulta: string;
    target?: EvolucionClinica;
  } | null>(null);

  const [estudioModal, setEstudioModal] = useState<{
    mode: 'status' | 'inform';
    estudio: EstudioClinico;
  } | null>(null);

  const [derivacionModal, setDerivacionModal] = useState<{
    mode: 'create' | 'resolve';
    target?: DerivacionClinica;
  } | null>(null);

  const [exportModalOpen, setExportModalOpen] = useState(false);

  const fetchDossier = useCallback(
    async (salitaId: string, espId?: string) => {
      if (!idPaciente || !salitaId) return;
      setLoading(true);
      setError(null);
      setErrorStatus(null);
      try {
        const data = await getHistoriaClinicaPaciente(idPaciente, {
          id_salita: salitaId,
          id_especialidad: espId || undefined,
          motivo_acceso: 'Consulta de historia clínica longitudinal',
        });
        setDossier(data);

        if (canDerivaciones) {
          const derivs = await listarDerivacionesClinicas({
            id_salita: salitaId,
            id_paciente: idPaciente,
          }).catch(() => []);
          setDerivaciones(derivs);
        }
      } catch (err) {
        const parsed = extractClinicalApiError(err);
        setDossier(null);
        setError(parsed.message);
        setErrorStatus(parsed.status);
      } finally {
        setLoading(false);
      }
    },
    [idPaciente, canDerivaciones]
  );

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const ctx = await getHistoriaClinicaContext();
        if (!active) return;
        setContext(ctx);
        const initialSalita =
          searchParams.get('salita') || ctx.salitas_autorizadas[0]?.id_salita || '';
        setSelectedSalita(initialSalita);

        if (initialSalita) {
          await fetchDossier(initialSalita);
        } else {
          setLoading(false);
          setError('No poseés una salita vigente habilitada para consultar esta historia clínica.');
          setErrorStatus(403);
        }
      } catch (err) {
        if (active) {
          const parsed = extractClinicalApiError(err);
          setError(parsed.message);
          setErrorStatus(parsed.status);
          setLoading(false);
        }
      }
    };
    void init();
    return () => {
      active = false;
    };
  }, [fetchDossier, searchParams]);

  useEffect(() => {
    let active = true;
    setLoadingEspecialidades(true);
    Promise.all([
      getSpecialties().catch(() => ({ success: true, data: [] })),
      getParametros().catch(() => []),
    ])
      .then(([espRes, params]) => {
        if (!active) return;
        setSpecialtiesList(espRes.data ?? []);
        setClinicSettings(params ?? []);
      })
      .finally(() => {
        if (active) setLoadingEspecialidades(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const availableEspecialidades = useMemo(() => {
    const baseList: { id_especialidad: string; nombre: string }[] =
      specialtiesList.length > 0
        ? specialtiesList.filter((s) => s.activo)
        : (context?.catalogo_especialidades ?? context?.especialidades_autorizadas ?? []);

    const setting = clinicSettings.find(
      (s) => s.clave === 'salita.especialidades' && s.id_salita === selectedSalita
    );
    const allowedIds =
      setting && Array.isArray(setting.valor) && setting.valor.length > 0
        ? new Set(setting.valor as string[])
        : null;

    const patientEspMap = new Map<string, string>();
    (dossier?.consultas ?? []).forEach((c) => {
      if (!selectedSalita || c.id_salita === selectedSalita) {
        patientEspMap.set(c.id_especialidad, c.especialidad || 'Especialidad');
      }
    });

    const filtered = baseList.filter(
      (esp) =>
        allowedIds === null ||
        allowedIds.has(esp.id_especialidad) ||
        patientEspMap.has(esp.id_especialidad)
    );

    patientEspMap.forEach((nombre, id_especialidad) => {
      if (!filtered.some((e) => e.id_especialidad === id_especialidad)) {
        filtered.push({ id_especialidad, nombre });
      }
    });

    const result = filtered.length > 0 ? filtered : baseList;
    return [...result].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [specialtiesList, clinicSettings, selectedSalita, context, dossier?.consultas]);

  const filteredConsultas = useMemo(() => {
    if (!dossier?.consultas) return [];
    if (!selectedEspecialidad) return dossier.consultas;
    return dossier.consultas.filter((c) => c.id_especialidad === selectedEspecialidad);
  }, [dossier?.consultas, selectedEspecialidad]);

  const antecedentesPersonales = useMemo(
    () => (dossier?.antecedentes ?? []).filter((a) => a.tipo !== 'FAMILIAR'),
    [dossier]
  );

  const antecedentesFamiliares = useMemo(
    () => (dossier?.antecedentes ?? []).filter((a) => a.tipo === 'FAMILIAR'),
    [dossier]
  );

  const allDiagnosticos = useMemo(
    () =>
      filteredConsultas.flatMap((c) =>
        c.diagnosticos.map((d) => ({ ...d, fecha_atencion: c.fecha_atencion, salita: c.salita }))
      ),
    [filteredConsultas]
  );

  const allEvoluciones = useMemo(
    () =>
      filteredConsultas
        .flatMap((c) =>
          c.evoluciones.map((ev) => ({
            ...ev,
            consulta_estado: c.estado,
            consulta_motivo: c.motivo_consulta,
          }))
        )
        .sort(
          (a, b) =>
            Date.parse(b.fecha_evolucion) - Date.parse(a.fecha_evolucion) ||
            b.version - a.version
        ),
    [filteredConsultas]
  );

  const allTratamientos = useMemo(
    () =>
      filteredConsultas.flatMap((c) =>
        c.tratamientos.map((t) => ({ ...t, consulta_motivo: c.motivo_consulta }))
      ),
    [filteredConsultas]
  );

  const allEstudios = useMemo(
    () =>
      filteredConsultas.flatMap((c) =>
        c.estudios.map((es) => ({ ...es, consulta_motivo: c.motivo_consulta }))
      ),
    [filteredConsultas]
  );

  const activeAlergias = useMemo(
    () => (dossier?.alergias ?? []).filter((al) => al.estado === 'ACTIVA'),
    [dossier]
  );

  const handleConfirmSign = async () => {
    if (!signTarget || !selectedSalita || actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      const signed = await firmarConsultaMedica(signTarget.id_consulta, {
        id_salita: selectedSalita,
        id_paciente: signTarget.id_paciente,
      });
      if (signed?.estado && signed.estado !== 'FIRMADA') {
        setError('No se pudo completar la firma de la consulta; el registro continúa en borrador.');
        return;
      }
      setNotice(formatSignedConsultaNotice(Boolean(signed?.turno_actualizado)));
      setSignTarget(null);
      await fetchDossier(selectedSalita, selectedEspecialidad);
    } catch (err) {
      const parsed = extractClinicalApiError(err);
      setError(parsed.message);
      if (parsed.status === 409) {
        setSignTarget(null);
        await fetchDossier(selectedSalita, selectedEspecialidad);
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancelDraft = async () => {
    if (!cancelTarget || !selectedSalita) return;
    if (motivoAnulacion.trim().length < 3) {
      setError('Ingresá el motivo de anulación del borrador.');
      return;
    }

    setActionBusy(true);
    setError(null);
    try {
      await anularConsultaBorrador(cancelTarget.id_consulta, {
        id_salita: selectedSalita,
        id_paciente: cancelTarget.id_paciente,
        motivo_anulacion: motivoAnulacion.trim(),
      });
      setNotice('Borrador anulado correctamente.');
      setCancelTarget(null);
      setMotivoAnulacion('');
      await fetchDossier(selectedSalita, selectedEspecialidad);
    } catch (err) {
      setError(extractClinicalApiError(err).message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleSalitaChange = (nextSalita: string) => {
    setSelectedSalita(nextSalita);
    setSelectedEspecialidad('');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextSalita) next.set('salita', nextSalita);
      else next.delete('salita');
      return next;
    });
    if (nextSalita) {
      void fetchDossier(nextSalita);
    }
  };

  const handleEspecialidadChange = (nextEsp: string) => {
    setSelectedEspecialidad(nextEsp);
    if (selectedSalita) {
      void fetchDossier(selectedSalita, nextEsp);
    }
  };

  const patientFullName = dossier
    ? `${dossier.paciente.apellidos}, ${dossier.paciente.nombres}`
    : 'Historia Clínica';

  const currentDossierUrl = `/historia-clinica/pacientes/${idPaciente}${
    selectedSalita ? `?salita=${encodeURIComponent(selectedSalita)}` : ''
  }`;

  const childNavState: ClinicalNavState = {
    ...(navState ?? { origin: 'buscador', returnTo: '/historia-clinica', returnLabel: 'Volver al buscador' }),
    dossierReturnTo: currentDossierUrl,
    ...(dossier
      ? {
          patientSummary: {
            id_paciente: dossier.paciente.id_paciente,
            dni: dossier.paciente.dni,
            nombres: dossier.paciente.nombres,
            apellidos: dossier.paciente.apellidos,
          },
        }
      : {}),
  };

  const fallbackBuscadorUrl = selectedSalita
    ? `/historia-clinica?salita=${encodeURIComponent(selectedSalita)}`
    : '/historia-clinica';

  const primaryBack = resolvePrimaryBackTarget(navState, fallbackBuscadorUrl);

  const newConsultaUrl = `/historia-clinica/pacientes/${idPaciente}/nueva-consulta${
    selectedSalita ? `?salita=${encodeURIComponent(selectedSalita)}` : ''
  }`;

  return (
    <div className="hc-page">
      <div className="hc-hero">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
              <span className="badge text-bg-success-subtle text-success border border-success-subtle">
                <i className="bi bi-journal-medical me-1" />
                Historia Clínica
              </span>
              {dossier && (
                !dossier.historia_clinica && dossier.consultas.length === 0 ? (
                  <span className="badge text-bg-light text-secondary border">
                    Sin consultas registradas
                  </span>
                ) : (
                  <span className="badge text-bg-light text-success border border-success-subtle">
                    Historia clínica activa
                  </span>
                )
              )}
              {dossier && dossier.consultas.some((c) => c.estado === 'BORRADOR') && (
                <span className="badge text-bg-warning-subtle text-warning-emphasis border">
                  Consulta pendiente de firma
                </span>
              )}
            </div>
            <h1 className="h3 mb-1">{patientFullName}</h1>
            {dossier && (
              <div className="small text-muted">
                DNI <strong>{dossier.paciente.dni}</strong> ·{' '}
                {calculateAgeLabel(dossier.paciente.fecha_nacimiento)} (
                {formatArgentinaDate(dossier.paciente.fecha_nacimiento)})
                {dossier.paciente.sexo ? ` · Sexo: ${dossier.paciente.sexo}` : ''}
              </div>
            )}
          </div>

          <div className="hc-hero-actions no-print">
            <Link to={primaryBack.to} className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-arrow-left me-1" />
              {primaryBack.label}
            </Link>
            {navState?.origin === 'mi-agenda' && !primaryBack.to.startsWith('/mi-agenda') && (
              <Link to="/mi-agenda" className="btn btn-outline-secondary btn-sm">
                <i className="bi bi-calendar2-check me-1" />
                Mi agenda
              </Link>
            )}
            {navState?.origin && navState.origin !== 'buscador' && (
              <Link to="/historia-clinica" className="btn btn-outline-secondary btn-sm">
                <i className="bi bi-search me-1" />
                Buscador HC
              </Link>
            )}
            {canCreateConsulta && dossier && idPaciente && selectedSalita && (
              <Link to={newConsultaUrl} state={childNavState} className="btn btn-success btn-sm">
                <i className="bi bi-plus-circle me-1" />
                Nueva consulta
              </Link>
            )}
            {canCreateDerivacion && dossier && idPaciente && (
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => setDerivacionModal({ mode: 'create' })}
              >
                <i className="bi bi-arrow-left-right me-1" />
                Derivar / Autorizar
              </button>
            )}
            {dossier && selectedSalita && (
              <button
                type="button"
                className="btn btn-outline-dark btn-sm"
                onClick={() => setExportModalOpen(true)}
              >
                <i className="bi bi-printer me-1" />
                Exportar / Imprimir
              </button>
            )}
          </div>
        </div>

        {dossier && (
          <div className="hc-patient-meta">
            <div>
              <span className="hc-meta-label">Salita asignada</span>
              <span className="hc-meta-value">
                {findSalitaNombre(
                  context?.catalogo_salitas ?? [],
                  dossier.paciente.id_salita_asignada
                )}
              </span>
            </div>
            <div>
              <span className="hc-meta-label">Obra social</span>
              <span className="hc-meta-value">
                {dossier.contenido_restringido_por_alcance
                  ? 'Restringida por alcance'
                  : dossier.paciente.obra_social || 'Sin cobertura declarada'}
              </span>
            </div>
            <div>
              <span className="hc-meta-label">Última actualización</span>
              <span className="hc-meta-value">
                {dossier.historia_clinica
                  ? formatArgentinaDateTime(dossier.historia_clinica.fecha_actualizacion)
                  : 'Sin registros aún'}
              </span>
            </div>
            <div>
              <span className="hc-meta-label">Consultas visibles</span>
              <span className="hc-meta-value">{filteredConsultas.length}</span>
            </div>
          </div>
        )}

        <div className="row g-3 mt-3 pt-3 border-top no-print">
          <div className="col-12 col-md-6">
            <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="dossier-salita">
              Salita de consulta
            </label>
            <select
              id="dossier-salita"
              className="form-select text-truncate"
              style={{ minHeight: '40px', height: '40px' }}
              value={selectedSalita}
              onChange={(e) => handleSalitaChange(e.target.value)}
            >
              {context?.salitas_autorizadas.map((s) => (
                <option key={s.id_salita} value={s.id_salita} title={s.nombre}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-6">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label className="form-label small fw-semibold text-secondary mb-0" htmlFor="dossier-esp">
                Especialidad
              </label>
              {selectedEspecialidad && (
                <button
                  type="button"
                  className="btn btn-link p-0 text-success text-decoration-none small"
                  style={{ fontSize: '0.8rem' }}
                  onClick={() => handleEspecialidadChange('')}
                >
                  <i className="bi bi-x me-1" />
                  Ver todas
                </button>
              )}
            </div>
            <select
              id="dossier-esp"
              className="form-select text-truncate"
              style={{ minHeight: '40px', height: '40px' }}
              value={selectedEspecialidad}
              disabled={loading || loadingEspecialidades}
              onChange={(e) => handleEspecialidadChange(e.target.value)}
            >
              <option value="">
                {availableEspecialidades.length === 0
                  ? 'Sin especialidades registradas'
                  : 'Todas las especialidades'}
              </option>
              {availableEspecialidades.map((esp) => (
                <option key={esp.id_especialidad} value={esp.id_especialidad} title={esp.nombre}>
                  {esp.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {notice && (
        <FloatingFeedbackToast
          variant="success"
          message={notice}
          actionLabel={
            navState?.createdConsultaId && selectedSalita
              ? navState.createdConsultaEstado === 'BORRADOR'
                ? 'Revisar borrador'
                : 'Ver consulta'
              : undefined
          }
          onAction={
            navState?.createdConsultaId && selectedSalita
              ? () => {
                  const target = `/historia-clinica/consultas/${navState.createdConsultaId}?salita=${encodeURIComponent(selectedSalita)}${
                    idPaciente ? `&paciente=${encodeURIComponent(idPaciente)}` : ''
                  }`;
                  setNotice(null);
                  navigate(target, { state: childNavState });
                }
              : undefined
          }
          onDismiss={() => setNotice(null)}
        />
      )}

      {error && (errorStatus === 403 || !dossier) && (
        <div className="alert alert-danger mb-0" role="alert">
          <div className="d-flex flex-column gap-2">
            <div>
              <i className="bi bi-shield-exclamation me-2" />
              <strong>{error}</strong>
            </div>
            {errorStatus === 403 && (
              <div className="small">
                Este paciente pertenece a otra salita asignada o requiere seleccionar una especialidad/derivación vigente para acceder desde{' '}
                <strong>{findSalitaNombre(context?.catalogo_salitas ?? [], selectedSalita)}</strong>.
                Un turno registrado en esta salita no habilita automáticamente la historia clínica longitudinal sin una derivación o autorización vigente.
              </div>
            )}
            {errorStatus === 403 && canDerivaciones && idPaciente && (
              <div className="d-flex flex-wrap gap-2 mt-1">
                <Link
                  to={`/historia-clinica/derivaciones?paciente=${encodeURIComponent(idPaciente)}${
                    selectedSalita ? `&salita=${encodeURIComponent(selectedSalita)}` : ''
                  }`}
                  state={childNavState}
                  className="btn btn-sm btn-outline-danger"
                >
                  <i className="bi bi-arrow-left-right me-1" />
                  Ver / solicitar derivación clínica
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {error && dossier && errorStatus !== 403 && (
        <FloatingFeedbackToast
          variant="error"
          message={error}
          onDismiss={() => {
            setError(null);
            setErrorStatus(null);
          }}
        />
      )}

      {dossier?.contenido_restringido_por_alcance && (
        <div className="alert alert-info mb-0" role="alert">
          <i className="bi bi-info-circle me-2" />
          Acceso por derivación vigente. Solo se muestran los registros correspondientes a esta derivación.
        </div>
      )}

      {activeAlergias.length > 0 && (
        <div className="alert alert-danger mb-0" role="alert">
          <div className="fw-bold mb-1">
            <i className="bi bi-exclamation-triangle-fill me-2" />
            Alertas de alergias activas ({activeAlergias.length})
          </div>
          <div className="d-flex flex-wrap gap-2">
            {activeAlergias.map((al) => (
              <span key={al.id_alergia} className="badge text-bg-light text-danger border border-danger">
                {al.alergeno} ({al.gravedad}) — {al.tipo_reaccion}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="hc-card py-4 px-3 text-center text-muted small" role="status">
          <div className="spinner-border spinner-border-sm text-success me-2" aria-hidden="true" />
          <span>Cargando historia clínica auditada...</span>
        </div>
      ) : !dossier ? null : !dossier.historia_clinica && dossier.consultas.length === 0 ? (
        <div className="hc-empty-state">
          <i className="bi bi-journal-medical fs-2 text-success d-block mb-2" />
          <h4 className="h5 mb-1">Todavía no hay consultas registradas</h4>
          <p className="small mb-3">
            Registrá la primera consulta médica para iniciar el historial clínico del paciente.
          </p>
          {canCreateConsulta && idPaciente && selectedSalita && (
            <Link to={newConsultaUrl} state={childNavState} className="btn btn-success btn-sm">
              <i className="bi bi-plus-circle me-1" />
              Registrar primera consulta
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="hc-tabs no-print" role="tablist">
            {[
              { key: 'resumen', label: 'Resumen clínico', count: filteredConsultas.length },
              {
                key: 'antecedentes_personales',
                label: 'Antecedentes personales',
                count: antecedentesPersonales.length,
              },
              {
                key: 'antecedentes_familiares',
                label: 'Antecedentes familiares',
                count: antecedentesFamiliares.length,
              },
              { key: 'alergias', label: 'Alergias', count: dossier.alergias.length },
              { key: 'consultas', label: 'Consultas médicas', count: filteredConsultas.length },
              { key: 'diagnosticos', label: 'Diagnósticos', count: allDiagnosticos.length },
              { key: 'evoluciones', label: 'Evoluciones', count: allEvoluciones.length },
              {
                key: 'tratamientos',
                label: 'Tratamientos y medicación',
                count: allTratamientos.length,
              },
              { key: 'estudios', label: 'Estudios', count: allEstudios.length },
              { key: 'derivaciones', label: 'Derivaciones', count: derivaciones.length },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`hc-tab-btn ${activeTab === tab.key ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab.key as DossierTab)}
              >
                <span>{tab.label}</span>
                <span className="badge rounded-pill text-bg-light text-dark">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {activeTab === 'resumen' && (
            <div className="hc-card p-3 p-md-4">
              <h2 className="h5 mb-3">Evolución cronológica</h2>
              {dossier.historia_clinica?.observaciones_generales && (
                <div className="alert alert-light border mb-3 small">
                  <strong>Observaciones generales:</strong>{' '}
                  {dossier.historia_clinica.observaciones_generales}
                </div>
              )}

              {filteredConsultas.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <i className="bi bi-funnel fs-3 d-block mb-2 text-secondary" />
                  <p className="mb-2">
                    {selectedEspecialidad
                      ? 'No hay consultas registradas para la especialidad seleccionada.'
                      : 'No hay consultas médicas registradas dentro del alcance actual.'}
                  </p>
                  {selectedEspecialidad && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success"
                      onClick={() => handleEspecialidadChange('')}
                    >
                      <i className="bi bi-x-circle me-1" />
                      Mostrar todas las especialidades
                    </button>
                  )}
                </div>
              ) : (
                <div className="hc-timeline">
                  {filteredConsultas.map((c) => (
                    <div
                      key={c.id_consulta}
                      className={`hc-timeline-item ${
                        c.estado === 'BORRADOR'
                          ? 'hc-timeline-item--draft'
                          : c.estado === 'ANULADA'
                            ? 'hc-timeline-item--cancelled'
                            : ''
                      }`}
                    >
                      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                        <div>
                          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                            <span className={consultaEstadoBadgeClass(c.estado)}>
                              {c.estado}
                            </span>
                            <strong>{c.motivo_consulta}</strong>
                          </div>
                          <div className="small text-muted">
                            {formatArgentinaDateTime(c.fecha_atencion)} · {c.especialidad || 'Especialidad'} ·{' '}
                            {c.salita || 'Salita'} · Prof.: {c.profesional || 'Profesional'}
                          </div>
                        </div>

                        <Link
                          to={`/historia-clinica/consultas/${c.id_consulta}?salita=${encodeURIComponent(c.id_salita)}&paciente=${encodeURIComponent(c.id_paciente)}`}
                          state={childNavState}
                          className="btn btn-sm btn-outline-success no-print"
                        >
                          Ver consulta
                        </Link>
                      </div>

                      {c.sintomas && (
                        <p className="small mb-1">
                          <strong>Anamnesis:</strong> {c.sintomas}
                        </p>
                      )}
                      {c.diagnosticos.length > 0 && (
                        <div className="small mb-1">
                          <strong>Diagnósticos:</strong>{' '}
                          {c.diagnosticos.map((d) => d.descripcion).join('; ')}
                        </div>
                      )}
                      <div className="small text-muted">
                        Evoluciones: {c.evoluciones.length} | Tratamientos: {c.tratamientos.length} | Estudios:{' '}
                        {c.estudios.length}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'antecedentes_personales' && (
            <div className="hc-card p-3 p-md-4">
              <h2 className="h5 mb-3">Antecedentes personales</h2>
              {antecedentesPersonales.length === 0 ? (
                <p className="text-muted mb-0">Sin antecedentes personales registrados.</p>
              ) : (
                <>
                  <div className="hc-mobile-list d-md-none">
                    {antecedentesPersonales.map((a) => (
                      <article key={a.id_antecedente} className="hc-mobile-item small">
                        <div className="hc-mobile-item-head">
                          <span className="badge text-bg-light border">{a.tipo}</span>
                          <span className="badge text-bg-secondary">{a.estado}</span>
                        </div>
                        <div className="fw-medium">{a.descripcion}</div>
                        <div className="text-muted">
                          {a.categoria ? `${a.categoria} · ` : ''}
                          {formatArgentinaDate(a.fecha_antecedente)}
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="table-responsive d-none d-md-block">
                    <table className="table align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Tipo</th>
                          <th>Categoría</th>
                          <th>Descripción</th>
                          <th>Fecha</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {antecedentesPersonales.map((a) => (
                          <tr key={a.id_antecedente}>
                            <td><span className="badge text-bg-light border">{a.tipo}</span></td>
                            <td>{a.categoria || '—'}</td>
                            <td>{a.descripcion}</td>
                            <td>{formatArgentinaDate(a.fecha_antecedente)}</td>
                            <td><span className="badge text-bg-secondary">{a.estado}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'antecedentes_familiares' && (
            <div className="hc-card p-3 p-md-4">
              <h2 className="h5 mb-3">Antecedentes familiares</h2>
              {antecedentesFamiliares.length === 0 ? (
                <p className="text-muted mb-0">Sin antecedentes familiares registrados.</p>
              ) : (
                <>
                  <div className="hc-mobile-list d-md-none">
                    {antecedentesFamiliares.map((a) => (
                      <article key={a.id_antecedente} className="hc-mobile-item small">
                        <div className="hc-mobile-item-head">
                          <strong>{a.categoria || 'Antecedente familiar'}</strong>
                          <span className="badge text-bg-secondary">{a.estado}</span>
                        </div>
                        <div>{a.descripcion}</div>
                        <div className="text-muted">{formatArgentinaDate(a.fecha_antecedente)}</div>
                      </article>
                    ))}
                  </div>
                  <div className="table-responsive d-none d-md-block">
                    <table className="table align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Categoría</th>
                          <th>Descripción</th>
                          <th>Fecha</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {antecedentesFamiliares.map((a) => (
                          <tr key={a.id_antecedente}>
                            <td>{a.categoria || '—'}</td>
                            <td>{a.descripcion}</td>
                            <td>{formatArgentinaDate(a.fecha_antecedente)}</td>
                            <td><span className="badge text-bg-secondary">{a.estado}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'alergias' && (
            <div className="hc-card p-3 p-md-4">
              <h2 className="h5 mb-3">Alergias registradas</h2>
              {dossier.alergias.length === 0 ? (
                <p className="text-muted mb-0">No se registran alergias para este paciente.</p>
              ) : (
                <>
                  <div className="hc-mobile-list d-md-none">
                    {dossier.alergias.map((al) => (
                      <article key={al.id_alergia} className="hc-mobile-item small">
                        <div className="hc-mobile-item-head">
                          <span className="hc-mobile-item-title">{al.alergeno}</span>
                          <span className={alergiaGravedadBadgeClass(al.gravedad)}>
                            {al.gravedad}
                          </span>
                        </div>
                        <div>{al.tipo_reaccion}</div>
                        <div className="text-muted">
                          Estado: {al.estado} · Detección: {formatArgentinaDate(al.fecha_deteccion)}
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="table-responsive d-none d-md-block">
                    <table className="table align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Alérgeno</th>
                          <th>Tipo de reacción</th>
                          <th>Gravedad</th>
                          <th>Detección</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dossier.alergias.map((al) => (
                          <tr key={al.id_alergia}>
                            <td className="fw-semibold">{al.alergeno}</td>
                            <td>
                              <div>{al.tipo_reaccion}</div>
                              {al.observaciones && (
                                <div className="small text-muted">{al.observaciones}</div>
                              )}
                            </td>
                            <td>
                              <span className={alergiaGravedadBadgeClass(al.gravedad)}>
                                {al.gravedad}
                              </span>
                            </td>
                            <td>{formatArgentinaDate(al.fecha_deteccion)}</td>
                            <td><span className="badge text-bg-light border">{al.estado}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'consultas' && (
            <div className="hc-card p-3 p-md-4">
              <h2 className="h5 mb-3">Consultas médicas y firma</h2>
              {filteredConsultas.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <i className="bi bi-funnel fs-3 d-block mb-2 text-secondary" />
                  <p className="mb-2">
                    {selectedEspecialidad
                      ? 'No hay consultas registradas para la especialidad seleccionada.'
                      : 'Sin consultas médicas registradas.'}
                  </p>
                  {selectedEspecialidad && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success"
                      onClick={() => handleEspecialidadChange('')}
                    >
                      <i className="bi bi-x-circle me-1" />
                      Mostrar todas las especialidades
                    </button>
                  )}
                </div>
              ) : (
                <div className="d-grid gap-3">
                  {filteredConsultas.map((c) => {
                    const isOwnDraft =
                      c.estado === 'BORRADOR' &&
                      context?.id_profesional === c.id_profesional_autor;

                    return (
                      <div key={c.id_consulta} className="border rounded p-3">
                        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                          <div>
                            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                              <span className={consultaEstadoBadgeClass(c.estado)}>
                                {c.estado}
                              </span>
                              <h3 className="h6 mb-0">{c.motivo_consulta}</h3>
                            </div>
                            <div className="small text-muted">
                              {formatArgentinaDateTime(c.fecha_atencion)} · {c.especialidad} · {c.salita} ·{' '}
                              {c.profesional}
                            </div>
                          </div>

                          <div className="d-flex flex-wrap gap-2 no-print">
                            <Link
                              to={`/historia-clinica/consultas/${c.id_consulta}?salita=${encodeURIComponent(c.id_salita)}&paciente=${encodeURIComponent(c.id_paciente)}`}
                              state={childNavState}
                              className="btn btn-sm btn-outline-primary"
                            >
                              Abrir detalle
                            </Link>
                            {canCreateConsulta && isOwnDraft && (
                              <>
                                <Link
                                  to={`/historia-clinica/consultas/${c.id_consulta}/editar?salita=${encodeURIComponent(c.id_salita)}&paciente=${encodeURIComponent(c.id_paciente)}`}
                                  state={childNavState}
                                  className="btn btn-sm btn-outline-secondary"
                                >
                                  Continuar editando
                                </Link>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-success"
                                  onClick={() => setSignTarget(c)}
                                >
                                  Firmar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => setCancelTarget(c)}
                                >
                                  Anular borrador
                                </button>
                              </>
                            )}
                            {canEvoluciones && c.estado === 'FIRMADA' && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success"
                                onClick={() =>
                                  setEvolucionModal({
                                    mode: 'create',
                                    idConsulta: c.id_consulta,
                                  })
                                }
                              >
                                + Evolución
                              </button>
                            )}
                          </div>
                        </div>

                        {c.estado === 'FIRMADA' && (
                          <div className="small text-success">
                            <i className="bi bi-lock-fill me-1" />
                            Firmada el {formatArgentinaDateTime(c.firmada_en)} (inmutable)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'diagnosticos' && (
            <div className="hc-card p-3 p-md-4">
              <h2 className="h5 mb-3">Diagnósticos registrados</h2>
              {allDiagnosticos.length === 0 ? (
                <p className="text-muted mb-0">Sin diagnósticos registrados.</p>
              ) : (
                <>
                  <div className="hc-mobile-list d-md-none">
                    {allDiagnosticos.map((d) => (
                      <article key={d.id_diagnostico} className="hc-mobile-item small">
                        <div className="hc-mobile-item-head">
                          <span className="hc-mobile-item-title">{d.descripcion}</span>
                          <span className="badge text-bg-light border">{d.estado}</span>
                        </div>
                        <div className="text-muted">
                          {d.codigo ? `CIE: ${d.codigo} · ` : ''}
                          {d.tipo} · {formatArgentinaDate(d.fecha_diagnostico)}
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="table-responsive d-none d-md-block">
                    <table className="table align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Código</th>
                          <th>Descripción</th>
                          <th>Tipo</th>
                          <th>Fecha</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allDiagnosticos.map((d) => (
                          <tr key={d.id_diagnostico}>
                            <td><code>{d.codigo || '—'}</code></td>
                            <td>
                              <div className="fw-medium">{d.descripcion}</div>
                              {d.observaciones && (
                                <div className="small text-muted">{d.observaciones}</div>
                              )}
                            </td>
                            <td>{d.tipo}</td>
                            <td>{formatArgentinaDate(d.fecha_diagnostico)}</td>
                            <td><span className="badge text-bg-light border">{d.estado}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'evoluciones' && (
            <div className="hc-card p-3 p-md-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <h2 className="h5 mb-0">Evoluciones y rectificaciones</h2>
                {canEvoluciones && dossier.consultas.some((c) => c.estado === 'FIRMADA') && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary no-print"
                    onClick={() => {
                      const signed = dossier.consultas.find((c) => c.estado === 'FIRMADA');
                      if (signed) {
                        setEvolucionModal({
                          mode: 'create',
                          idConsulta: signed.id_consulta,
                        });
                      }
                    }}
                  >
                    <i className="bi bi-plus-circle me-1" />
                    Nueva evolución en última consulta firmada
                  </button>
                )}
              </div>

              {allEvoluciones.length === 0 ? (
                <p className="text-muted mb-0">Sin evoluciones registradas.</p>
              ) : (
                <div className="d-grid gap-3">
                  {allEvoluciones.map((ev) => (
                    <div key={ev.id_evolucion} className="border rounded p-3">
                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          <span className={evolucionEstadoBadgeClass(ev.estado)}>
                            {ev.estado}
                          </span>
                          <span className="badge text-bg-light border">v{ev.version}</span>
                          <span className="small text-muted">
                            Consulta: {ev.consulta_motivo}
                          </span>
                        </div>
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          <span className="small text-muted">
                            {formatArgentinaDateTime(ev.fecha_evolucion)}
                          </span>
                          {canEvoluciones &&
                            ev.consulta_estado === 'FIRMADA' &&
                            ev.estado === 'FIRMADA' && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary no-print"
                                onClick={() =>
                                  setEvolucionModal({
                                    mode: 'rectify',
                                    idConsulta: ev.id_consulta,
                                    target: ev,
                                  })
                                }
                              >
                                Rectificar
                              </button>
                            )}
                        </div>
                      </div>

                      {ev.es_correccion && (
                        <div className="hc-rectification-box mb-2 small">
                          <strong>Rectificación de evolución previa</strong>
                          {ev.motivo_correccion && (
                            <div>Motivo: {ev.motivo_correccion}</div>
                          )}
                        </div>
                      )}

                      <p className="mb-1">{ev.evolucion}</p>
                      <div className="small text-muted">
                        Profesional:{' '}
                        {findProfesionalNombre(
                          context?.catalogo_profesionales ?? [],
                          ev.id_profesional_responsable
                        )}
                        {ev.observaciones ? ` · Obs.: ${ev.observaciones}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'tratamientos' && (
            <div className="hc-card p-3 p-md-4">
              <h2 className="h5 mb-3">Tratamientos y medicación</h2>
              {allTratamientos.length === 0 ? (
                <p className="text-muted mb-0">Sin tratamientos registrados.</p>
              ) : (
                <>
                  <div className="hc-mobile-list d-md-none">
                    {allTratamientos.map((t) => (
                      <article key={t.id_tratamiento} className="hc-mobile-item small">
                        <div className="hc-mobile-item-head">
                          <span className="hc-mobile-item-title">{t.medicacion}</span>
                          <span className="badge text-bg-light border">{t.estado}</span>
                        </div>
                        <div>
                          {t.dosis} · {t.frecuencia}
                        </div>
                        <div className="text-muted">
                          Desde: {formatArgentinaDate(t.fecha_inicio)}
                          {t.duracion ? ` · ${t.duracion}` : ''}
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="table-responsive d-none d-md-block">
                    <table className="table align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Medicación</th>
                          <th>Dosis / Frecuencia</th>
                          <th>Duración / Indicaciones</th>
                          <th>Inicio / Fin</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allTratamientos.map((t) => (
                          <tr key={t.id_tratamiento}>
                            <td className="fw-semibold">{t.medicacion}</td>
                            <td>
                              {t.dosis} · {t.frecuencia}
                            </td>
                            <td>
                              <div>{t.duracion || '—'}</div>
                              {t.indicaciones && (
                                <div className="small text-muted">{t.indicaciones}</div>
                              )}
                            </td>
                            <td className="small">
                              <div>Desde: {formatArgentinaDate(t.fecha_inicio)}</div>
                              {t.fecha_fin && (
                                <div>Hasta: {formatArgentinaDate(t.fecha_fin)}</div>
                              )}
                            </td>
                            <td><span className="badge text-bg-light border">{t.estado}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'estudios' && (
            <div className="hc-card p-3 p-md-4">
              <h2 className="h5 mb-3">Estudios clínicos</h2>
              {allEstudios.length === 0 ? (
                <p className="text-muted mb-0">Sin estudios solicitados.</p>
              ) : (
                <>
                  <div className="hc-mobile-list d-md-none">
                    {allEstudios.map((es) => (
                      <article key={es.id_estudio} className="hc-mobile-item small">
                        <div className="hc-mobile-item-head">
                          <span className="hc-mobile-item-title">{es.tipo_estudio}</span>
                          <span className={estudioEstadoBadgeClass(es.estado)}>{es.estado}</span>
                        </div>
                        <div>{es.descripcion}</div>
                        <div className="text-muted">
                          {es.resultado ? `Resultado: ${es.resultado}` : 'Pendiente de informe'}
                        </div>
                        {canEstudios &&
                          (es.estado === 'SOLICITADO' || es.estado === 'EN_PROCESO') && (
                            <div className="hc-mobile-item-actions no-print">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => setEstudioModal({ mode: 'status', estudio: es })}
                              >
                                Estado
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success"
                                onClick={() => setEstudioModal({ mode: 'inform', estudio: es })}
                              >
                                Informar
                              </button>
                            </div>
                          )}
                      </article>
                    ))}
                  </div>
                  <div className="table-responsive d-none d-md-block">
                    <table className="table align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Tipo y descripción</th>
                          <th>Solicitud</th>
                          <th>Estado</th>
                          <th>Resultado e informe</th>
                          <th className="text-end no-print">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allEstudios.map((es) => (
                          <tr key={es.id_estudio}>
                            <td>
                              <div className="fw-semibold">{es.tipo_estudio}</div>
                              <div className="small text-muted">{es.descripcion}</div>
                            </td>
                            <td className="small">
                              <div>{formatArgentinaDateTime(es.fecha_solicitud)}</div>
                              <div className="text-muted">
                                Sol.:{' '}
                                {findProfesionalNombre(
                                  context?.catalogo_profesionales ?? [],
                                  es.id_profesional_solicitante
                                )}
                              </div>
                            </td>
                            <td>
                              <span className={estudioEstadoBadgeClass(es.estado)}>
                                {es.estado}
                              </span>
                            </td>
                            <td className="small">
                              {es.resultado ? (
                                <>
                                  <div>{es.resultado}</div>
                                  <div className="text-muted">
                                    {formatArgentinaDateTime(es.fecha_resultado)} —{' '}
                                    {findProfesionalNombre(
                                      context?.catalogo_profesionales ?? [],
                                      es.id_profesional_informa
                                    )}
                                  </div>
                                </>
                              ) : (
                                'Pendiente de informe'
                              )}
                            </td>
                            <td className="text-end no-print">
                              {canEstudios &&
                                (es.estado === 'SOLICITADO' || es.estado === 'EN_PROCESO') && (
                                  <div className="d-inline-flex gap-2">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-secondary"
                                      onClick={() =>
                                        setEstudioModal({ mode: 'status', estudio: es })
                                      }
                                    >
                                      Estado
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-success"
                                      onClick={() =>
                                        setEstudioModal({ mode: 'inform', estudio: es })
                                      }
                                    >
                                      Informar
                                    </button>
                                  </div>
                                )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'derivaciones' && (
            <div className="hc-card p-3 p-md-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <h2 className="h5 mb-0">Derivaciones y autorizaciones del paciente</h2>
                {canCreateDerivacion && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary no-print"
                    onClick={() => setDerivacionModal({ mode: 'create' })}
                  >
                    <i className="bi bi-plus-circle me-1" />
                    Solicitar derivación
                  </button>
                )}
              </div>

              {derivaciones.length === 0 ? (
                <p className="text-muted mb-0">
                  No se registran derivaciones ni autorizaciones para este paciente en la salita actual.
                </p>
              ) : (
                <>
                  <div className="hc-mobile-list d-md-none">
                    {derivaciones.map((d) => (
                      <article key={d.id_derivacion} className="hc-mobile-item small">
                        <div className="hc-mobile-item-head">
                          <span className="hc-mobile-item-title">
                            {d.tipo} ({d.alcance})
                          </span>
                          <span className={derivacionEstadoBadgeClass(d.estado)}>{d.estado}</span>
                        </div>
                        <div>
                          {findSalitaNombre(context?.catalogo_salitas ?? [], d.id_salita_origen)}
                          {' → '}
                          {findSalitaNombre(context?.catalogo_salitas ?? [], d.id_salita_destino)}
                        </div>
                        <div className="text-muted">{d.motivo}</div>
                        <div className="text-muted">
                          {formatArgentinaDate(d.fecha_desde)} al {formatArgentinaDate(d.fecha_hasta)}
                        </div>
                        {canDerivaciones &&
                          (d.estado === 'PENDIENTE' || d.estado === 'AUTORIZADA') && (
                            <div className="hc-mobile-item-actions no-print">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() =>
                                  setDerivacionModal({ mode: 'resolve', target: d })
                                }
                              >
                                {d.estado === 'PENDIENTE' ? 'Resolver' : 'Revocar'}
                              </button>
                            </div>
                          )}
                      </article>
                    ))}
                  </div>
                  <div className="table-responsive d-none d-md-block">
                    <table className="table align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Tipo / Alcance</th>
                          <th>Origen → Destino</th>
                          <th>Motivo</th>
                          <th>Vigencia</th>
                          <th>Estado</th>
                          <th className="text-end no-print">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {derivaciones.map((d) => (
                          <tr key={d.id_derivacion}>
                            <td>
                              <div className="fw-semibold">{d.tipo}</div>
                              <div className="small text-muted">{d.alcance}</div>
                            </td>
                            <td className="small">
                              {findSalitaNombre(context?.catalogo_salitas ?? [], d.id_salita_origen)}
                              {' → '}
                              {findSalitaNombre(context?.catalogo_salitas ?? [], d.id_salita_destino)}
                            </td>
                            <td className="small">{d.motivo}</td>
                            <td className="small">
                              {formatArgentinaDate(d.fecha_desde)} al{' '}
                              {formatArgentinaDate(d.fecha_hasta)}
                            </td>
                            <td>
                              <span className={derivacionEstadoBadgeClass(d.estado)}>
                                {d.estado}
                              </span>
                            </td>
                            <td className="text-end no-print">
                              {canDerivaciones &&
                                (d.estado === 'PENDIENTE' || d.estado === 'AUTORIZADA') && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() =>
                                      setDerivacionModal({ mode: 'resolve', target: d })
                                    }
                                  >
                                    {d.estado === 'PENDIENTE' ? 'Resolver' : 'Revocar'}
                                  </button>
                                )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      <ConfirmationModal
        open={Boolean(signTarget)}
        title="Firmar consulta médica"
        subtitle="Esta acción vuelve definitivo e inmutable el registro clínico."
        message={
          signTarget
            ? `¿Confirmás la firma de la consulta "${signTarget.motivo_consulta}"?`
            : ''
        }
        confirmText="Firmar consulta"
        variant="success"
        icon="bi-patch-check"
        loading={actionBusy}
        onClose={() => setSignTarget(null)}
        onConfirm={() => void handleConfirmSign()}
      />

      {cancelTarget && (
        <>
          <div className="modal-backdrop fade show no-print" style={{ zIndex: 1050 }} />
          <div
            className="modal d-block fade show no-print"
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
                    onClick={() => setCancelTarget(null)}
                  />
                </div>
                <div className="modal-body">
                  <label className="form-label fw-semibold" htmlFor="dos-motivo-anular">
                    Motivo de anulación *
                  </label>
                  <textarea
                    id="dos-motivo-anular"
                    className="form-control"
                    rows={3}
                    value={motivoAnulacion}
                    onChange={(e) => setMotivoAnulacion(e.target.value)}
                    placeholder="Motivo de la anulación..."
                  />
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={actionBusy}
                    onClick={() => setCancelTarget(null)}
                  >
                    Cancelar
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

      {evolucionModal && (
        <EvolucionModal
          open
          mode={evolucionModal.mode}
          idSalita={selectedSalita}
          idConsulta={evolucionModal.idConsulta}
          targetEvolucion={evolucionModal.target}
          onClose={() => setEvolucionModal(null)}
          onSaved={(msg) => {
            setNotice(msg);
            void fetchDossier(selectedSalita, selectedEspecialidad);
          }}
        />
      )}

      {estudioModal && (
        <EstudioModal
          open
          mode={estudioModal.mode}
          idSalita={selectedSalita}
          estudio={estudioModal.estudio}
          onClose={() => setEstudioModal(null)}
          onSaved={(msg) => {
            setNotice(msg);
            void fetchDossier(selectedSalita, selectedEspecialidad);
          }}
        />
      )}

      {derivacionModal && context && idPaciente && (
        <DerivacionModal
          open
          mode={derivacionModal.mode}
          context={context}
          idPaciente={idPaciente}
          patientLabel={patientFullName}
          defaultSalitaOrigen={selectedSalita}
          targetDerivacion={derivacionModal.target}
          activeSalitaForResolve={selectedSalita}
          onClose={() => setDerivacionModal(null)}
          onSaved={(msg) => {
            setNotice(msg);
            void fetchDossier(selectedSalita, selectedEspecialidad);
          }}
        />
      )}

      {dossier && idPaciente && selectedSalita && (
        <ExportarHistoriaModal
          open={exportModalOpen}
          idPaciente={idPaciente}
          idSalita={selectedSalita}
          idEspecialidad={selectedEspecialidad || undefined}
          patientName={patientFullName}
          onClose={() => setExportModalOpen(false)}
          onExported={(msg) => setNotice(msg)}
        />
      )}
    </div>
  );
}
