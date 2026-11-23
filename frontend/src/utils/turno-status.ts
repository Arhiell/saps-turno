// Comparte los colores existentes en todas las vistas de turnos.
export const getEstadoClass = (estado: string) => {
  const variants: Record<string, string> = {
    CONFIRMADO: 'confirmado',
    SOLICITADO: 'solicitado',
    EN_ESPERA: 'espera',
    ATENDIDO: 'atendido',
    CANCELADO: 'cancelado',
    NO_ASISTIO: 'no-asistio',
    REPROGRAMADO: 'reprogramado',
  };
  return `turno-badge${variants[estado] ? ` turno-badge-${variants[estado]}` : ''}`;
};

// Genera una referencia corta discreta de 6 caracteres a partir del código o UUID del turno (ej: #D9ACD7).
export const formatShortRef = (idOrCode?: string | null): string => {
  if (!idOrCode) return '';
  const clean = idOrCode.replace(/[^a-zA-Z0-9]/g, '');
  return clean.slice(-6).toUpperCase();
};
