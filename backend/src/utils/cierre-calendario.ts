
import type { CierreInput } from '../validators/cierre-calendario.validator.js';

import { timeToSeconds } from './time.js';

// Verifica si un cierre institucional afecta a un turno.
// Los turnos de la API pertenecen a una misma fecha civil argentina.
export const cierreAfecta = (
  c: CierreInput,
  salita: string,
  fecha: string,
  inicio: string,
  fin: string
) =>
  // Comprueba que el cierre esté activo y corresponda a la salita.
  c.activo &&
  (
    c.alcance === 'GLOBAL' ||
    c.id_salita === salita
  ) &&

  // Verifica que la fecha del turno esté dentro del período de cierre.
  c.fecha_inicio <= fecha &&
  c.fecha_fin >= fecha &&

  // Comprueba si el cierre abarca todo el día o coincide con el horario.
  (
    c.dia_completo ||
    (
      timeToSeconds(inicio) < timeToSeconds(c.hora_fin!) &&
      timeToSeconds(fin) > timeToSeconds(c.hora_inicio!)
    )
  );

// Obtiene la etiqueta correspondiente al tipo de cierre.
export const cierreEtiqueta = (
  c: Pick<CierreInput, 'tipo'>
) =>
  // Identifica los feriados nacionales.
  c.tipo.startsWith('FERIADO_')
    ? 'FERIADO'

    // Identifica los días no laborables y asuetos.
    : ['DIA_NO_LABORABLE', 'ASUETO'].includes(c.tipo)
      ? 'NO LABORABLE'

      // Identifica los demás cierres institucionales.
      : 'SALITA CERRADA';
