import { countDashboardRecords, countDashboardTurnos, findDashboardActivity } from '../repositories/dashboard.repository.js';
import { agendaDateTime, agendaDayBounds, agendaZone } from '../utils/turno-time.js';

async function recordTotals(table: string, role?: string) {
  const [activos, inactivos] = await Promise.all([
    countDashboardRecords(table, true, role), countDashboardRecords(table, false, role),
  ]);
  return { total: activos + inactivos, activos, inactivos };
}

export async function getDashboardSummary(now = new Date()) {
  const fecha = agendaDateTime(now).date;
  const { start, end } = agendaDayBounds(fecha);
  const states = ['SOLICITADO', 'CONFIRMADO', 'EN_ESPERA', 'ATENDIDO', 'CANCELADO', 'NO_ASISTIO', 'REPROGRAMADO'] as const;
  const [salitas, administradores, superadministradores, profesionales, pacientes, registrados, programados, counts, activity] = await Promise.all([
    recordTotals('salitas'), recordTotals('usuarios', 'ADMIN_SALITA'),
    recordTotals('usuarios', 'SUPER_ADMIN'), recordTotals('profesionales'), recordTotals('pacientes'),
    countDashboardTurnos(start, end, 'fecha_solicitud'),
    countDashboardTurnos(start, end, 'fecha_hora_inicio'),
    Promise.all(states.map(state => countDashboardTurnos(start, end, 'fecha_hora_inicio', state))),
    // La auditoría puede fallar sin ocultar los indicadores operativos.
    findDashboardActivity().then(data => ({ data, disponible: true }), () => ({ data: [], disponible: false })),
  ]);
  const por_estado = Object.fromEntries(states.map((state, index) => [state, counts[index]!])) as Record<typeof states[number], number>;
  return {
    fecha, zona_horaria: agendaZone, actualizado_en: now.toISOString(),
    salitas, administradores, superadministradores, profesionales, pacientes,
    turnos: {
      registrados_hoy: registrados, programados_hoy: programados,
      pendientes: por_estado.SOLICITADO + por_estado.CONFIRMADO + por_estado.EN_ESPERA,
      por_estado,
    },
    actividad: activity,
  };
}
