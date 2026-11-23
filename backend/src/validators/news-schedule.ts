// Datos necesarios para validar la programación de una noticia.
type Schedule = {
  fecha_publicacion: string | null;
  fecha_finalizacion: string | null;
  estado: string;
};

// Valida las fechas de publicación y finalización de una noticia.
export function newsScheduleError(
  input: Schedule,
  previous?: Schedule | null,
  now = Date.now()
): string | null {
  // Verifica que las fechas nuevas o modificadas sean futuras.
  for (
    const field of [
      'fecha_publicacion',
      'fecha_finalizacion',
    ] as const
  ) {
    const date =
      input[field];

    const unchanged =
      date &&
      previous?.[field] &&
      Date.parse(date) ===
        Date.parse(
          previous[field]
        );

    const publishing =
      input.estado ===
        'PUBLICADA' &&
      previous?.estado !==
        'PUBLICADA';

    if (
      date &&
      Date.parse(date) <=
        now &&
      (
        !unchanged ||
        publishing
      )
    ) {
      const fieldName =
        field ===
        'fecha_publicacion'
          ? 'publicación'
          : 'finalización';

      return `La fecha y hora de ${fieldName} deben ser posteriores al momento actual.`;
    }
  }

  // La finalización siempre debe ocurrir después de la publicación.
  if (
    input.fecha_finalizacion &&
    Date.parse(
      input.fecha_finalizacion
    ) <=
      Date.parse(
        input.fecha_publicacion ??
          new Date(
            now
          ).toISOString()
      )
  ) {
    return 'La finalización debe ser posterior a la publicación.';
  }

  return null;
}