// Escapa los comodines de ILIKE para tratarlos como caracteres literales.
export const literalLikePattern = (
  value: string
): string =>
  value.replace(
    /[\\%_]/g,
    '\\$&'
  );