import {
  fetchMunicipalNews,
  municipalSource,
  type MunicipalNews,
} from '../repositories/municipal-news.repository.js';

// Resultado normalizado de la consulta de noticias municipales.
interface MunicipalResult {
  items: MunicipalNews[];
  estado: 'success' | 'empty' | 'error';
  fuente: string;
  actualizacion: string | null;
  desactualizado: boolean;
}

// Último resultado almacenado en caché.
let cached: MunicipalResult | undefined;

// Momento hasta el cual la caché sigue vigente.
let expires = 0;

// Solicitud actualmente en ejecución.
// Permite reutilizarla cuando llegan varias peticiones simultáneas.
let pending: Promise<MunicipalResult> | undefined;

// Agrupa solicitudes simultáneas.
// Noticias válidas: 30 minutos de caché.
// Errores: 5 minutos de caché.
export const municipalNews =
  async (): Promise<MunicipalResult> => {
    // Devuelve la caché mientras continúe vigente.
    if (
      cached &&
      Date.now() < expires
    ) {
      return cached;
    }

    // Reutiliza una consulta que ya se encuentra en ejecución.
    if (pending) {
      return pending;
    }

    pending =
      (async () => {
        try {
          const items =
            await fetchMunicipalNews();

          cached = {
            items,
            estado:
              items.length
                ? 'success'
                : 'empty',
            fuente:
              municipalSource,
            actualizacion:
              new Date().toISOString(),
            desactualizado:
              false,
          };

          // Mantiene el resultado exitoso durante 30 minutos.
          expires =
            Date.now() +
            30 * 60_000;
        } catch {
          // Permite conservar información previa
          // siempre que no tenga más de 24 horas.
          const recent =
            cached?.actualizacion &&
            Date.now() -
              Date.parse(
                cached.actualizacion
              ) <
              24 *
                60 *
                60_000;

          cached = {
            items:
              recent
                ? cached!.items
                : [],
            estado:
              'error',
            fuente:
              municipalSource,
            actualizacion:
              cached?.actualizacion ??
              null,
            desactualizado:
              Boolean(
                recent
              ),
          };

          // Evita consultar repetidamente una fuente con errores.
          expires =
            Date.now() +
            5 * 60_000;
        }

        return cached;
      })();

    try {
      return await pending;
    } finally {
      // Libera la referencia una vez finalizada la solicitud.
      pending =
        undefined;
    }
  };