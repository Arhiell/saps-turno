import type { UserRole } from '../../types/auth.types';

// Define la estructura de los elementos del menú.
export interface SidebarMenuItem {
  label: string;
  path: string;
  icon: string;
  roles: UserRole[];
  permission?: string;
  children?: SidebarMenuItem[];
}

// Opciones operativas de configuración
export const configuracionOperativaSubItems: SidebarMenuItem[] = [
  {
    label: 'Horarios y disponibilidad',
    path: '/configuracion/horarios',
    icon: 'bi-calendar-week',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'],
  },
  {
    label: 'Especialidades',
    path: '/configuracion/especialidades',
    icon: 'bi-heart-pulse',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'],
  },
  {
    label: 'Feriados y cierres',
    path: '/configuracion/cierres',
    icon: 'bi-calendar-minus',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'],
  },
  {
    label: 'Ausencias y reprogramación',
    path: '/configuracion/bloqueos',
    icon: 'bi-calendar-x',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'],
  },
  {
    label: 'Parámetros',
    path: '/configuracion/parametros',
    icon: 'bi-gear-wide-connected',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'],
  },
  {
    label: 'Zonas',
    path: '/configuracion/zonas',
    icon: 'bi-map',
    roles: ['SUPER_ADMIN'],
  },
  {
    label: 'Barrios',
    path: '/configuracion/barrios',
    icon: 'bi-geo-alt',
    roles: ['SUPER_ADMIN'],
  },
  {
    label: 'Cobertura de salitas',
    path: '/configuracion/cobertura',
    icon: 'bi-hospital',
    roles: ['SUPER_ADMIN'],
  },
];

// Opciones de administración avanzada del sistema
export const administracionSubItems: SidebarMenuItem[] = [
  {
    label: 'Cuentas de acceso',
    path: '/administracion',
    icon: 'bi-person-lock',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'],
  },
  {
    label: 'Contenido público',
    path: '/contenido',
    icon: 'bi-newspaper',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'],
  },
  {
    label: 'Administrar notificaciones',
    path: '/notificaciones',
    icon: 'bi-megaphone',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'],
  },
];

// Mantiene compatibilidad con módulos que importan configurationSubItems
export const configurationSubItems: SidebarMenuItem[] = [
  ...configuracionOperativaSubItems,
  ...administracionSubItems,
];

