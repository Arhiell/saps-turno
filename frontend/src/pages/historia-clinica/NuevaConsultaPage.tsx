import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { ActionInlineFeedback } from '../../components/ui/FormFeedback';
import { useAuth } from '../../context/AuthContext';
import {
  actualizarConsultaBorrador,
  descartarBorradorTemporal,
  extractClinicalApiError,
  getConsultaMedicaById,
  getHistoriaClinicaContext,
  getHistoriaClinicaPaciente,
  guardarBorradorTemporal,
  obtenerBorradorTemporal,
  registrarConsultaClinica,
  searchClinicalPatients,
} from '../../services/historia-clinica.service';
import { getTurnoById, getTurnos } from '../../services/turnos.service';
import {
  CLINICAL_PERMISSIONS,
  type AlergiaGravedad,
  type AntecedenteTipo,
  type BorradorFormularioClinico,
  type ClinicalPatientSearchItem,
  type ConsultaMedicaDetalle,
  type DiagnosticoTipo,
  type HistoriaClinicaContextData,
} from '../../types/historia-clinica.types';
import type { Turno } from '../../types/turno.types';
import {
  formatArgentinaDate,
  formatArgentinaDateTime,
  formatSignedConsultaNotice,
  getNowArgentinaDateTimeLocal,
  getTodayArgentinaIsoDate,
  isoToArgentinaDateTimeLocal,
  toArgentinaOffsetIso,
} from '../../utils/historia-clinica-format';
import {
  buildConsultaSectionsForMode,
  resolveConsultaBlockViewMode,
  resolvePrimaryBackTarget,
  type ClinicalNavState,
  type ConsultaSectionKey,
} from '../../utils/historia-clinica-navigation';
import { focusFieldById } from '../../utils/form-feedback';
import {
  RECOVERABLE_ERROR_TIMEOUT_MS,
  useAutoDismiss,
} from '../../utils/useAutoDismiss';

interface DiagnosticoDraft {
  codigo: string;
  descripcion: string;
  tipo: DiagnosticoTipo;
  fecha_diagnostico: string;
  observaciones: string;
}

interface AntecedenteDraft {
  tipo: AntecedenteTipo;
  categoria: string;
  descripcion: string;
  fecha_antecedente: string;
}

interface AlergiaDraft {
  alergeno: string;
  tipo_reaccion: string;
  gravedad: AlergiaGravedad;
  fecha_deteccion: string;
  observaciones: string;
}

interface TratamientoDraft {
  medicacion: string;
  dosis: string;
  frecuencia: string;
  duracion: string;
  indicaciones: string;
  fecha_inicio: string;
  fecha_fin: string;
}

interface EstudioDraft {
  tipo_estudio: string;
  descripcion: string;
}

type SectionKey = ConsultaSectionKey;

interface AccordionBlockProps {
  stepNumber: number;
  title: string;
  subtitle: string;
  required?: boolean;
  badgeText?: string;
  blockError?: string | null;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function AccordionBlock({
  stepNumber,
  title,
  subtitle,
  required = false,
  badgeText,
  blockError,
  open,
  onToggle,
  children,
}: AccordionBlockProps) {
  return (
    <section
      className={`hc-accordion-card${open ? ' is-open' : ''}${
        blockError ? ' border-danger' : ''
      }`}
    >
      <button
        type="button"
        className="hc-accordion-toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span
            className={`badge rounded-pill ${
              blockError
                ? 'text-bg-danger'
                : 'text-bg-light text-secondary border'
            }`}
          >
            {stepNumber}
          </span>
          <div>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <strong className="text-dark">{title}</strong>
              {required && (
                <span className="badge text-bg-success-subtle text-success border border-success-subtle">
                  Obligatorio
                </span>
              )}
              {badgeText && (
                <span className="badge text-bg-primary">{badgeText}</span>
              )}
              {blockError && (
                <span className="badge text-bg-danger-subtle text-danger border border-danger-subtle">
                  Revisar error
                </span>
              )}
            </div>
            {subtitle && <div className="small text-muted">{subtitle}</div>}
          </div>
        </div>
        <i
          className={`bi ${open ? 'bi-chevron-up' : 'bi-chevron-down'} text-muted flex-shrink-0`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="hc-accordion-body">
          {blockError && (
            <div className="alert alert-danger py-2 px-3 small mb-3" role="alert">
              <i className="bi bi-exclamation-circle-fill me-2" aria-hidden="true" />
              {blockError}
            </div>
          )}
          {children}
        </div>
      )}
    </section>
  );
}

interface ResolvedPatientLabel {
  id_paciente: string;
  dni?: string;
  nombres: string;
  apellidos: string;
}

