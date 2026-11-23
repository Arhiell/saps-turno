// Misma zona municipal que usa validar_turno() en PostgreSQL.
export const agendaZone = "America/Argentina/Buenos_Aires";

const formatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: agendaZone,
  year: "numeric", 
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit", 
  minute: "2-digit", 
  second: "2-digit", 
  hourCycle: "h23"
});

export const agendaDateTime = (instant: string | Date) => {

  const parts = Object.fromEntries(formatter.formatToParts(new Date(instant))
    .map(part => [part.type, part.value]));

  const date = `${parts.year}-${parts.month}-${parts.day}`;

  return { 
    date, 
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
    weekday: new Date(`${date}T12:00:00Z`).getUTCDay() || 7 
  };
};

// Calcula medianoches locales sin depender de la zona del proceso Node.
export const agendaDayBounds = (date: string) => {
  const midnight = new Date(`${date}T00:00:00Z`);

  const local = agendaDateTime(midnight);

  const offset = Date.parse(`${local.date}T${local.time}Z`) - midnight.getTime();

  const start = new Date(midnight.getTime() - offset);

  const next = new Date(midnight.getTime() + 86400000);

  const nextLocal = agendaDateTime(next);

  const nextOffset = Date.parse(
    `${nextLocal.date}T${nextLocal.time}Z`
  ) - next.getTime();

  return { 
    start: start.toISOString(), 
    end: new Date(next.getTime() - nextOffset).toISOString() 
  };
};