// Define las opciones de navegación según los roles permitidos.
export const sidebarMenu: SidebarMenuItem[] = [
  // Inicio común
  {
    label: 'Inicio',
    path: '/panel',
    icon: 'bi-house',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION', 'PACIENTE', 'PROFESIONAL'],
  },

  // Menú operativo de administración y recepción
  {
    label: 'Agenda / Turnos',
    path: '/turnos',
    icon: 'bi-calendar-check',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'],
  },
  {
    label: 'Pacientes',
    path: '/pacientes',
    icon: 'bi-people',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'],
  },
  {
    label: 'Solicitudes de vinculación',
    path: '/solicitudes-vinculacion',
    icon: 'bi-person-check',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'],
  },
  {
    label: 'Profesionales',
    path: '/profesionales',
    icon: 'bi-person-badge',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'],
  },
  {
    label: 'Salitas',
    path: '/salitas',
    icon: 'bi-hospital',
    roles: ['SUPER_ADMIN'],
  },
  {
    label: 'Reportes',
    path: '/reportes',
    icon: 'bi-bar-chart',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'],
  },

  // Historia clínica y auditoría clínica (según permisos)
  {
    label: 'Historia clínica',
    path: '/historia-clinica',
    icon: 'bi-journal-medical',
    roles: ['PROFESIONAL', 'ADMIN_SALITA', 'RECEPCION'],
    permission: 'VER_HISTORIA_CLINICA',
  },
  {
    label: 'Derivaciones clínicas',
    path: '/historia-clinica/derivaciones',
    icon: 'bi-arrow-left-right',
    roles: ['PROFESIONAL', 'ADMIN_SALITA'],
    permission: 'GESTIONAR_DERIVACIONES_CLINICAS',
  },
  {
    label: 'Auditoría clínica',
    path: '/auditoria-clinica',
    icon: 'bi-shield-check',
    roles: ['SUPER_ADMIN'],
    permission: 'VER_AUDITORIA_CLINICA',
  },

  // Opciones exclusivas de paciente
  { label: 'Personas a cargo', path: '/personas-a-cargo', icon: 'bi-people', roles: ['PACIENTE'] },
  { label: 'Mis turnos', path: '/mis-turnos', icon: 'bi-calendar-check', roles: ['PACIENTE'] },
  { label: 'Mi historia clínica', path: '/mi-historia', icon: 'bi-journal-medical', roles: ['PACIENTE'] },
  { label: 'Solicitar turno', path: '/solicitar-turno', icon: 'bi-calendar-plus', roles: ['PACIENTE'] },

  // Opciones exclusivas de profesional
  { label: 'Pacientes del día', path: '/mis-pacientes', icon: 'bi-people', roles: ['PROFESIONAL'] },
  { label: 'Mi agenda', path: '/mi-agenda', icon: 'bi-calendar-check', roles: ['PROFESIONAL'] },
  { label: 'Mis horarios', path: '/mis-horarios', icon: 'bi-clock-history', roles: ['PROFESIONAL'] },

  // Opciones transversales
  {
    label: 'Mis notificaciones',
    path: '/mis-notificaciones',
    icon: 'bi-bell',
    roles: ['PACIENTE', 'PROFESIONAL'],
  },
  {
    label: 'Mi perfil',
    path: '/mi-perfil',
    icon: 'bi-person',
    roles: ['PACIENTE', 'PROFESIONAL'],
  },
  {
    label: 'Asistente CORA',
    path: '/asistente',
    icon: 'bi-robot',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION', 'PROFESIONAL', 'PACIENTE'],
  },

  // Configuración operativa con sub-elementos para roles administrativos y recepción
  {
    label: 'Configuración',
    path: '/configuracion',
    icon: 'bi-gear',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'],
    children: configuracionOperativaSubItems,
  },

  // Administración del sistema
  {
    label: 'Administración',
    path: '/admin-sistema',
    icon: 'bi-shield-lock',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'],
    children: administracionSubItems,
  },
];

// Filtra las opciones del menú y prioriza el orden de navegación según el rol.
export const getMenuForRole = (role?: string, permissions: string[] = []): SidebarMenuItem[] => {
  if (!role) return [];

  if (role === 'PACIENTE') {
    const patientOrder: Record<string, number> = {
      '/panel': 1,
      '/solicitar-turno': 2,
      '/mis-turnos': 3,
      '/personas-a-cargo': 4,
      '/mi-historia': 5,
      '/mi-perfil': 6,
      '/mis-notificaciones': 7,
      '/asistente': 8,
    };

    return sidebarMenu
      .filter((item) => item.roles.includes('PACIENTE'))
      .sort((a, b) => (patientOrder[a.path] ?? 99) - (patientOrder[b.path] ?? 99));
  }

  if (role === 'PROFESIONAL') {
    const profOrder: Record<string, number> = {
      '/panel': 1,
      '/mis-pacientes': 2,
      '/mi-agenda': 3,
      '/mis-horarios': 4,
      '/historia-clinica': 5,
      '/historia-clinica/derivaciones': 6,
      '/mis-notificaciones': 7,
      '/mi-perfil': 8,
      '/asistente': 9,
    };

    return sidebarMenu
      .filter(
        (item) =>
          item.roles.includes('PROFESIONAL') &&
          (!item.permission || permissions.includes(item.permission))
      )
      .sort((a, b) => (profOrder[a.path] ?? 99) - (profOrder[b.path] ?? 99));
  }

  // Orden estricto para SUPER_ADMIN, ADMIN_SALITA y RECEPCION:
  const adminOrder: Record<string, number> = {
    '/panel': 1,
    '/turnos': 2,
    '/pacientes': 3,
    '/solicitudes-vinculacion': 4,
    '/profesionales': 5,
    '/salitas': 6,
    '/reportes': 7,
    '/historia-clinica': 8,
    '/historia-clinica/derivaciones': 9,
    '/auditoria-clinica': 10,
    '/asistente': 11,
    '/configuracion': 12,
    '/admin-sistema': 13,
  };

  const filtered = sidebarMenu
    .filter(
      (item) =>
        item.roles.some((allowed) => allowed === role) &&
        (!item.permission || permissions.includes(item.permission))
    )
    .map((item) => {
      if (item.children) {
        const filteredChildren = item.children.filter(
          (child) =>
            child.roles.some((allowed) => allowed === role) &&
            (!child.permission || permissions.includes(child.permission))
        );
        return { ...item, children: filteredChildren };
      }
      return item;
    })
    .filter((item) => !item.children || item.children.length > 0);

  return filtered.sort((a, b) => (adminOrder[a.path] ?? 99) - (adminOrder[b.path] ?? 99));
};

