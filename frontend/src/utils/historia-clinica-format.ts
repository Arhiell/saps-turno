import type {
  AlergiaGravedad,
  CatalogEspecialidadItem,
  CatalogProfesionalItem,
  CatalogSalitaItem,
  ConsultaEstado,
  DerivacionEstado,
  EstudioEstado,
  EvolucionEstado,
} from '../types/historia-clinica.types';

const ARGENTINA_TZ = 'America/Argentina/Buenos_Aires';

export const formatArgentinaDate = (value?: string | null): string => {
  if (!value) return '—';
  // Si viene YYYY-MM-DD sin hora, formatear directamente DD/MM/YYYY para evitar desfase UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ARGENTINA_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

export const formatArgentinaDateTime = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ARGENTINA_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const getTodayArgentinaIsoDate = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ARGENTINA_TZ }).format(new Date());

export const getNowArgentinaDateTimeLocal = (): string => {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: ARGENTINA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

export const toArgentinaOffsetIso = (localDateTime: string): string => {
  const trimmed = localDateTime.trim();
  if (!trimmed) return trimmed;
  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00-03:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}-03:00`;
  return trimmed;
};

export const calculateAgeLabel = (birthDate?: string | null): string => {
  if (!birthDate) return '—';
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? `${birthDate}T00:00:00-03:00` : birthDate
  );
  if (Number.isNaN(date.getTime())) return '—';

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }

  return age >= 0 ? `${age} años` : '—';
};

export const consultaEstadoBadgeClass = (estado: ConsultaEstado | string): string => {
  switch (estado) {
    case 'FIRMADA':
      return 'badge text-bg-success';
    case 'BORRADOR':
      return 'badge text-bg-warning';
    case 'ANULADA':
      return 'badge text-bg-danger';
    default:
      return 'badge text-bg-secondary';
  }
};

export const evolucionEstadoBadgeClass = (estado: EvolucionEstado | string): string => {
  switch (estado) {
    case 'FIRMADA':
      return 'badge text-bg-success';
    case 'RECTIFICADA':
      return 'badge text-bg-primary';
    case 'BORRADOR':
      return 'badge text-bg-warning';
    case 'ANULADA':
      return 'badge text-bg-danger';
    default:
      return 'badge text-bg-secondary';
  }
};

export const estudioEstadoBadgeClass = (estado: EstudioEstado | string): string => {
  switch (estado) {
    case 'COMPLETADO':
      return 'badge text-bg-success';
    case 'EN_PROCESO':
      return 'badge text-bg-info';
    case 'SOLICITADO':
      return 'badge text-bg-warning';
    case 'CANCELADO':
      return 'badge text-bg-danger';
    default:
      return 'badge text-bg-secondary';
  }
};

export const derivacionEstadoBadgeClass = (estado: DerivacionEstado | string): string => {
  switch (estado) {
    case 'AUTORIZADA':
      return 'badge text-bg-success';
    case 'PENDIENTE':
      return 'badge text-bg-warning';
    case 'RECHAZADA':
    case 'REVOCADA':
      return 'badge text-bg-danger';
    case 'VENCIDA':
      return 'badge text-bg-secondary';
    default:
      return 'badge text-bg-light';
  }
};

export const alergiaGravedadBadgeClass = (gravedad: AlergiaGravedad | string): string => {
  switch (gravedad) {
    case 'GRAVE':
      return 'badge text-bg-danger';
    case 'MODERADA':
      return 'badge text-bg-warning';
    case 'LEVE':
      return 'badge text-bg-info';
    default:
      return 'badge text-bg-secondary';
  }
};

export const findSalitaNombre = (
  salitas: CatalogSalitaItem[],
  id?: string | null
): string => {
  if (!id) return '—';
  return salitas.find((s) => s.id_salita === id)?.nombre ?? id;
};

export const findEspecialidadNombre = (
  especialidades: CatalogEspecialidadItem[],
  id?: string | null
): string => {
  if (!id) return '—';
  return especialidades.find((e) => e.id_especialidad === id)?.nombre ?? id;
};

export const findProfesionalNombre = (
  profesionales: CatalogProfesionalItem[],
  id?: string | null
): string => {
  if (!id) return '—';
  const found = profesionales.find((p) => p.id_profesional === id);
  return found ? `${found.apellidos}, ${found.nombres} (Mat. ${found.matricula})` : id;
};

export const isoToArgentinaDateTimeLocal = (isoString?: string | null): string => {
  if (!isoString) return '';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: ARGENTINA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(parsed)
    .replace(' ', 'T');
};

export const formatSignedConsultaNotice = (turnoActualizado?: boolean): string =>
  `Consulta médica firmada correctamente. El registro quedó protegido contra modificaciones directas; cualquier corrección posterior debe realizarse mediante evolución o rectificación trazable.${
    turnoActualizado ? ' El turno vinculado pasó automáticamente a estado Atendido.' : ''
  }`;
