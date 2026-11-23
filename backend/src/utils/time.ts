/** Compara horas HH:mm y HH:mm:ss, 
 * incluyendo valores TIME de PostgreSQL. */
export const timeToSeconds = (time: string): number => {
  const [hours, minutes, seconds = 0] = time.split(":").map(Number);
  return hours! * 3600 + minutes! * 60 + seconds;
};
