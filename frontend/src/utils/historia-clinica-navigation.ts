export type ClinicalOrigin =
  | 'mi-agenda'
  | 'mis-pacientes'
  | 'buscador'
  | 'derivaciones'
  | 'menu';

export interface ClinicalNavState {
  origin?: ClinicalOrigin;
  returnTo?: string;
  returnLabel?: string;
  turnoId?: string;
  turnoFecha?: string;
  patientSummary?: {
    id_paciente: string;
    dni?: string;
    nombres: string;
    apellidos: string;
  };
  dossierReturnTo?: string;
  notice?: string;
  createdConsultaId?: string;
  createdConsultaEstado?: 'BORRADOR' | 'FIRMADA';
}

export const buildBuscadorUrl = (params: {
  search?: string;
  salita?: string;
  page?: number;
}): string => {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.salita) qs.set('salita', params.salita);
  if (params.page && params.page > 1) qs.set('page', String(params.page));
  const query = qs.toString();
  return `/historia-clinica${query ? `?${query}` : ''}`;
};

export const buildAgendaReturnUrl = (options: {
  mode: 'history' | 'today';
  fecha?: string;
  fechaHasta?: string;
  filterRange?: boolean;
  estadoFilter?: string;
  page?: number;
}): string => {
  const qs = new URLSearchParams();

  if (options.mode === 'history') {
    if (options.filterRange) {
      qs.set('rango', '1');
      if (options.fecha) qs.set('fecha', options.fecha);
      if (options.fechaHasta) qs.set('hasta', options.fechaHasta);
    }
  }

  if (options.estadoFilter && options.estadoFilter !== 'TODOS') {
    qs.set('estado', options.estadoFilter);
  }

  if (options.page && options.page > 1) {
    qs.set('page', String(options.page));
  }

  const base = options.mode === 'today' ? '/mis-pacientes' : '/mi-agenda';
  const query = qs.toString();
  return `${base}${query ? `?${query}` : ''}`;
};

export const resolvePrimaryBackTarget = (
  state: ClinicalNavState | null | undefined,
  fallbackUrl = '/historia-clinica',
  fallbackLabel = 'Volver al buscador'
): { to: string; label: string } => {
  if (state?.returnTo && state.returnTo.startsWith('/')) {
    return {
      to: state.returnTo,
      label: state.returnLabel || fallbackLabel,
    };
  }
  if (typeof window !== 'undefined') {
    const saved = sessionStorage.getItem('saps_last_clinical_search');
    if (saved && saved.startsWith('/historia-clinica')) {
      return {
        to: saved,
        label: fallbackLabel,
      };
    }
  }
  return {
    to: fallbackUrl,
    label: fallbackLabel,
  };
};

export type ConsultaSectionKey =
  | 'datos'
  | 'motivo'
  | 'examen'
  | 'diagnosticos'
  | 'antecedentes'
  | 'evolucion'
  | 'tratamientos'
  | 'estudios'
  | 'observaciones';

export type ConsultaBlockViewMode = 'obligatorios' | 'todos' | 'personalizado';

export const MANDATORY_CONSULTA_SECTIONS: readonly ConsultaSectionKey[] = [
  'datos',
  'motivo',
];

export const OPTIONAL_CONSULTA_SECTIONS: readonly ConsultaSectionKey[] = [
  'examen',
  'diagnosticos',
  'antecedentes',
  'evolucion',
  'tratamientos',
  'estudios',
  'observaciones',
];

export const buildConsultaSectionsForMode = (
  mode: 'obligatorios' | 'todos',
  enabledOptionalKeys: readonly ConsultaSectionKey[] = OPTIONAL_CONSULTA_SECTIONS
): Record<ConsultaSectionKey, boolean> => {
  const expandOptional = mode === 'todos';
  const enabledSet = new Set(enabledOptionalKeys);
  return {
    datos: true,
    motivo: true,
    examen: expandOptional && enabledSet.has('examen'),
    diagnosticos: expandOptional && enabledSet.has('diagnosticos'),
    antecedentes: expandOptional && enabledSet.has('antecedentes'),
    evolucion: expandOptional && enabledSet.has('evolucion'),
    tratamientos: expandOptional && enabledSet.has('tratamientos'),
    estudios: expandOptional && enabledSet.has('estudios'),
    observaciones: expandOptional && enabledSet.has('observaciones'),
  };
};

export const resolveConsultaBlockViewMode = (
  openSections: Record<ConsultaSectionKey, boolean>,
  enabledOptionalKeys: readonly ConsultaSectionKey[] = OPTIONAL_CONSULTA_SECTIONS
): {
  mode: ConsultaBlockViewMode;
  openOptionalCount: number;
  totalOptionalCount: number;
} => {
  const openOptionalCount = enabledOptionalKeys.filter((k) => openSections[k]).length;
  const totalOptionalCount = enabledOptionalKeys.length;
  const mandatoryOpen = MANDATORY_CONSULTA_SECTIONS.every((k) => openSections[k]);

  if (mandatoryOpen && openOptionalCount === 0) {
    return { mode: 'obligatorios', openOptionalCount, totalOptionalCount };
  }
  if (mandatoryOpen && totalOptionalCount > 0 && openOptionalCount === totalOptionalCount) {
    return { mode: 'todos', openOptionalCount, totalOptionalCount };
  }
  return { mode: 'personalizado', openOptionalCount, totalOptionalCount };
};