// Determina si una opción del menú debe mostrarse activa evitando doble marcado en rutas hermanas/hijas.
export const isMenuItemActive = (
  pathname: string,
  itemPath: string,
  visibleItems: SidebarMenuItem[]
): boolean => {
  if (itemPath === '/panel') {
    return pathname === '/panel';
  }

  const matchesItem =
    pathname === itemPath || pathname.startsWith(`${itemPath}/`);

  if (!matchesItem) {
    return false;
  }

  // Comprueba si hay otra opción visible más específica
  const flatVisible: SidebarMenuItem[] = [];
  for (const it of visibleItems) {
    flatVisible.push(it);
    if (it.children) {
      flatVisible.push(...it.children);
    }
  }

  const hasMoreSpecificMatch = flatVisible.some(
    (other) =>
      other.path !== itemPath &&
      other.path.startsWith(`${itemPath}/`) &&
      (pathname === other.path || pathname.startsWith(`${other.path}/`))
  );

  return !hasMoreSpecificMatch;
};

// Define los nombres visibles de cada rol.
export const roleLabels: Record<string, string> = {
  RECEPCION: 'Recepción',
  SUPER_ADMIN: 'Administración general',
  ADMIN_SALITA: 'Administración de salita',
  PROFESIONAL: 'Profesional',
  PACIENTE: 'Paciente',
};

// Define las opciones disponibles en el módulo de configuración para tarjetas del dashboard
export const configurationMenu: (SidebarMenuItem & {
  description: string;
})[] = [
  {
    label: 'Feriados y cierres',
    path: '/configuracion/cierres',
    icon: 'bi-calendar-minus',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA'],
    description: 'Administrá feriados, asuetos y cierres de todas las salitas o de una salita. Revisá los turnos afectados antes de guardar.',
  },
  {
    label: 'Zonas',
    path: '/configuracion/zonas',
    icon: 'bi-map',
    roles: ['SUPER_ADMIN'],
    description: 'Organizá las zonas a las que pertenecen los barrios.',
  },
  {
    label: 'Barrios',
    path: '/configuracion/barrios',
    icon: 'bi-geo-alt',
    roles: ['SUPER_ADMIN'],
    description: 'Cargá y actualizá los barrios que aparecen en los formularios.',
  },
  {
    label: 'Especialidades',
    path: '/configuracion/especialidades',
    icon: 'bi-heart-pulse',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA'],
    description: 'Administrá las especialidades disponibles para asignar a profesionales.',
  },
  {
    label: 'Cobertura de salitas',
    path: '/configuracion/cobertura',
    icon: 'bi-hospital',
    roles: ['SUPER_ADMIN'],
    description: 'Vinculá cada salita con sus barrios de atención.',
  },
  {
    label: 'Horarios y disponibilidad',
    path: '/configuracion/horarios',
    icon: 'bi-calendar-week',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA'],
    description: 'Configurá franjas, duración de turnos y consultá disponibilidad.',
  },
  {
    label: 'Parámetros',
    path: '/configuracion/parametros',
    icon: 'bi-gear-wide-connected',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA'],
    description: 'Administrá los valores configurables del sistema o de tu salita.',
  },
  {
    label: 'Ausencias y reprogramación',
    path: '/configuracion/bloqueos',
    icon: 'bi-calendar-x',
    roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'],
    description: 'Registrá una ausencia puntual y reorganizá los turnos afectados desde la misma pantalla.',
  },
];
