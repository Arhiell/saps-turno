import api from './api';

export interface DashboardTotals { total: number; activos: number; inactivos: number }
export interface DashboardSummary {
  fecha: string;
  zona_horaria: string;
  actualizado_en: string;
  salitas: DashboardTotals;
  administradores: DashboardTotals;
  superadministradores: DashboardTotals;
  profesionales: DashboardTotals;
  pacientes: DashboardTotals;
  turnos: {
    registrados_hoy: number;
    programados_hoy: number;
    pendientes: number;
    por_estado: Record<'SOLICITADO' | 'CONFIRMADO' | 'EN_ESPERA' | 'ATENDIDO' | 'CANCELADO' | 'NO_ASISTIO' | 'REPROGRAMADO', number>;
  };
  actividad: {
    disponible: boolean;
    data: { id_auditoria: number | string; entidad: string; accion: string; fecha: string }[];
  };
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return (await api.get<{ ok: boolean; data: DashboardSummary }>('/reportes/dashboard')).data.data;
}
