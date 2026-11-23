import { agendaDateTime } from './turno-time.js';

export const isAdultOnDate = (birthDate: string, today: string) => {
  const cutoff = new Date(`${today}T12:00:00-03:00`);
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return birthDate <= agendaDateTime(cutoff).date;
};
