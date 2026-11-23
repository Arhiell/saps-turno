import type { NewsInput } from '../types/public-content.types';

// Indica si una fecha pasada pertenece a la publicación original
// y puede conservarse sin exigir que vuelva a estar en el futuro.
export function retainedNewsDate(
  value: NewsInput,
  original: NewsInput | null,
  field: 'fecha_publicacion' | 'fecha_finalizacion'
) {
  return (
    !!value[field] &&
    !!original?.[field] &&
    Date.parse(value[field]) === Date.parse(original[field]) &&
    !(value.estado === 'PUBLICADA' && original.estado !== 'PUBLICADA')
  );
}

// Valida las fechas de publicación y finalización antes de guardar.
export function newsScheduleError(
  value: NewsInput,
  original: NewsInput | null,
  now = Date.now()
) {
  for (const field of ['fecha_publicacion', 'fecha_finalizacion'] as const) {
    // Las fechas nuevas o modificadas deben ser posteriores al momento actual.
    if (
      value[field] &&
      Date.parse(value[field]) <= now &&
      !retainedNewsDate(value, original, field)
    ) {
      const label =
        field === 'fecha_publicacion' ? 'publicación' : 'finalización';

      return `La fecha y hora de ${label} deben ser posteriores al momento actual.`;
    }
  }

  // La finalización siempre debe ocurrir después de la publicación.
  // Si no existe fecha de publicación, se compara contra el momento actual.
  if (
    value.fecha_finalizacion &&
    Date.parse(value.fecha_finalizacion) <=
      (value.fecha_publicacion
        ? Date.parse(value.fecha_publicacion)
        : now)
  ) {
    return 'La finalización debe ser posterior a la publicación.';
  }

  return null;
}