export default function NuevaConsultaPage() {
  const { idPaciente, idConsulta: routeIdConsulta } = useParams<{
    idPaciente?: string;
    idConsulta?: string;
  }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navState = (location.state as ClinicalNavState | null) ?? null;
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const canDiagnosticos = hasPermission(CLINICAL_PERMISSIONS.REGISTRAR_DIAGNOSTICOS);
  const canAntecedentes = hasPermission(
    CLINICAL_PERMISSIONS.GESTIONAR_ANTECEDENTES_CLINICOS
  );
  const canEvoluciones = hasPermission(CLINICAL_PERMISSIONS.REGISTRAR_EVOLUCIONES);
  const canTratamientos = hasPermission(CLINICAL_PERMISSIONS.GESTIONAR_TRATAMIENTOS);
  const canEstudios = hasPermission(CLINICAL_PERMISSIONS.GESTIONAR_ESTUDIOS_CLINICOS);

  const initialSalita = searchParams.get('salita') || '';
  const initialTurno = searchParams.get('turno') || '';
  const queryPaciente = searchParams.get('paciente') || '';
  const queryConsultaId = searchParams.get('consulta') || '';
  const effectiveRoutePatientId = idPaciente || queryPaciente;
  const initialConsultaId = routeIdConsulta || queryConsultaId || '';
  const today = getTodayArgentinaIsoDate();

  const [editingConsultaId, setEditingConsultaId] = useState<string | null>(
    initialConsultaId || null
  );
  const [readonlyImmutableConsulta, setReadonlyImmutableConsulta] = useState<{
    id: string;
    estado: string;
  } | null>(null);

  const [context, setContext] = useState<HistoriaClinicaContextData | null>(null);
  const [patients, setPatients] = useState<ClinicalPatientSearchItem[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [linkedTurno, setLinkedTurno] = useState<Turno | null>(null);
  const [resolvedPatient, setResolvedPatient] = useState<ResolvedPatientLabel | null>(
    navState?.patientSummary ?? null
  );
  const [turnoDiscrepancyError, setTurnoDiscrepancyError] = useState<string | null>(null);

  const [selectedPatientId, setSelectedPatientId] = useState(effectiveRoutePatientId);
  const [idSalita, setIdSalita] = useState(initialSalita);
  const [idEspecialidad, setIdEspecialidad] = useState('');
  const [idTurno, setIdTurno] = useState(initialTurno);
  const [fechaAtencion, setFechaAtencion] = useState(getNowArgentinaDateTimeLocal);

  const [motivoConsulta, setMotivoConsulta] = useState('');
  const [sintomas, setSintomas] = useState('');
  const [examenFisico, setExamenFisico] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [observacionesGenerales, setObservacionesGenerales] = useState('');

  const [diagnosticos, setDiagnosticos] = useState<DiagnosticoDraft[]>([]);
  const [antecedentes, setAntecedentes] = useState<AntecedenteDraft[]>([]);
  const [alergias, setAlergias] = useState<AlergiaDraft[]>([]);
  const [evolucionTexto, setEvolucionTexto] = useState('');
  const [evolucionObs, setEvolucionObs] = useState('');
  const [tratamientos, setTratamientos] = useState<TratamientoDraft[]>([]);
  const [estudios, setEstudios] = useState<EstudioDraft[]>([]);

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    datos: true,
    motivo: true,
    examen: false,
    diagnosticos: false,
    antecedentes: false,
    evolucion: false,
    tratamientos: false,
    estudios: false,
    observaciones: false,
  });

  const [loadingInit, setLoadingInit] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [confirmSignOpen, setConfirmSignOpen] = useState(false);
  const [pendingExit, setPendingExit] = useState<{ to: string; state?: ClinicalNavState | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorLocation, setErrorLocation] = useState<{
    blockKey?: SectionKey;
    blockLabel?: string;
    fieldId?: string;
  } | null>(null);
  const [errorCritical, setErrorCritical] = useState(false);
  const savedSuccessfullyRef = useRef(false);

  const [draftVersion, setDraftVersion] = useState(0);
  const draftVersionRef = useRef(0);
  const [remoteAutosaveAvailable, setRemoteAutosaveAvailable] = useState(true);
  const [autosaveStatus, setAutosaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'recovered' | 'conflict'
  >('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [draftConflict, setDraftConflict] = useState<{
    message: string;
    serverDraft: BorradorFormularioClinico | null;
  } | null>(null);
  const [discardingDraft, setDiscardingDraft] = useState(false);
  const hydratedDraftKeyRef = useRef<string | null>(null);
  const skipNextAutosaveRef = useRef(false);

  const enabledOptionalKeys = useMemo<SectionKey[]>(() => {
    const keys: SectionKey[] = ['examen'];
    if (canDiagnosticos) keys.push('diagnosticos');
    if (canAntecedentes) keys.push('antecedentes');
    if (canEvoluciones) keys.push('evolucion');
    if (canTratamientos) keys.push('tratamientos');
    if (canEstudios) keys.push('estudios');
    keys.push('observaciones');
    return keys;
  }, [canDiagnosticos, canAntecedentes, canEvoluciones, canTratamientos, canEstudios]);

  const blockViewState = useMemo(
    () => resolveConsultaBlockViewMode(openSections, enabledOptionalKeys),
    [openSections, enabledOptionalKeys]
  );

  const serializeCurrentConsultaSnapshot = useCallback(
    (
      motivo: string,
      sint: string,
      examen: string,
      obs: string,
      obsGen: string,
      evTexto: string,
      evObs: string,
      diag: DiagnosticoDraft[],
      ant: AntecedenteDraft[],
      al: AlergiaDraft[],
      trat: TratamientoDraft[],
      est: EstudioDraft[]
    ): string => {
      return JSON.stringify({
        motivo: motivo.trim(),
        sint: sint.trim(),
        examen: examen.trim(),
        obs: obs.trim(),
        obsGen: obsGen.trim(),
        evTexto: evTexto.trim(),
        evObs: evObs.trim(),
        diag: diag.map((d) => ({
          c: d.codigo?.trim() ?? '',
          d: d.descripcion?.trim() ?? '',
          t: d.tipo ?? 'PRESUNTIVO',
          f: d.fecha_diagnostico ?? '',
          o: d.observaciones?.trim() ?? '',
        })),
        ant: ant.map((a) => ({
          t: a.tipo,
          c: a.categoria?.trim() ?? '',
          d: a.descripcion?.trim() ?? '',
          f: a.fecha_antecedente ?? '',
        })),
        al: al.map((item) => ({
          a: item.alergeno?.trim() ?? '',
          r: item.tipo_reaccion?.trim() ?? '',
          g: item.gravedad ?? 'LEVE',
          f: item.fecha_deteccion ?? '',
          o: item.observaciones?.trim() ?? '',
        })),
        trat: trat.map((t) => ({
          m: t.medicacion?.trim() ?? '',
          d: t.dosis?.trim() ?? '',
          f: t.frecuencia?.trim() ?? '',
          du: t.duracion?.trim() ?? '',
          i: t.indicaciones?.trim() ?? '',
        })),
        est: est.map((e) => ({
          t: e.tipo_estudio?.trim() ?? '',
          d: e.descripcion?.trim() ?? '',
        })),
      });
    },
    []
  );

  const baselineSnapshotRef = useRef<string>(
    JSON.stringify({
      motivo: '',
      sint: '',
      examen: '',
      obs: '',
      obsGen: '',
      evTexto: '',
      evObs: '',
      diag: [],
      ant: [],
      al: [],
      trat: [],
      est: [],
    })
  );

  const currentSnapshot = useMemo(
    () =>
      serializeCurrentConsultaSnapshot(
        motivoConsulta,
        sintomas,
        examenFisico,
        observaciones,
        observacionesGenerales,
        evolucionTexto,
        evolucionObs,
        diagnosticos,
        antecedentes,
        alergias,
        tratamientos,
        estudios
      ),
    [
      serializeCurrentConsultaSnapshot,
      motivoConsulta,
      sintomas,
      examenFisico,
      observaciones,
      observacionesGenerales,
      evolucionTexto,
      evolucionObs,
      diagnosticos,
      antecedentes,
      alergias,
      tratamientos,
      estudios,
    ]
  );

  const isDirty = useMemo(
    () => currentSnapshot !== baselineSnapshotRef.current,
    [currentSnapshot]
  );

  const isFutureFechaAtencion = useMemo(() => {
    if (!fechaAtencion) return false;
    if (fechaAtencion.slice(0, 10) > today) return true;
    const parsed = Date.parse(toArgentinaOffsetIso(fechaAtencion));
    return !Number.isNaN(parsed) && parsed > Date.now() + 60_000;
  }, [fechaAtencion, today]);

  useAutoDismiss(
    error,
    () => {
      setError(null);
      setErrorLocation(null);
    },
    RECOVERABLE_ERROR_TIMEOUT_MS,
    Boolean(error) && !errorCritical
  );

  useEffect(() => {
    if (!isDirty || submitting || savedSuccessfullyRef.current) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, submitting]);

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const applyBlockViewMode = (mode: 'obligatorios' | 'todos') => {
    setOpenSections(buildConsultaSectionsForMode(mode, enabledOptionalKeys));
  };

  const applyRecoveredDraft = useCallback(
    (
      datos: Record<string, unknown>,
      version: number,
      updatedAt?: string,
      status: 'recovered' | 'saved' = 'recovered'
    ) => {
      if (typeof datos.id_especialidad === 'string' && datos.id_especialidad) {
        setIdEspecialidad(datos.id_especialidad);
      }
      if (typeof datos.fecha_atencion === 'string' && datos.fecha_atencion) {
        setFechaAtencion(datos.fecha_atencion);
      }
      if (typeof datos.motivo_consulta === 'string') {
        setMotivoConsulta(datos.motivo_consulta);
      }
      if (typeof datos.sintomas === 'string') {
        setSintomas(datos.sintomas);
      }
      if (typeof datos.examen_fisico === 'string') {
        setExamenFisico(datos.examen_fisico);
      }
      if (typeof datos.observaciones === 'string') {
        setObservaciones(datos.observaciones);
      }
      if (typeof datos.observaciones_generales === 'string') {
        setObservacionesGenerales(datos.observaciones_generales);
      }
      if (typeof datos.evolucion_texto === 'string') {
        setEvolucionTexto(datos.evolucion_texto);
      }
      if (typeof datos.evolucion_obs === 'string') {
        setEvolucionObs(datos.evolucion_obs);
      }
      const nextDiag = Array.isArray(datos.diagnosticos)
        ? (datos.diagnosticos as DiagnosticoDraft[])
        : [];
      const nextAnt = Array.isArray(datos.antecedentes)
        ? (datos.antecedentes as AntecedenteDraft[])
        : [];
      const nextAl = Array.isArray(datos.alergias)
        ? (datos.alergias as AlergiaDraft[])
        : [];
      const nextTrat = Array.isArray(datos.tratamientos)
        ? (datos.tratamientos as TratamientoDraft[])
        : [];
      const nextEst = Array.isArray(datos.estudios)
        ? (datos.estudios as EstudioDraft[])
        : [];

      setDiagnosticos(nextDiag);
      setAntecedentes(nextAnt);
      setAlergias(nextAl);
      setTratamientos(nextTrat);
      setEstudios(nextEst);

      setOpenSections((prev) => ({
        ...prev,
        datos: true,
        motivo: true,
        examen:
          prev.examen ||
          (typeof datos.examen_fisico === 'string' && datos.examen_fisico.trim().length > 0),
        diagnosticos: prev.diagnosticos || nextDiag.length > 0,
        antecedentes: prev.antecedentes || nextAnt.length > 0 || nextAl.length > 0,
        evolucion:
          prev.evolucion ||
          (typeof datos.evolucion_texto === 'string' && datos.evolucion_texto.trim().length > 0),
        tratamientos: prev.tratamientos || nextTrat.length > 0,
        estudios: prev.estudios || nextEst.length > 0,
        observaciones:
          prev.observaciones ||
          (typeof datos.observaciones === 'string' && datos.observaciones.trim().length > 0) ||
          (typeof datos.observaciones_generales === 'string' &&
            datos.observaciones_generales.trim().length > 0),
      }));

      skipNextAutosaveRef.current = true;
      baselineSnapshotRef.current = serializeCurrentConsultaSnapshot(
        typeof datos.motivo_consulta === 'string' ? datos.motivo_consulta : '',
        typeof datos.sintomas === 'string' ? datos.sintomas : '',
        typeof datos.examen_fisico === 'string' ? datos.examen_fisico : '',
        typeof datos.observaciones === 'string' ? datos.observaciones : '',
        typeof datos.observaciones_generales === 'string' ? datos.observaciones_generales : '',
        typeof datos.evolucion_texto === 'string' ? datos.evolucion_texto : '',
        typeof datos.evolucion_obs === 'string' ? datos.evolucion_obs : '',
        nextDiag,
        nextAnt,
        nextAl,
        nextTrat,
        nextEst
      );
      draftVersionRef.current = version;
      setDraftVersion(version);
      setLastSavedAt(updatedAt ?? new Date().toISOString());
      setAutosaveStatus(status);
    },
    [serializeCurrentConsultaSnapshot]
  );

  const applyPersistedConsultaDraft = useCallback((detail: ConsultaMedicaDetalle) => {
    setEditingConsultaId(detail.id_consulta);
    setSelectedPatientId(detail.id_paciente);
    setIdSalita(detail.id_salita);
    setIdEspecialidad(detail.id_especialidad);
    setIdTurno(detail.id_turno || '');

    const localFecha = isoToArgentinaDateTimeLocal(detail.fecha_atencion);
    if (localFecha) {
      setFechaAtencion(localFecha);
    }

    setMotivoConsulta(detail.motivo_consulta || '');
    setSintomas(detail.sintomas || '');
    setExamenFisico(detail.examen_fisico || '');
    setObservaciones(detail.observaciones || '');
    setObservacionesGenerales('');

    const activeDiags: DiagnosticoDraft[] = (detail.diagnosticos ?? [])
      .filter((d) => d.estado !== 'ANULADO')
      .map((d) => ({
        codigo: d.codigo || '',
        descripcion: d.descripcion,
        tipo: d.tipo,
        fecha_diagnostico: d.fecha_diagnostico || today,
        observaciones: d.observaciones || '',
      }));

    const activeEvol = (detail.evoluciones ?? []).find((ev) => ev.estado !== 'ANULADA');
    const activeTrat: TratamientoDraft[] = (detail.tratamientos ?? [])
      .filter((t) => t.estado !== 'ANULADO')
      .map((t) => ({
        medicacion: t.medicacion,
        dosis: t.dosis,
        frecuencia: t.frecuencia,
        duracion: t.duracion || '',
        indicaciones: t.indicaciones || '',
        fecha_inicio: t.fecha_inicio || today,
        fecha_fin: t.fecha_fin || '',
      }));
    const activeEst: EstudioDraft[] = (detail.estudios ?? [])
      .filter((es) => es.estado !== 'CANCELADO')
      .map((es) => ({
        tipo_estudio: es.tipo_estudio,
        descripcion: es.descripcion,
      }));

    setDiagnosticos(activeDiags);
    setEvolucionTexto(activeEvol?.evolucion || '');
    setEvolucionObs(activeEvol?.observaciones || '');
    setTratamientos(activeTrat);
    setEstudios(activeEst);
    setAntecedentes([]);
    setAlergias([]);

    setOpenSections((prev) => ({
      ...prev,
      datos: true,
      motivo: true,
      examen: prev.examen || Boolean(detail.examen_fisico?.trim()),
      diagnosticos: prev.diagnosticos || activeDiags.length > 0,
      evolucion: prev.evolucion || Boolean(activeEvol?.evolucion?.trim()),
      tratamientos: prev.tratamientos || activeTrat.length > 0,
      estudios: prev.estudios || activeEst.length > 0,
      observaciones: prev.observaciones || Boolean(detail.observaciones?.trim()),
    }));

    skipNextAutosaveRef.current = true;
    baselineSnapshotRef.current = serializeCurrentConsultaSnapshot(
      detail.motivo_consulta || '',
      detail.sintomas || '',
      detail.examen_fisico || '',
      detail.observaciones || '',
      '',
      activeEvol?.evolucion || '',
      activeEvol?.observaciones || '',
      activeDiags,
      [],
      [],
      activeTrat,
      activeEst
    );
    setRemoteAutosaveAvailable(false);
  }, [serializeCurrentConsultaSnapshot, today]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingInit(true);
      setError(null);
      setTurnoDiscrepancyError(null);
      setReadonlyImmutableConsulta(null);
      try {
        const [ctx, patientsData, turnoRes] = await Promise.all([
          getHistoriaClinicaContext(),
          searchClinicalPatients({ page: 1, limit: 50 }).catch(() => null),
          initialTurno ? getTurnoById(initialTurno).catch(() => null) : Promise.resolve(null),
        ]);
        if (!active) return;

        setContext(ctx);
        const list = patientsData?.patients ?? [];
        setPatients(list);

        if (initialConsultaId) {
          const salitaLookup = initialSalita || ctx.salitas_autorizadas[0]?.id_salita || '';
          if (!salitaLookup) {
            setError('No poseés una salita autorizada para editar esta consulta.');
            return;
          }
          const detail = await getConsultaMedicaById(initialConsultaId, {
            id_salita: salitaLookup,
            id_paciente: effectiveRoutePatientId || undefined,
            motivo_acceso: 'Edición de consulta médica en borrador',
          });
          if (!active) return;

          if (detail.estado !== 'BORRADOR') {
            setSelectedPatientId(detail.id_paciente);
            setIdSalita(detail.id_salita);
            setReadonlyImmutableConsulta({
              id: detail.id_consulta,
              estado: detail.estado,
            });
            return;
          }

          applyPersistedConsultaDraft(detail);

          if (detail.id_turno) {
            const linked = await getTurnoById(detail.id_turno).catch(() => null);
            if (active && linked?.data?.turno) {
              setLinkedTurno(linked.data.turno);
            }
          }

          const foundInList = list.find((p) => p.id_paciente === detail.id_paciente);
          if (foundInList) {
            setResolvedPatient({
              id_paciente: foundInList.id_paciente,
              dni: foundInList.dni,
              nombres: foundInList.nombres,
              apellidos: foundInList.apellidos,
            });
          } else {
            const dossier = await getHistoriaClinicaPaciente(detail.id_paciente, {
              id_salita: detail.id_salita,
              motivo_acceso: 'Verificación de datos para edición de borrador',
            }).catch(() => null);
            if (active && dossier?.paciente) {
              setResolvedPatient({
                id_paciente: dossier.paciente.id_paciente,
                dni: dossier.paciente.dni,
                nombres: dossier.paciente.nombres,
                apellidos: dossier.paciente.apellidos,
              });
            }
          }
          return;
        }

        if (initialTurno) {
          if (!turnoRes?.data?.turno) {
            setTurnoDiscrepancyError(
              'No se pudo obtener o verificar el turno asociado para autocompletar al paciente.'
            );
          } else {
            const t = turnoRes.data.turno;
            setLinkedTurno(t);
            setIdTurno(t.id_turno);

            const turnoPatientId = t.paciente?.id_paciente || '';
            if (effectiveRoutePatientId && turnoPatientId && effectiveRoutePatientId !== turnoPatientId) {
              setTurnoDiscrepancyError(
                'Discrepancia detectada: el paciente de la ruta no coincide con el paciente del turno vinculado. No se permite guardar.'
              );
            } else if (turnoPatientId) {
              setSelectedPatientId(turnoPatientId);
            }

            if (t.paciente?.persona) {
              setResolvedPatient({
                id_paciente: turnoPatientId,
                dni: t.paciente.persona.dni,
                nombres: t.paciente.persona.nombres,
                apellidos: t.paciente.persona.apellidos,
              });
            }

            const salitaResolved =
              t.salita?.id_salita &&
              ctx.salitas_autorizadas.some((s) => s.id_salita === t.salita?.id_salita)
                ? t.salita.id_salita
                : initialSalita || ctx.salitas_autorizadas[0]?.id_salita || '';
            if (salitaResolved) {
              setIdSalita(salitaResolved);
            }

            if (
              t.especialidad?.id_especialidad &&
              ctx.especialidades_autorizadas.some(
                (e) => e.id_especialidad === t.especialidad?.id_especialidad
              )
            ) {
              setIdEspecialidad(t.especialidad.id_especialidad);
            } else if (ctx.especialidades_autorizadas[0]) {
              setIdEspecialidad(ctx.especialidades_autorizadas[0].id_especialidad);
            }

            // Evita duplicar consultas si este turno ya posee un borrador o consulta firmada.
            if (turnoPatientId && salitaResolved && !(effectiveRoutePatientId && effectiveRoutePatientId !== turnoPatientId)) {
              const dossier = await getHistoriaClinicaPaciente(turnoPatientId, {
                id_salita: salitaResolved,
                motivo_acceso: 'Verificación de consulta existente para el turno',
              }).catch(() => null);
              if (!active) return;

              const existingForTurno = dossier?.consultas?.find(
                (c) => c.id_turno === t.id_turno && c.estado !== 'ANULADA'
              );
              if (existingForTurno?.estado === 'FIRMADA') {
                setReadonlyImmutableConsulta({
                  id: existingForTurno.id_consulta,
                  estado: existingForTurno.estado,
                });
                return;
              }
              if (existingForTurno?.estado === 'BORRADOR') {
                const detail = await getConsultaMedicaById(existingForTurno.id_consulta, {
                  id_salita: salitaResolved,
                  id_paciente: turnoPatientId,
                  motivo_acceso: 'Continuación de borrador existente para el turno',
                }).catch(() => null);
                if (active && detail && detail.estado === 'BORRADOR') {
                  applyPersistedConsultaDraft(detail);
                  return;
                }
              }
            }
          }
        } else {
          if (!initialSalita && ctx.salitas_autorizadas[0]) {
            setIdSalita(ctx.salitas_autorizadas[0].id_salita);
          }
          if (ctx.especialidades_autorizadas[0]) {
            setIdEspecialidad(ctx.especialidades_autorizadas[0].id_especialidad);
          }

          if (effectiveRoutePatientId) {
            setSelectedPatientId(effectiveRoutePatientId);
            const foundInList = list.find((p) => p.id_paciente === effectiveRoutePatientId);
            if (foundInList) {
              setResolvedPatient({
                id_paciente: foundInList.id_paciente,
                dni: foundInList.dni,
                nombres: foundInList.nombres,
                apellidos: foundInList.apellidos,
              });
            } else if (!navState?.patientSummary && (initialSalita || ctx.salitas_autorizadas[0]?.id_salita)) {
              // Fallback: si ingresó por ruta directa con :idPaciente (p.ej. paciente derivado), recuperar resumen autorizado.
              const salitaLookup = initialSalita || ctx.salitas_autorizadas[0].id_salita;
              const dossier = await getHistoriaClinicaPaciente(effectiveRoutePatientId, {
                id_salita: salitaLookup,
                motivo_acceso: 'Verificación de datos para nueva consulta',
              }).catch(() => null);
              if (active && dossier?.paciente) {
                setResolvedPatient({
                  id_paciente: dossier.paciente.id_paciente,
                  dni: dossier.paciente.dni,
                  nombres: dossier.paciente.nombres,
                  apellidos: dossier.paciente.apellidos,
                });
              }
            }
          }
        }
      } catch (err) {
        if (active) setError(extractClinicalApiError(err).message);
      } finally {
        if (active) setLoadingInit(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [
    applyPersistedConsultaDraft,
    effectiveRoutePatientId,
    initialConsultaId,
    initialSalita,
    initialTurno,
    navState?.patientSummary,
  ]);

  useEffect(() => {
    if (!selectedPatientId) {
      setTurnos([]);
      return;
    }
    let active = true;
    void getTurnos({ id_paciente: selectedPatientId, limit: 20 })
      .then((res) => {
        if (active) setTurnos(res.data.turnos);
      })
      .catch(() => {
        if (active) setTurnos([]);
      });
    return () => {
      active = false;
    };
  }, [selectedPatientId]);

  useEffect(() => {
    if (
      loadingInit ||
      !selectedPatientId ||
      !idSalita ||
      !remoteAutosaveAvailable ||
      Boolean(editingConsultaId) ||
      Boolean(readonlyImmutableConsulta)
    ) {
      return;
    }
    const draftKey = `${selectedPatientId}:${idSalita}:${idTurno || 'sin-turno'}`;
    if (hydratedDraftKeyRef.current === draftKey) {
      return;
    }
    hydratedDraftKeyRef.current = draftKey;

    let active = true;
    void obtenerBorradorTemporal({
      id_paciente: selectedPatientId,
      id_salita: idSalita,
      id_turno: idTurno || null,
    })
      .then((res) => {
        if (!active) return;
        if (!res.available) {
          setRemoteAutosaveAvailable(false);
          return;
        }
        if (res.borrador) {
          applyRecoveredDraft(
            res.borrador.datos_formulario,
            res.borrador.version,
            res.borrador.fecha_actualizacion,
            'recovered'
          );
        }
      })
      .catch(() => {
        // Si no hay borrador remoto disponible, no interrumpe la atención.
      });

    return () => {
      active = false;
    };
  }, [
    loadingInit,
    selectedPatientId,
    idSalita,
    idTurno,
    remoteAutosaveAvailable,
    applyRecoveredDraft,
  ]);

  const draftPayloadSnapshot = useMemo(
    () => ({
      id_especialidad: idEspecialidad || null,
      fecha_atencion: fechaAtencion || null,
      motivo_consulta: motivoConsulta,
      sintomas,
      examen_fisico: examenFisico,
      observaciones,
      observaciones_generales: observacionesGenerales,
      evolucion_texto: evolucionTexto,
      evolucion_obs: evolucionObs,
      diagnosticos,
      antecedentes,
      alergias,
      tratamientos,
      estudios,
    }),
    [
      idEspecialidad,
      fechaAtencion,
      motivoConsulta,
      sintomas,
      examenFisico,
      observaciones,
      observacionesGenerales,
      evolucionTexto,
      evolucionObs,
      diagnosticos,
      antecedentes,
      alergias,
      tratamientos,
      estudios,
    ]
  );

  useEffect(() => {
    if (
      loadingInit ||
      !selectedPatientId ||
      !idSalita ||
      !isDirty ||
      submitting ||
      savedSuccessfullyRef.current ||
      Boolean(draftConflict) ||
      !remoteAutosaveAvailable
    ) {
      return;
    }

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      setAutosaveStatus('saving');
      void guardarBorradorTemporal({
        id_paciente: selectedPatientId,
        id_salita: idSalita,
        id_especialidad: idEspecialidad || null,
        id_turno: idTurno || null,
        version_esperada: draftVersionRef.current,
        datos_formulario: draftPayloadSnapshot,
      })
        .then((res) => {
          if (!res.available) {
            setRemoteAutosaveAvailable(false);
            setAutosaveStatus('idle');
            return;
          }
          if (res.borrador) {
            draftVersionRef.current = res.borrador.version;
            setDraftVersion(res.borrador.version);
            setLastSavedAt(res.borrador.fecha_actualizacion);
            setAutosaveStatus('saved');
            baselineSnapshotRef.current = currentSnapshot;
          }
        })
        .catch((err) => {
          const parsed = extractClinicalApiError(err);
          if (parsed.isConflict || parsed.code === 'BORRADOR_CONFLICT') {
            setAutosaveStatus('conflict');
            setDraftConflict({
              message:
                parsed.message ||
                'Este borrador fue actualizado desde otra pestaña.',
              serverDraft: parsed.data?.borrador_actual ?? null,
            });
          } else {
            setAutosaveStatus('idle');
          }
        });
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    loadingInit,
    selectedPatientId,
    idSalita,
    idEspecialidad,
    idTurno,
    isDirty,
    submitting,
    draftConflict,
    remoteAutosaveAvailable,
    draftPayloadSnapshot,
  ]);

  const handleDiscardTemporalDraft = async () => {
    if (!selectedPatientId || !idSalita) return;
    setDiscardingDraft(true);
    try {
      await descartarBorradorTemporal({
        id_paciente: selectedPatientId,
        id_salita: idSalita,
        id_turno: idTurno || null,
      }).catch(() => undefined);

      setMotivoConsulta('');
      setSintomas('');
      setExamenFisico('');
      setObservaciones('');
      setObservacionesGenerales('');
      setEvolucionTexto('');
      setEvolucionObs('');
      setDiagnosticos([]);
      setAntecedentes([]);
      setAlergias([]);
      setTratamientos([]);
      setEstudios([]);
      setDraftConflict(null);
      draftVersionRef.current = 0;
      setDraftVersion(0);
      setLastSavedAt(null);
      setAutosaveStatus('idle');
    } finally {
      setDiscardingDraft(false);
    }
  };

  const isLockedFromTurno = Boolean(initialTurno || editingConsultaId);

  const selectedPatientFromList = patients.find((p) => p.id_paciente === selectedPatientId);
  const displayPatient: ResolvedPatientLabel | null =
    (resolvedPatient?.id_paciente === selectedPatientId ? resolvedPatient : null) ||
    (selectedPatientFromList
      ? {
          id_paciente: selectedPatientFromList.id_paciente,
          dni: selectedPatientFromList.dni,
          nombres: selectedPatientFromList.nombres,
          apellidos: selectedPatientFromList.apellidos,
        }
      : null);

  const patientDisplayText = displayPatient
    ? `${displayPatient.apellidos}, ${displayPatient.nombres}${
        displayPatient.dni ? ` (DNI ${displayPatient.dni})` : ''
      }`
    : selectedPatientId || 'Paciente no identificado';

  const turnosWithLinked =
    linkedTurno && !turnos.some((t) => t.id_turno === linkedTurno.id_turno)
      ? [linkedTurno, ...turnos]
      : turnos;

  const raiseFieldError = (options: {
    blockKey?: SectionKey;
    blockLabel?: string;
    fieldId?: string;
    message: string;
    critical?: boolean;
  }) => {
    setErrorCritical(Boolean(options.critical));
    if (options.blockKey) {
      setOpenSections((prev) => ({ ...prev, [options.blockKey!]: true }));
    }
    setErrorLocation({
      blockKey: options.blockKey,
      blockLabel: options.blockLabel,
      fieldId: options.fieldId,
    });
    setError(options.message);
    if (options.fieldId) {
      focusFieldById(options.fieldId, 75);
    }
  };

  const validateBeforeSave = (firmar: boolean): boolean => {
    setErrorCritical(false);
    setErrorLocation(null);

    if (turnoDiscrepancyError) {
      raiseFieldError({
        blockKey: 'datos',
        blockLabel: 'Bloque 1 · Datos de consulta',
        fieldId: 'nc-turno',
        message: turnoDiscrepancyError,
        critical: true,
      });
      return false;
    }

    if (!selectedPatientId) {
      raiseFieldError({
        blockKey: 'datos',
        blockLabel: 'Bloque 1 · Datos de consulta',
        fieldId: 'nc-paciente',
        message: 'Seleccioná un paciente para registrar la consulta.',
      });
      return false;
    }
    if (!idSalita) {
      raiseFieldError({
        blockKey: 'datos',
        blockLabel: 'Bloque 1 · Datos de consulta',
        fieldId: 'nc-salita',
        message: 'Seleccioná una salita autorizada.',
      });
      return false;
    }
    if (!idEspecialidad) {
      raiseFieldError({
        blockKey: 'datos',
        blockLabel: 'Bloque 1 · Datos de consulta',
        fieldId: 'nc-esp',
        message: 'Seleccioná una especialidad habilitada.',
      });
      return false;
    }

    const matchedTurno = idTurno
      ? linkedTurno?.id_turno === idTurno
        ? linkedTurno
        : turnosWithLinked.find((t) => t.id_turno === idTurno) ?? null
      : null;

    if (idTurno && (!matchedTurno || matchedTurno.paciente?.id_paciente !== selectedPatientId)) {
      raiseFieldError({
        blockKey: 'datos',
        blockLabel: 'Bloque 1 · Datos de consulta',
        fieldId: 'nc-turno',
        message:
          'El paciente seleccionado no coincide con el paciente del turno vinculado. Corregí la selección antes de guardar.',
      });
      return false;
    }

    const beforeTurnoStart = Boolean(
      matchedTurno?.fecha_hora_inicio && Date.now() < Date.parse(matchedTurno.fecha_hora_inicio)
    );

    if (isFutureFechaAtencion || (firmar && beforeTurnoStart)) {
      if (firmar) {
        raiseFieldError({
          blockKey: 'datos',
          blockLabel: 'Bloque 1 · Datos de consulta',
          fieldId: beforeTurnoStart && !isFutureFechaAtencion ? 'nc-turno' : 'nc-fecha',
          message: beforeTurnoStart
            ? 'No podés firmar la consulta antes del horario de inicio del turno programado. Podés guardarla como borrador anticipado.'
            : 'No se puede firmar ni cerrar definitivamente una consulta con fecha u hora clínica futura.',
        });
        return false;
      }
      if (!idTurno) {
        raiseFieldError({
          blockKey: 'datos',
          blockLabel: 'Bloque 1 · Datos de consulta',
          fieldId: 'nc-fecha',
          message:
            'Una fecha u hora clínica futura solo puede guardarse como borrador vinculado a un turno programado.',
        });
        return false;
      }
    }

    if (motivoConsulta.trim().length < 2) {
      raiseFieldError({
        blockKey: 'motivo',
        blockLabel: 'Bloque 2 · Motivo y anamnesis',
        fieldId: 'nc-motivo',
        message: 'Ingresá el motivo de consulta (mínimo 2 caracteres).',
      });
      return false;
    }

    for (let idx = 0; idx < diagnosticos.length; idx += 1) {
      if (!diagnosticos[idx].descripcion.trim()) {
        raiseFieldError({
          blockKey: 'diagnosticos',
          blockLabel: 'Bloque 4 · Diagnósticos',
          fieldId: `nc-diag-desc-${idx}`,
          message: 'Completá la descripción de todos los diagnósticos agregados o eliminá los vacíos.',
        });
        return false;
      }
    }
    for (let idx = 0; idx < antecedentes.length; idx += 1) {
      if (!antecedentes[idx].descripcion.trim()) {
        raiseFieldError({
          blockKey: 'antecedentes',
          blockLabel: 'Bloque 5 · Antecedentes y alergias',
          fieldId: `nc-ant-desc-${idx}`,
          message: 'Completá la descripción de todos los antecedentes agregados.',
        });
        return false;
      }
    }
    for (let idx = 0; idx < alergias.length; idx += 1) {
      const al = alergias[idx];
      if (!al.alergeno.trim() || !al.tipo_reaccion.trim()) {
        raiseFieldError({
          blockKey: 'antecedentes',
          blockLabel: 'Bloque 5 · Antecedentes y alergias',
          fieldId: !al.alergeno.trim() ? `nc-alergia-alergeno-${idx}` : `nc-alergia-reaccion-${idx}`,
          message: 'Completá alérgeno y tipo de reacción en todas las alergias agregadas.',
        });
        return false;
      }
    }
    for (let idx = 0; idx < tratamientos.length; idx += 1) {
      const t = tratamientos[idx];
      if (!t.medicacion.trim() || !t.dosis.trim() || !t.frecuencia.trim()) {
        raiseFieldError({
          blockKey: 'tratamientos',
          blockLabel: 'Bloque 7 · Tratamientos e indicaciones',
          fieldId: !t.medicacion.trim()
            ? `nc-trat-med-${idx}`
            : !t.dosis.trim()
              ? `nc-trat-dosis-${idx}`
              : `nc-trat-frec-${idx}`,
          message: 'Completá medicación, dosis y frecuencia en todos los tratamientos agregados.',
        });
        return false;
      }
    }
    for (let idx = 0; idx < estudios.length; idx += 1) {
      const es = estudios[idx];
      if (!es.tipo_estudio.trim() || !es.descripcion.trim()) {
        raiseFieldError({
          blockKey: 'estudios',
          blockLabel: 'Bloque 8 · Estudios',
          fieldId: !es.tipo_estudio.trim() ? `nc-est-tipo-${idx}` : `nc-est-desc-${idx}`,
          message: 'Completá tipo y descripción en todos los estudios solicitados.',
        });
        return false;
      }
    }
    return true;
  };

  const executeSave = async (firmar: boolean) => {
    if (submittingRef.current || readonlyImmutableConsulta) return false;
    setError(null);
    setErrorLocation(null);
    setErrorCritical(false);
    if (!validateBeforeSave(firmar)) return false;

    const combinedObservaciones = [
      observaciones.trim(),
      observacionesGenerales.trim()
        ? `Observaciones generales de historia clínica: ${observacionesGenerales.trim()}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const diagnosticosPayload = canDiagnosticos
        ? diagnosticos.map((d) => ({
            codigo: d.codigo.trim() || null,
            descripcion: d.descripcion.trim(),
            tipo: d.tipo,
            fecha_diagnostico: d.fecha_diagnostico || undefined,
            observaciones: d.observaciones.trim() || null,
          }))
        : undefined;

      const evolucionesPayload = canEvoluciones
        ? evolucionTexto.trim()
          ? [
              {
                evolucion: evolucionTexto.trim(),
                observaciones: evolucionObs.trim() || null,
              },
            ]
          : editingConsultaId
            ? []
            : undefined
        : undefined;

      const tratamientosPayload = canTratamientos
        ? tratamientos.map((t) => ({
            medicacion: t.medicacion.trim(),
            dosis: t.dosis.trim(),
            frecuencia: t.frecuencia.trim(),
            duracion: t.duracion.trim() || null,
            indicaciones: t.indicaciones.trim() || null,
            fecha_inicio: t.fecha_inicio || undefined,
            fecha_fin: t.fecha_fin || null,
          }))
        : undefined;

      const estudiosPayload = canEstudios
        ? estudios.map((es) => ({
            tipo_estudio: es.tipo_estudio.trim(),
            descripcion: es.descripcion.trim(),
          }))
        : undefined;

      const saved = editingConsultaId
        ? await actualizarConsultaBorrador(editingConsultaId, {
            id_paciente: selectedPatientId,
            id_salita: idSalita,
            id_especialidad: idEspecialidad,
            id_turno: idTurno || null,
            fecha_atencion: fechaAtencion ? toArgentinaOffsetIso(fechaAtencion) : undefined,
            fecha_preparacion: toArgentinaOffsetIso(getNowArgentinaDateTimeLocal()),
            motivo_consulta: motivoConsulta.trim(),
            sintomas: sintomas.trim() || null,
            examen_fisico: examenFisico.trim() || null,
            observaciones: combinedObservaciones || null,
            firmar,
            ...(diagnosticosPayload !== undefined ? { diagnosticos: diagnosticosPayload } : {}),
            ...(evolucionesPayload !== undefined ? { evoluciones: evolucionesPayload } : {}),
            ...(tratamientosPayload !== undefined ? { tratamientos: tratamientosPayload } : {}),
            ...(estudiosPayload !== undefined ? { estudios: estudiosPayload } : {}),
          })
        : await registrarConsultaClinica({
            id_paciente: selectedPatientId,
            id_salita: idSalita,
            id_especialidad: idEspecialidad,
            id_turno: idTurno || null,
            fecha_atencion: fechaAtencion ? toArgentinaOffsetIso(fechaAtencion) : undefined,
            fecha_preparacion: toArgentinaOffsetIso(getNowArgentinaDateTimeLocal()),
            motivo_consulta: motivoConsulta.trim(),
            sintomas: sintomas.trim() || null,
            examen_fisico: examenFisico.trim() || null,
            observaciones: combinedObservaciones || null,
            firmar,
            diagnosticos:
              diagnosticosPayload && diagnosticosPayload.length > 0
                ? diagnosticosPayload
                : undefined,
            antecedentes:
              canAntecedentes && antecedentes.length > 0
                ? antecedentes.map((a) => ({
                    tipo: a.tipo,
                    categoria: a.categoria.trim() || null,
                    descripcion: a.descripcion.trim(),
                    fecha_antecedente: a.fecha_antecedente || undefined,
                  }))
                : undefined,
            alergias:
              canAntecedentes && alergias.length > 0
                ? alergias.map((al) => ({
                    alergeno: al.alergeno.trim(),
                    tipo_reaccion: al.tipo_reaccion.trim(),
                    gravedad: al.gravedad,
                    fecha_deteccion: al.fecha_deteccion || null,
                    observaciones: al.observaciones.trim() || null,
                  }))
                : undefined,
            evoluciones:
              evolucionesPayload && evolucionesPayload.length > 0
                ? evolucionesPayload
                : undefined,
            tratamientos:
              tratamientosPayload && tratamientosPayload.length > 0
                ? tratamientosPayload
                : undefined,
            estudios:
              estudiosPayload && estudiosPayload.length > 0
                ? estudiosPayload
                : undefined,
          });

      const returnedEstado =
        typeof saved?.estado === 'string' ? saved.estado : firmar ? 'FIRMADA' : 'BORRADOR';

      if (firmar && returnedEstado !== 'FIRMADA') {
        if (typeof saved?.id_consulta === 'string' && saved.id_consulta) {
          setEditingConsultaId(saved.id_consulta);
        }
        setErrorLocation({
          blockKey: 'datos',
          blockLabel: 'Confirmación de firma',
        });
        setError(
          'No se pudo confirmar la firma definitiva de la consulta. El registro quedó guardado como borrador para completar la firma sin duplicarlo.'
        );
        return false;
      }

      const notice = firmar
        ? formatSignedConsultaNotice(Boolean(saved?.turno_actualizado))
        : editingConsultaId
          ? 'Borrador de consulta actualizado correctamente.'
          : 'Consulta guardada como borrador.';

      if (selectedPatientId && idSalita && !editingConsultaId) {
        await descartarBorradorTemporal({
          id_paciente: selectedPatientId,
          id_salita: idSalita,
          id_turno: idTurno || null,
        }).catch(() => undefined);
      }

      savedSuccessfullyRef.current = true;

      const createdConsultaId =
        typeof saved?.id_consulta === 'string'
          ? saved.id_consulta
          : editingConsultaId || undefined;

      navigate(
        `/historia-clinica/pacientes/${selectedPatientId}?salita=${encodeURIComponent(idSalita)}`,
        {
          replace: true,
          state: {
            ...(navState ?? {
              origin: 'buscador',
              returnTo: '/historia-clinica',
              returnLabel: 'Volver al buscador',
            }),
            notice,
            createdConsultaId,
            createdConsultaEstado: returnedEstado,
          },
        }
      );
      return true;
    } catch (err) {
      const parsed = extractClinicalApiError(err);
      setErrorCritical(parsed.isForbidden || parsed.status === 409);
      setErrorLocation({
        blockKey: parsed.status === 400 ? 'datos' : undefined,
        blockLabel: parsed.status === 400 ? 'Validación de consulta' : 'Error al guardar',
      });
      setError(parsed.message);
      return false;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setConfirmSignOpen(false);
    }
  };

  const dossierReturnUrl =
    navState?.dossierReturnTo ||
    (selectedPatientId
      ? `/historia-clinica/pacientes/${selectedPatientId}${idSalita ? `?salita=${encodeURIComponent(idSalita)}` : ''}`
      : null);

  const primaryBack =
    isLockedFromTurno || navState?.origin === 'mi-agenda' || navState?.origin === 'mis-pacientes'
      ? resolvePrimaryBackTarget(
          navState,
          navState?.origin === 'mis-pacientes' ? '/mis-pacientes' : '/mi-agenda',
          navState?.origin === 'mis-pacientes' ? 'Volver a Pacientes del día' : 'Volver a Mi agenda'
        )
      : dossierReturnUrl && navState?.origin !== 'buscador'
        ? { to: dossierReturnUrl, label: 'Volver al expediente' }
        : resolvePrimaryBackTarget(navState, '/historia-clinica', 'Volver al buscador');

  const isPatientLocked =
    isLockedFromTurno || Boolean(effectiveRoutePatientId && displayPatient);

  const selectedTurnoObj = useMemo(
    () =>
      idTurno
        ? linkedTurno?.id_turno === idTurno
          ? linkedTurno
          : turnosWithLinked.find((t) => t.id_turno === idTurno) ?? null
        : null,
    [idTurno, linkedTurno, turnosWithLinked]
  );

  const isBeforeTurnoStart = useMemo(() => {
    if (!selectedTurnoObj?.fecha_hora_inicio) return false;
    const parsed = Date.parse(selectedTurnoObj.fecha_hora_inicio);
    return !Number.isNaN(parsed) && Date.now() < parsed;
  }, [selectedTurnoObj]);

  const isFutureScheduledTurno = useMemo(() => {
    if (!selectedTurnoObj?.fecha_hora_inicio) return false;
    const argentinaDay = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(selectedTurnoObj.fecha_hora_inicio));
    return argentinaDay > today;
  }, [selectedTurnoObj, today]);

  const formattedLastSavedTime = useMemo(() => {
    if (!lastSavedAt) return null;
    const dateObj = new Date(lastSavedAt);
    if (Number.isNaN(dateObj.getTime())) return null;
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(dateObj);
  }, [lastSavedAt]);

  const handleGuardedLinkClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    to: string,
    targetState?: ClinicalNavState | null
  ) => {
    if (!isDirty || submitting || savedSuccessfullyRef.current) return;
    event.preventDefault();
    setPendingExit({ to, state: targetState });
  };

  return (
    <div className="hc-page">
      <div className="hc-hero d-flex flex-wrap justify-content-between align-items-center gap-3 py-3">
        <div>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <h1 className="h4 mb-0">
              <i className="bi bi-file-medical text-success me-2" />
              {editingConsultaId
                ? 'Continuar borrador de consulta clínica'
                : 'Registrar nueva consulta clínica'}
            </h1>
            {editingConsultaId && (
              <span className="badge text-bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                Editando borrador existente
              </span>
            )}
            {isDirty && !savedSuccessfullyRef.current && (
              <span className="badge text-bg-warning-subtle text-warning-emphasis border">
                Cambios sin guardar
              </span>
            )}
          </div>
          <p className="text-muted small mb-0">
            Completá los campos obligatorios y guardá como borrador o firmá la consulta.
          </p>
        </div>

        <div className="hc-hero-actions">
          <Link
            to={primaryBack.to}
            className="btn btn-outline-secondary btn-sm"
            onClick={(e) => handleGuardedLinkClick(e, primaryBack.to)}
          >
            <i className="bi bi-arrow-left me-1" />
            {primaryBack.label}
          </Link>
          {dossierReturnUrl && dossierReturnUrl !== primaryBack.to && (
            <Link
              to={dossierReturnUrl}
              state={navState}
              className="btn btn-outline-primary btn-sm"
              onClick={(e) => handleGuardedLinkClick(e, dossierReturnUrl, navState)}
            >
              <i className="bi bi-folder2-open me-1" />
              Ir al expediente
            </Link>
          )}
          {navState?.origin === 'mi-agenda' && !primaryBack.to.startsWith('/mi-agenda') && (
            <Link
              to="/mi-agenda"
              className="btn btn-outline-secondary btn-sm"
              onClick={(e) => handleGuardedLinkClick(e, '/mi-agenda')}
            >
              Mi agenda
            </Link>
          )}
        </div>
      </div>

      {turnoDiscrepancyError && (
        <div className="alert alert-danger mb-0" role="alert">
          <i className="bi bi-shield-exclamation me-2" />
          <strong>{turnoDiscrepancyError}</strong>
        </div>
      )}

      {loadingInit && error && error !== turnoDiscrepancyError && (
        <div className="alert alert-danger alert-dismissible fade show mb-0" role="alert">
          <i className="bi bi-exclamation-octagon me-2" />
          {error}
          <button
            type="button"
            className="btn-close"
            aria-label="Cerrar"
            onClick={() => {
              setError(null);
              setErrorLocation(null);
            }}
          />
        </div>
      )}

      {draftConflict && (
        <div className="alert alert-warning mb-0" role="alert" data-testid="hc-draft-conflict">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
              <div className="fw-semibold">
                <i className="bi bi-exclamation-triangle-fill me-2" />
                Este borrador fue actualizado en otra pestaña o sesión
              </div>
              <div className="small mt-1">{draftConflict.message}</div>
            </div>
            <div className="d-flex flex-wrap gap-2">
              {draftConflict.serverDraft && (
                <button
                  type="button"
                  className="btn btn-sm btn-warning"
                  onClick={() => {
                    const serverDraft = draftConflict.serverDraft!;
                    applyRecoveredDraft(
                      serverDraft.datos_formulario,
                      serverDraft.version,
                      serverDraft.fecha_actualizacion,
                      'recovered'
                    );
                    setDraftConflict(null);
                  }}
                >
                  Recargar versión más reciente
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-outline-dark"
                onClick={() => {
                  const baseVersion = draftConflict.serverDraft?.version ?? draftVersionRef.current;
                  draftVersionRef.current = baseVersion;
                  setDraftVersion(baseVersion);
                  setDraftConflict(null);
                  setAutosaveStatus('idle');
                }}
              >
                Conservar mis cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {loadingInit ? (
        <div className="hc-card p-5 text-center text-muted">
          <div className="spinner-border text-success mb-2" role="status" />
          <div>Preparando formulario clínico...</div>
        </div>
      ) : readonlyImmutableConsulta ? (
        <div className="hc-card p-4">
          <div className="alert alert-success border border-success-subtle mb-3" role="status">
            <i className="bi bi-patch-check-fill me-2" />
            {readonlyImmutableConsulta.estado === 'FIRMADA'
              ? 'Esta consulta ya fue firmada definitivamente y es inmutable. Cualquier corrección o agregado debe realizarse como evolución o rectificación trazable desde el detalle.'
              : 'Esta consulta se encuentra anulada y no admite ediciones.'}
          </div>
          <div className="d-flex flex-wrap gap-2">
            <Link
              to={`/historia-clinica/consultas/${readonlyImmutableConsulta.id}?salita=${encodeURIComponent(idSalita)}${
                selectedPatientId ? `&paciente=${encodeURIComponent(selectedPatientId)}` : ''
              }`}
              state={navState}
              className="btn btn-success"
            >
              <i className="bi bi-file-earmark-medical me-1" />
              Ver detalle de la consulta
            </Link>
            <Link to={primaryBack.to} className="btn btn-outline-secondary">
              {primaryBack.label}
            </Link>
          </div>
        </div>
      ) : (
        <form
          className="d-grid gap-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <div className="hc-segmented-bar">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <div
                className="hc-segmented-toggle"
                role="group"
                aria-label="Vista de bloques del formulario"
              >
                <button
                  type="button"
                  className={`hc-segmented-btn${
                    blockViewState.mode === 'obligatorios' ? ' is-active' : ''
                  }`}
                  aria-pressed={blockViewState.mode === 'obligatorios'}
                  onClick={() => applyBlockViewMode('obligatorios')}
                >
                  Obligatorios
                </button>
                <button
                  type="button"
                  className={`hc-segmented-btn${
                    blockViewState.mode === 'todos' ? ' is-active' : ''
                  }`}
                  aria-pressed={blockViewState.mode === 'todos'}
                  onClick={() => applyBlockViewMode('todos')}
                >
                  Todos
                </button>
              </div>
              {blockViewState.mode === 'personalizado' && (
                <span className="hc-view-badge">
                  Personalizado ({blockViewState.openOptionalCount} opc.)
                </span>
              )}
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2 small">
              {autosaveStatus === 'saving' && (
                <span className="hc-autosave-status" data-testid="hc-autosave-status">
                  <span className="spinner-border spinner-border-sm text-success" role="status" />
                  Guardando borrador...
                </span>
              )}
              {(autosaveStatus === 'saved' || autosaveStatus === 'recovered') &&
                formattedLastSavedTime && (
                  <span
                    className="hc-autosave-status text-success"
                    data-testid="hc-autosave-status"
                  >
                    <i className="bi bi-cloud-check" />
                    {autosaveStatus === 'recovered' ? 'Recuperado' : 'Guardado'} ·{' '}
                    {formattedLastSavedTime}
                  </span>
                )}
              {(draftVersion > 0 || isDirty) && (
                <button
                  type="button"
                  className="btn btn-sm btn-link text-danger text-decoration-none p-0 ms-1"
                  disabled={discardingDraft || submitting}
                  onClick={() => void handleDiscardTemporalDraft()}
                >
                  Descartar borrador
                </button>
              )}
            </div>
          </div>

          {/* Bloque 1: Datos de consulta */}
          <AccordionBlock
            stepNumber={1}
            title="Datos de consulta"
            subtitle="Paciente, salita, especialidad y fecha"
            required
            blockError={errorLocation?.blockKey === 'datos' ? error : null}
            open={openSections.datos}
            onToggle={() => toggleSection('datos')}
          >
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-1 mb-1">
                  <label className="form-label fw-semibold mb-0" htmlFor="nc-paciente">
                    Paciente *
                  </label>
                  {isLockedFromTurno && (
                    <span className="badge text-bg-info-subtle text-info-emphasis border">
                      <i className="bi bi-lock-fill me-1" />
                      Paciente del turno (bloqueado)
                    </span>
                  )}
                </div>

                {isPatientLocked ? (
                  <input
                    id="nc-paciente"
                    type="text"
                    className="form-control bg-light fw-medium"
                    value={patientDisplayText}
                    readOnly
                    disabled
                  />
                ) : (
                  <select
                    id="nc-paciente"
                    className="form-select"
                    value={selectedPatientId}
                    onChange={(e) => {
                      setSelectedPatientId(e.target.value);
                      setIdTurno('');
                    }}
                    required
                  >
                    <option value="">Seleccionar paciente...</option>
                    {patients.map((p) => (
                      <option key={p.id_paciente} value={p.id_paciente}>
                        {p.apellidos}, {p.nombres} (DNI {p.dni})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="col-12 col-md-3">
                <label className="form-label fw-semibold" htmlFor="nc-salita">
                  Salita de atención *
                </label>
                <select
                  id="nc-salita"
                  className="form-select"
                  value={idSalita}
                  onChange={(e) => setIdSalita(e.target.value)}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {context?.salitas_autorizadas.map((s) => (
                    <option key={s.id_salita} value={s.id_salita}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-3">
                <label className="form-label fw-semibold" htmlFor="nc-esp">
                  Especialidad *
                </label>
                <select
                  id="nc-esp"
                  className="form-select"
                  value={idEspecialidad}
                  onChange={(e) => setIdEspecialidad(e.target.value)}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {context?.especialidades_autorizadas.map((e) => (
                    <option key={e.id_especialidad} value={e.id_especialidad}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-5">
                <label className="form-label fw-semibold" htmlFor="nc-fecha">
                  Fecha y hora real del acto clínico *
                </label>
                <div className="d-flex gap-2">
                  <input
                    id="nc-fecha"
                    type="datetime-local"
                    className={`form-control${isFutureFechaAtencion ? ' is-invalid' : ''}`}
                    value={fechaAtencion}
                    onChange={(e) => setFechaAtencion(e.target.value)}
                    required
                  />
                  {isFutureFechaAtencion && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-warning text-nowrap"
                      onClick={() => setFechaAtencion(getNowArgentinaDateTimeLocal())}
                    >
                      Usar hoy
                    </button>
                  )}
                </div>
                <div className="form-text small">
                  {isFutureFechaAtencion
                    ? 'Fecha u hora clínica futura: podés guardar como borrador vinculado a un turno, pero no firmar hasta el horario efectivo del acto clínico.'
                    : 'Fecha efectiva de atención médica.'}
                </div>
              </div>

              <div className="col-12 col-md-7">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-1 mb-1">
                  <label className="form-label fw-semibold mb-0" htmlFor="nc-turno">
                    Turno programado {isLockedFromTurno ? '(vinculado)' : '(opcional)'}
                  </label>
                  {(isFutureScheduledTurno || isBeforeTurnoStart) && (
                    <span className="badge text-bg-light text-secondary border">
                      Preparación: {formatArgentinaDate(today)}
                    </span>
                  )}
                </div>
                {isLockedFromTurno && linkedTurno ? (
                  <input
                    id="nc-turno"
                    type="text"
                    className="form-control bg-light"
                    value={`${formatArgentinaDateTime(linkedTurno.fecha_hora_inicio)} — ${
                      linkedTurno.especialidad?.nombre || 'Turno'
                    } (${linkedTurno.estado.nombre})`}
                    readOnly
                    disabled
                  />
                ) : (
                  <select
                    id="nc-turno"
                    className="form-select"
                    value={idTurno}
                    onChange={(e) => setIdTurno(e.target.value)}
                  >
                    <option value="">Atención espontánea sin turno</option>
                    {turnosWithLinked.map((t) => (
                      <option key={t.id_turno} value={t.id_turno}>
                        {formatArgentinaDateTime(t.fecha_hora_inicio)} — {t.especialidad?.nombre || 'Turno'} ({t.estado.nombre})
                      </option>
                    ))}
                  </select>
                )}
                {selectedTurnoObj && (
                  <div className="form-text small">
                    {isFutureScheduledTurno || isBeforeTurnoStart
                      ? 'Turno aún no iniciado: guardar en borrador conserva el estado actual del turno sin pasarlo a atendido.'
                      : 'Vinculado al turno seleccionado.'}
                  </div>
                )}
              </div>
            </div>
          </AccordionBlock>

          {/* Bloque 2: Motivo y anamnesis */}
          <AccordionBlock
            stepNumber={2}
            title="Motivo y anamnesis"
            subtitle="Motivo principal y síntomas"
            required
            blockError={errorLocation?.blockKey === 'motivo' ? error : null}
            open={openSections.motivo}
            onToggle={() => toggleSection('motivo')}
          >
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label fw-semibold" htmlFor="nc-motivo">
                  Motivo de consulta *
                </label>
                <input
                  id="nc-motivo"
                  type="text"
                  className="form-control"
                  maxLength={2000}
                  placeholder="Motivo principal de la consulta..."
                  value={motivoConsulta}
                  onChange={(e) => setMotivoConsulta(e.target.value)}
                  required
                />
              </div>

              <div className="col-12">
                <label className="form-label fw-semibold" htmlFor="nc-sintomas">
                  Síntomas / anamnesis <span className="text-muted fw-normal">(opcional)</span>
                </label>
                <textarea
                  id="nc-sintomas"
                  className="form-control"
                  rows={3}
                  maxLength={4000}
                  placeholder="Relato clínico, evolución de síntomas, antecedentes inmediatos..."
                  value={sintomas}
                  onChange={(e) => setSintomas(e.target.value)}
                />
              </div>
            </div>
          </AccordionBlock>

          {/* Bloque 3: Examen físico */}
          <AccordionBlock
            stepNumber={3}
            title="Examen físico"
            subtitle="Signos vitales y hallazgos"
            badgeText={examenFisico.trim() ? 'Completado' : undefined}
            open={openSections.examen}
            onToggle={() => toggleSection('examen')}
          >
            <div>
              <label className="form-label fw-semibold" htmlFor="nc-examen">
                Examen físico y signos vitales
              </label>
              <textarea
                id="nc-examen"
                className="form-control"
                rows={3}
                maxLength={4000}
                placeholder="TA, FC, temperatura, hallazgos al examen físico..."
                value={examenFisico}
                onChange={(e) => setExamenFisico(e.target.value)}
              />
            </div>
          </AccordionBlock>

          {/* Bloque 4: Diagnósticos */}
          {canDiagnosticos && (
            <AccordionBlock
              stepNumber={4}
              title="Diagnósticos"
              subtitle="Códigos CIE y diagnósticos"
              badgeText={diagnosticos.length > 0 ? `${diagnosticos.length}` : undefined}
              blockError={errorLocation?.blockKey === 'diagnosticos' ? error : null}
              open={openSections.diagnosticos}
              onToggle={() => toggleSection('diagnosticos')}
            >
              <div className="d-flex justify-content-end mb-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() =>
                    setDiagnosticos((prev) => [
                      ...prev,
                      {
                        codigo: '',
                        descripcion: '',
                        tipo: 'PRESUNTIVO',
                        fecha_diagnostico: today,
                        observaciones: '',
                      },
                    ])
                  }
                >
                  <i className="bi bi-plus-circle me-1" />
                  Agregar diagnóstico
                </button>
              </div>
              {diagnosticos.length === 0 ? (
                <p className="text-muted small mb-0">Sin diagnósticos cargados en esta consulta.</p>
              ) : (
                <div className="d-grid gap-3">
                  {diagnosticos.map((diag, idx) => (
                    <div key={idx} className="border rounded p-3 bg-light">
                      <div className="row g-2 align-items-end">
                        <div className="col-6 col-md-2">
                          <label className="form-label small fw-semibold">Código (CIE)</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={diag.codigo}
                            onChange={(e) =>
                              setDiagnosticos((prev) =>
                                prev.map((row, i) =>
                                  i === idx ? { ...row, codigo: e.target.value } : row
                                )
                              )
                            }
                          />
                        </div>
                        <div className="col-12 col-md-4">
                          <label
                            className="form-label small fw-semibold"
                            htmlFor={`nc-diag-desc-${idx}`}
                          >
                            Descripción *
                          </label>
                          <input
                            id={`nc-diag-desc-${idx}`}
                            type="text"
                            className="form-control form-control-sm"
                            value={diag.descripcion}
                            onChange={(e) =>
                              setDiagnosticos((prev) =>
                                prev.map((row, i) =>
                                  i === idx ? { ...row, descripcion: e.target.value } : row
                                )
                              )
                            }
                          />
                        </div>
                        <div className="col-6 col-md-3">
                          <label className="form-label small fw-semibold">Tipo</label>
                          <select
                            className="form-select form-select-sm"
                            value={diag.tipo}
                            onChange={(e) =>
                              setDiagnosticos((prev) =>
                                prev.map((row, i) =>
                                  i === idx
                                    ? { ...row, tipo: e.target.value as DiagnosticoTipo }
                                    : row
                                )
                              )
                            }
                          >
                            <option value="PRESUNTIVO">Presuntivo</option>
                            <option value="CONFIRMADO">Confirmado</option>
                            <option value="PRINCIPAL">Principal</option>
                            <option value="SECUNDARIO">Secundario</option>
                            <option value="DIFERENCIAL">Diferencial</option>
                            <option value="DESCARTADO">Descartado</option>
                          </select>
                        </div>
                        <div className="col-8 col-md-2">
                          <label className="form-label small fw-semibold">Fecha</label>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            value={diag.fecha_diagnostico}
                            onChange={(e) =>
                              setDiagnosticos((prev) =>
                                prev.map((row, i) =>
                                  i === idx
                                    ? { ...row, fecha_diagnostico: e.target.value }
                                    : row
                                )
                              )
                            }
                          />
                        </div>
                        <div className="col-4 col-md-1 text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger w-100"
                            aria-label="Eliminar diagnóstico"
                            onClick={() =>
                              setDiagnosticos((prev) => prev.filter((_, i) => i !== idx))
                            }
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionBlock>
          )}

          {/* Bloque 5: Antecedentes y alergias */}
          {canAntecedentes && (
            <AccordionBlock
              stepNumber={5}
              title="Antecedentes y alergias"
              subtitle="Antecedentes y alergias detectadas"
              badgeText={
                antecedentes.length + alergias.length > 0
                  ? `${antecedentes.length + alergias.length}`
                  : undefined
              }
              blockError={errorLocation?.blockKey === 'antecedentes' ? error : null}
              open={openSections.antecedentes}
              onToggle={() => toggleSection('antecedentes')}
            >
              <div className="d-flex flex-wrap justify-content-end gap-2 mb-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() =>
                    setAntecedentes((prev) => [
                      ...prev,
                      {
                        tipo: 'PERSONAL',
                        categoria: '',
                        descripcion: '',
                        fecha_antecedente: today,
                      },
                    ])
                  }
                >
                  + Antecedente
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() =>
                    setAlergias((prev) => [
                      ...prev,
                      {
                        alergeno: '',
                        tipo_reaccion: '',
                        gravedad: 'MODERADA',
                        fecha_deteccion: today,
                        observaciones: '',
                      },
                    ])
                  }
                >
                  + Alergia
                </button>
              </div>

              {antecedentes.map((ant, idx) => (
                <div key={`ant-${idx}`} className="border rounded p-3 bg-light mb-2">
                  <div className="row g-2 align-items-end">
                    <div className="col-6 col-md-3">
                      <label className="form-label small fw-semibold">Tipo</label>
                      <select
                        className="form-select form-select-sm"
                        value={ant.tipo}
                        onChange={(e) =>
                          setAntecedentes((prev) =>
                            prev.map((row, i) =>
                              i === idx
                                ? { ...row, tipo: e.target.value as AntecedenteTipo }
                                : row
                            )
                          )
                        }
                      >
                        <option value="PERSONAL">Personal</option>
                        <option value="FAMILIAR">Familiar</option>
                        <option value="PATOLOGICO">Patológico</option>
                        <option value="QUIRURGICO">Quirúrgico</option>
                        <option value="GINECOLOGICO">Ginecológico</option>
                        <option value="OTRO">Otro</option>
                      </select>
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label small fw-semibold">Categoría</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={ant.categoria}
                        onChange={(e) =>
                          setAntecedentes((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, categoria: e.target.value } : row
                            )
                          )
                        }
                      />
                    </div>
                    <div className="col-10 col-md-5">
                      <label
                        className="form-label small fw-semibold"
                        htmlFor={`nc-ant-desc-${idx}`}
                      >
                        Descripción *
                      </label>
                      <input
                        id={`nc-ant-desc-${idx}`}
                        type="text"
                        className="form-control form-control-sm"
                        value={ant.descripcion}
                        onChange={(e) =>
                          setAntecedentes((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, descripcion: e.target.value } : row
                            )
                          )
                        }
                      />
                    </div>
                    <div className="col-2 col-md-1 text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger w-100"
                        onClick={() =>
                          setAntecedentes((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {alergias.map((al, idx) => (
                <div key={`al-${idx}`} className="border border-danger-subtle rounded p-3 bg-danger-subtle bg-opacity-10 mb-2">
                  <div className="row g-2 align-items-end">
                    <div className="col-12 col-md-3">
                      <label className="form-label small fw-semibold" htmlFor={`nc-alergia-alergeno-${idx}`}>
                        Alérgeno *
                      </label>
                      <input
                        id={`nc-alergia-alergeno-${idx}`}
                        type="text"
                        className="form-control form-control-sm"
                        value={al.alergeno}
                        onChange={(e) =>
                          setAlergias((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, alergeno: e.target.value } : row
                            )
                          )
                        }
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold" htmlFor={`nc-alergia-reaccion-${idx}`}>
                        Reacción *
                      </label>
                      <input
                        id={`nc-alergia-reaccion-${idx}`}
                        type="text"
                        className="form-control form-control-sm"
                        value={al.tipo_reaccion}
                        onChange={(e) =>
                          setAlergias((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, tipo_reaccion: e.target.value } : row
                            )
                          )
                        }
                      />
                    </div>
                    <div className="col-6 col-md-2">
                      <label className="form-label small fw-semibold">Gravedad</label>
                      <select
                        className="form-select form-select-sm"
                        value={al.gravedad}
                        onChange={(e) =>
                          setAlergias((prev) =>
                            prev.map((row, i) =>
                              i === idx
                                ? { ...row, gravedad: e.target.value as AlergiaGravedad }
                                : row
                            )
                          )
                        }
                      >
                        <option value="LEVE">Leve</option>
                        <option value="MODERADA">Moderada</option>
                        <option value="GRAVE">Grave</option>
                        <option value="DESCONOCIDA">Desconocida</option>
                      </select>
                    </div>
                    <div className="col-4 col-md-2">
                      <label className="form-label small fw-semibold">Detección</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={al.fecha_deteccion}
                        onChange={(e) =>
                          setAlergias((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, fecha_deteccion: e.target.value } : row
                            )
                          )
                        }
                      />
                    </div>
                    <div className="col-2 col-md-1 text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger w-100"
                        onClick={() =>
                          setAlergias((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {antecedentes.length === 0 && alergias.length === 0 && (
                <p className="text-muted small mb-0">Sin antecedentes ni alergias nuevas en esta carga.</p>
              )}
            </AccordionBlock>
          )}

          {/* Bloque 6: Evolución */}
          {canEvoluciones && (
            <AccordionBlock
              stepNumber={6}
              title="Evolución"
              subtitle="Nota de evolución clínica"
              badgeText={evolucionTexto.trim() ? 'Completada' : undefined}
              open={openSections.evolucion}
              onToggle={() => toggleSection('evolucion')}
            >
              <div className="row g-3">
                <div className="col-12 col-md-8">
                  <label className="form-label fw-semibold" htmlFor="nc-evolucion">
                    Texto de evolución clínica
                  </label>
                  <textarea
                    id="nc-evolucion"
                    className="form-control"
                    rows={3}
                    maxLength={4000}
                    value={evolucionTexto}
                    onChange={(e) => setEvolucionTexto(e.target.value)}
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold" htmlFor="nc-evolucion-obs">
                    Observaciones de evolución
                  </label>
                  <textarea
                    id="nc-evolucion-obs"
                    className="form-control"
                    rows={3}
                    maxLength={2000}
                    value={evolucionObs}
                    onChange={(e) => setEvolucionObs(e.target.value)}
                  />
                </div>
              </div>
            </AccordionBlock>
          )}

          {/* Bloque 7: Tratamientos e indicaciones */}
          {canTratamientos && (
            <AccordionBlock
              stepNumber={7}
              title="Tratamientos e indicaciones"
              subtitle="Prescripciones y pautas"
              badgeText={tratamientos.length > 0 ? `${tratamientos.length}` : undefined}
              blockError={errorLocation?.blockKey === 'tratamientos' ? error : null}
              open={openSections.tratamientos}
              onToggle={() => toggleSection('tratamientos')}
            >
              <div className="d-flex justify-content-end mb-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() =>
                    setTratamientos((prev) => [
                      ...prev,
                      {
                        medicacion: '',
                        dosis: '',
                        frecuencia: '',
                        duracion: '',
                        indicaciones: '',
                        fecha_inicio: today,
                        fecha_fin: '',
                      },
                    ])
                  }
                >
                  <i className="bi bi-plus-circle me-1" />
                  Agregar tratamiento
                </button>
              </div>
              {tratamientos.length === 0 ? (
                <p className="text-muted small mb-0">Sin tratamientos prescriptos en esta consulta.</p>
              ) : (
                <div className="d-grid gap-3">
                  {tratamientos.map((trat, idx) => (
                    <div key={idx} className="border rounded p-3 bg-light">
                      <div className="row g-2 align-items-end">
                        <div className="col-12 col-md-3">
                          <label
                            className="form-label small fw-semibold"
                            htmlFor={`nc-trat-med-${idx}`}
                          >
                            Medicación *
                          </label>
                          <input
                            id={`nc-trat-med-${idx}`}
                            type="text"
                            className="form-control form-control-sm"
                            value={trat.medicacion}
                            onChange={(e) =>
                              setTratamientos((prev) =>
                                prev.map((row, i) =>
                                  i === idx ? { ...row, medicacion: e.target.value } : row
                                )
                              )
                            }
                          />
                        </div>
                        <div className="col-6 col-md-2">
                          <label
                            className="form-label small fw-semibold"
                            htmlFor={`nc-trat-dosis-${idx}`}
                          >
                            Dosis *
                          </label>
                          <input
                            id={`nc-trat-dosis-${idx}`}
                            type="text"
                            className="form-control form-control-sm"
                            value={trat.dosis}
                            onChange={(e) =>
                              setTratamientos((prev) =>
                                prev.map((row, i) =>
                                  i === idx ? { ...row, dosis: e.target.value } : row
                                )
                              )
                            }
                          />
                        </div>
                        <div className="col-6 col-md-3">
                          <label
                            className="form-label small fw-semibold"
                            htmlFor={`nc-trat-frec-${idx}`}
                          >
                            Frecuencia *
                          </label>
                          <input
                            id={`nc-trat-frec-${idx}`}
                            type="text"
                            className="form-control form-control-sm"
                            value={trat.frecuencia}
                            onChange={(e) =>
                              setTratamientos((prev) =>
                                prev.map((row, i) =>
                                  i === idx ? { ...row, frecuencia: e.target.value } : row
                                )
                              )
                            }
                          />
                        </div>
                        <div className="col-10 col-md-3">
                          <label className="form-label small fw-semibold">Duración / Indicaciones</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={trat.duracion}
                            onChange={(e) =>
                              setTratamientos((prev) =>
                                prev.map((row, i) =>
                                  i === idx ? { ...row, duracion: e.target.value } : row
                                )
                              )
                            }
                          />
                        </div>
                        <div className="col-2 col-md-1 text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger w-100"
                            onClick={() =>
                              setTratamientos((prev) => prev.filter((_, i) => i !== idx))
                            }
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionBlock>
          )}

          {/* Bloque 8: Estudios */}
          {canEstudios && (
            <AccordionBlock
              stepNumber={8}
              title="Estudios"
              subtitle="Solicitudes de laboratorio, imágenes o estudios complementarios"
              badgeText={estudios.length > 0 ? `${estudios.length}` : undefined}
              blockError={errorLocation?.blockKey === 'estudios' ? error : null}
              open={openSections.estudios}
              onToggle={() => toggleSection('estudios')}
            >
              <div className="d-flex justify-content-end mb-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() =>
                    setEstudios((prev) => [...prev, { tipo_estudio: '', descripcion: '' }])
                  }
                >
                  <i className="bi bi-plus-circle me-1" />
                  Solicitar estudio
                </button>
              </div>
              {estudios.length === 0 ? (
                <p className="text-muted small mb-0">Sin estudios solicitados en esta consulta.</p>
              ) : (
                <div className="d-grid gap-2">
                  {estudios.map((est, idx) => (
                    <div key={idx} className="border rounded p-3 bg-light">
                      <div className="row g-2 align-items-end">
                        <div className="col-12 col-md-4">
                          <label
                            className="form-label small fw-semibold"
                            htmlFor={`nc-est-tipo-${idx}`}
                          >
                            Tipo de estudio *
                          </label>
                          <input
                            id={`nc-est-tipo-${idx}`}
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Ej.: Laboratorio / Radiografía"
                            value={est.tipo_estudio}
                            onChange={(e) =>
                              setEstudios((prev) =>
                                prev.map((row, i) =>
                                  i === idx ? { ...row, tipo_estudio: e.target.value } : row
                                )
                              )
                            }
                          />
                        </div>
                        <div className="col-10 col-md-7">
                          <label
                            className="form-label small fw-semibold"
                            htmlFor={`nc-est-desc-${idx}`}
                          >
                            Indicaciones / descripción *
                          </label>
                          <input
                            id={`nc-est-desc-${idx}`}
                            type="text"
                            className="form-control form-control-sm"
                            value={est.descripcion}
                            onChange={(e) =>
                              setEstudios((prev) =>
                                prev.map((row, i) =>
                                  i === idx ? { ...row, descripcion: e.target.value } : row
                                )
                              )
                            }
                          />
                        </div>
                        <div className="col-2 col-md-1 text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger w-100"
                            onClick={() =>
                              setEstudios((prev) => prev.filter((_, i) => i !== idx))
                            }
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionBlock>
          )}

          {/* Bloque 9: Observaciones adicionales */}
          <AccordionBlock
            stepNumber={9}
            title="Observaciones adicionales"
            subtitle="Notas complementarias"
            badgeText={observaciones.trim() || observacionesGenerales.trim() ? 'Con notas' : undefined}
            open={openSections.observaciones}
            onToggle={() => toggleSection('observaciones')}
          >
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold" htmlFor="nc-obs">
                  Observaciones de la consulta
                </label>
                <textarea
                  id="nc-obs"
                  className="form-control"
                  rows={2}
                  maxLength={4000}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold" htmlFor="nc-obs-gral">
                  Observaciones generales de historia clínica (si inicia HC)
                </label>
                <textarea
                  id="nc-obs-gral"
                  className="form-control"
                  rows={2}
                  maxLength={4000}
                  value={observacionesGenerales}
                  onChange={(e) => setObservacionesGenerales(e.target.value)}
                />
              </div>
            </div>
          </AccordionBlock>

          <div className="hc-card p-3 hc-form-sticky-actions d-flex flex-column gap-2">
            {error && error !== turnoDiscrepancyError && (
              <ActionInlineFeedback
                variant="error"
                message={error}
                blockLabel={errorLocation?.blockLabel}
                actionLabel={errorLocation?.fieldId ? 'Ir al campo' : undefined}
                onAction={
                  errorLocation?.fieldId
                    ? () => {
                        if (errorLocation.blockKey) {
                          setOpenSections((prev) => ({
                            ...prev,
                            [errorLocation.blockKey!]: true,
                          }));
                        }
                        focusFieldById(errorLocation.fieldId!, 60);
                      }
                    : undefined
                }
                onDismiss={() => {
                  setError(null);
                  setErrorLocation(null);
                }}
              />
            )}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <span className="small text-muted">
                {isFutureFechaAtencion || isBeforeTurnoStart
                  ? 'Podés guardar un borrador anticipado vinculado al turno; la firma definitiva se habilita desde el horario de atención.'
                  : 'Guardá en borrador para continuar luego o firmá para cerrar la consulta.'}
              </span>
              <div className="d-flex flex-wrap gap-2 ms-auto">
                <button
                  type="button"
                  data-testid="hc-save-draft-btn"
                  className="btn btn-outline-secondary"
                  disabled={submitting || Boolean(turnoDiscrepancyError)}
                  onClick={() => {
                    void executeSave(false);
                  }}
                >
                  <i className="bi bi-save me-1" />
                  {submitting
                    ? 'Guardando...'
                    : editingConsultaId
                      ? 'Actualizar borrador'
                      : 'Guardar como borrador'}
                </button>
                <button
                  type="button"
                  data-testid="hc-save-sign-btn"
                  className="btn btn-success"
                  disabled={submitting || Boolean(turnoDiscrepancyError)}
                  onClick={() => {
                    setError(null);
                    setErrorLocation(null);
                    if (validateBeforeSave(true)) {
                      setConfirmSignOpen(true);
                    }
                  }}
                >
                  <i className="bi bi-patch-check me-1" />
                  {editingConsultaId ? 'Guardar y firmar borrador' : 'Guardar y firmar consulta'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      <ConfirmationModal
        open={confirmSignOpen}
        title="Firmar consulta clínica"
        subtitle="Esta acción vuelve definitivo el registro."
        message="Al firmar la consulta médica, su contenido clínico quedará inmutable y auditado. Posteriores correcciones deberán registrarse como evoluciones o rectificaciones trazables."
        confirmText="Sí, guardar y firmar"
        variant="success"
        icon="bi-patch-check"
        loading={submitting}
        onClose={() => setConfirmSignOpen(false)}
        onConfirm={() => {
          void executeSave(true);
        }}
      />

      <ConfirmationModal
        open={Boolean(pendingExit)}
        title="Cambios clínicos sin guardar"
        subtitle="Tenés modificaciones clínicas sin guardar en esta consulta."
        message="¿Deseás salir descartando los cambios realizados, o guardar un borrador antes de salir para no perder tu trabajo?"
        confirmText="Salir sin guardar"
        cancelText="Seguir editando"
        variant="warning"
        icon="bi-exclamation-triangle"
        loading={submitting}
        detail={
          <div className="d-flex justify-content-end pt-2">
            <button
              type="button"
              className="btn btn-sm btn-success"
              disabled={submitting || Boolean(turnoDiscrepancyError)}
              onClick={async () => {
                setPendingExit(null);
                await executeSave(false);
              }}
            >
              <i className="bi bi-save me-1" />
              Guardar como borrador y salir
            </button>
          </div>
        }
        onClose={() => setPendingExit(null)}
        onConfirm={() => {
          if (pendingExit) {
            const target = pendingExit;
            setPendingExit(null);
            savedSuccessfullyRef.current = true;
            navigate(target.to, { state: target.state });
          }
        }}
      />
    </div>
  );
}
