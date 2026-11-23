import { agendaDateTime } from './turno-time.js';
import { AppError } from './app-error.js';

// Suma días a una fecha y devuelve el resultado en formato YYYY-MM-DD.
const addDays = (
  date: string,
  days: number
) =>
  new Date(
    Date.parse(`${date}T12:00:00Z`) +
      days * 86400000
  )
    .toISOString()
    .slice(0, 10);

// Calcula la ventana de reserva de turnos.
// La semana siguiente se habilita el sábado a las 12:00 de Argentina.
// Conserva los turnos restantes del fin de semana en curso.
export const bookingWindow = (
  now = new Date()
) => {
  const local = agendaDateTime(now);

  // Comprueba si ya se habilitó la siguiente semana.
  const nextWeekOpen =
    local.weekday === 7 ||
    (
      local.weekday === 6 &&
      local.time >= '12:00:00'
    );

  // Calcula el último día habilitado para reservar.
  const end = addDays(
    local.date,
    7 - local.weekday + (nextWeekOpen ? 7 : 0)
  );

  // Calcula el sábado de la próxima apertura.
  const nextSaturday = addDays(
    local.date,
    6 - local.weekday + (nextWeekOpen ? 7 : 0)
  );

  // Genera todas las fechas comprendidas en la ventana.
  const dates: string[] = [];

  for (
    let date = local.date;
    date <= end;
    date = addDays(date, 1)
  ) {
    dates.push(date);
  }

  // Devuelve el período habilitado y la próxima apertura.
  return {
    desde: local.date,
    hasta: end,
    proxima_apertura: `${nextSaturday}T12:00:00-03:00`,
    fechas: dates,
  };
};

// Verifica que la fecha solicitada esté dentro de la ventana de reserva.
export const assertBookingDate = (
  date: string,
  now = new Date()
) => {
  const window = bookingWindow(now);

  // Rechaza fechas anteriores o posteriores al período habilitado.
  if (
    date < window.desde ||
    date > window.hasta
  ) {
    throw new AppError(
      'La fecha no está habilitada. Los turnos de la próxima semana se abren el sábado a las 12:00.',
      409,
      'BOOKING_WINDOW_CLOSED',
      window
    );
  }
};