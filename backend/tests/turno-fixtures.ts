import { row, queue, drained } from "./patient-fixtures.js";
import { agendaDateTime } from "../src/utils/turno-time.js";
export { queue, drained };
export const id = "11111111-1111-4111-8111-111111111111";
export const user = { id_usuario: id, email: "test@example.com", nombre_usuario: "test", rol: "SUPER_ADMIN" };
export const input = { id_paciente: row.id_paciente, id_profesional: id, id_salita: id,
  id_especialidad: id, fecha_hora_inicio: "2099-10-05T10:00:00-03:00" };
export const state = { id_estado: id, codigo: "SOLICITADO", nombre: "Solicitado", activo: true,
  ocupa_agenda: true, impide_otro_misma_especialidad: true, es_estado_final: false };
export const horario = { id_horario: id, id_profesional: id, id_salita: id, id_especialidad: id,
  dia_semana: agendaDateTime(input.fecha_hora_inicio).weekday, hora_inicio: "10:00:00", hora_fin: "14:00:00",
  duracion_turno_minutos: 20, cupo_maximo_diario: null, activo: true,
  vigencia_desde: "2020-01-01", vigencia_hasta: null };
export const turno = { ...input, id_horario: id, id_estado: id, estado: state, id_turno: id,
  codigo_turno: "TEST", version: 1, ocupa_agenda: true, impide_otro_misma_especialidad: true,
  fecha_hora_inicio: "2099-10-05T13:00:00.000Z", fecha_hora_fin: "2099-10-05T13:20:00.000Z" };
// Todos los accesos de estas pruebas se interceptan antes de salir del proceso.
export const entities = () => [
  { table: "pacientes", result: [row] },
  { table: "profesionales", result: [{ activo: true }] },
  { table: "salitas", result: [{ activo: true }] },
  { table: "especialidades", result: [{ activo: true }] },
  { table: "profesional_especialidad", result: [{ id_especialidad: id, activo: true, fecha_desde: "2020-01-01", fecha_hasta: null }] },
  { table: "profesional_salita", result: [{ id_salita: id, activo: true, fecha_desde: "2020-01-01", fecha_hasta: null }] }
];
export const freeSlot = () => [
  { table: "bloqueos_agenda", result: [] },
  { table: "turnos", result: [] }, { table: "turnos", result: [] },
  { table: "turnos", result: [] }, { table: "sanciones", result: [] }
];
