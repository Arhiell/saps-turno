// Define los días de la semana para configurar los horarios de atención.
export const scheduleDays = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

// Define la estructura de una franja horaria semanal.
export interface WeeklySlot {
  key: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}

// Genera una nueva franja horaria con valores predeterminados.
export const newWeeklySlot = (
  day: number,
  afternoon = false
): WeeklySlot => ({
  key: crypto.randomUUID(),
  dia_semana: day,
  hora_inicio: afternoon ? '14:00' : '08:00',
  hora_fin: afternoon ? '18:00' : '12:00',
});