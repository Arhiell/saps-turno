
import { z } from 'zod';

// Fuente fija controlada por el servidor; no acepta URLs del cliente.
export const argentinaDatosSource = 'https://api.argentinadatos.com/v1/feriados';

// Valida la estructura de los feriados obtenidos.
const feriadoSchema = z.object({
  fecha: z.string().date(),
  nombre: z.string().trim().min(3).max(150),
  tipo: z.enum([
    'inamovible',
    'trasladable',
    'puente',
  ]),
});

// Tipo inferido del esquema de feriados.
export type FeriadoExterno = z.infer<typeof feriadoSchema>;

// Consulta y valida los feriados correspondientes a un año.
export const fetchFeriados = async (
  year: number
): Promise<FeriadoExterno[]> => {
  // Verifica que el año solicitado esté dentro del rango permitido.
  if (
    !Number.isInteger(year) ||
    year < 2016 ||
    year > 9999
  ) {
    throw new Error('Año no admitido');
  }

  // Consulta la fuente externa con un tiempo máximo de espera.
  const response = await fetch(
    `${argentinaDatosSource}/${year}`,
    {
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
      headers: {
        Accept: 'application/json',
      },
    }
  );

  // Comprueba que la respuesta sea válida y contenga datos.
  if (!response.ok || !response.body) {
    throw new Error(
      `Fuente no disponible (HTTP ${response.status})`
    );
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];

  let size = 0;

  // Lee la respuesta por fragmentos y limita su tamaño.
  try {
    while (true) {
      const part = await reader.read();

      if (part.done) {
        break;
      }

      size += part.value.length;

      if (size > 250_000) {
        throw new Error('Respuesta demasiado grande');
      }

      chunks.push(part.value);
    }
  } finally {
    // Libera el lector al finalizar la lectura.
    await reader.cancel();
  }

  // Convierte la respuesta JSON y valida los registros recibidos.
  const rows = z.array(feriadoSchema)
    .min(1)
    .max(366)
    .parse(
      JSON.parse(
        Buffer.concat(chunks).toString('utf8')
      )
    );

  // Verifica que todos los feriados correspondan al año solicitado.
  if (
    rows.some(
      (row) => Number(row.fecha.slice(0, 4)) !== year
    )
  ) {
    throw new Error('La fuente respondió otro año');
  }

  // Elimina duplicados y mantiene un orden determinista.
  return [
    ...new Map(
      rows.map((row) => [
        `${row.fecha}/${row.nombre}/${row.tipo}`,
        row,
      ])
    ).values(),
  ].sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      a.nombre.localeCompare(b.nombre) ||
      a.tipo.localeCompare(b.tipo)
  );
};
