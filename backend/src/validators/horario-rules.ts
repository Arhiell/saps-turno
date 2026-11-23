
import { timeToSeconds } from "../utils/time.js";
import { AppError } from '../utils/app-error.js';

// Valida el rango horario y el período de vigencia.
export const validarHorario = (
  horaInicio: string,
  horaFin: string,
  vigenciaDesde?: string,
  vigenciaHasta?: string | null
) => {
  // Verifica que la hora de inicio sea anterior a la hora de fin.
  if (timeToSeconds(horaInicio) >= timeToSeconds(horaFin)) {
    throw new AppError(
      "La hora de inicio debe ser menor que la hora de fin",
      400
    );
  }

  // Verifica que la fecha de fin no sea anterior a la fecha de inicio.
  if (
    vigenciaHasta !== undefined &&
    vigenciaHasta !== null &&
    vigenciaDesde !== undefined &&
    vigenciaHasta < vigenciaDesde
  ) {
    throw new AppError(
      "La fecha de vigencia hasta debe ser mayor o igual a la fecha de vigencia desde",
      400
    );
  }
};
