import { isAxiosError } from 'axios';

import { clearAuthSession } from './auth-storage';

// Define la información de los avisos de restricción de acceso.
export interface AccessNotice {
  code: string;
  message: string;

  data?: {
    motivo?: string;
    fecha_fin?: string;
  };
}

// Almacena el aviso actual y el último aviso descartado.
let current: AccessNotice | null = null;
let dismissed = '';

// Almacena los suscriptores de los cambios de avisos.
const listeners = new Set<() => void>();

// Registra un suscriptor y permite cancelar su suscripción.
export const subscribeAccessNotice = (
  listener: () => void
) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

// Obtiene el aviso de acceso actual.
export const getAccessNotice = () => current;

// Cierra el aviso actual y notifica a los suscriptores.
export const closeAccessNotice = () => {
  dismissed = current
    ? JSON.stringify(current)
    : '';

  current = null;

  listeners.forEach((listener) => listener());
};

// Detecta restricciones de acceso a partir de errores de Axios.
export const reportAccessNotice = (
  error: unknown
) => {
  // Verifica que el error provenga de Axios.
  if (!isAxiosError<AccessNotice>(error)) {
    return;
  }

  const notice = error.response?.data;

  // Procesa únicamente los códigos de restricción reconocidos.
  if (
    !notice ||
    ![
      'ACCOUNT_DISABLED',
      'ACCOUNT_BLOCKED',
      'PATIENT_SANCTIONED',
    ].includes(notice.code)
  ) {
    return;
  }

  // Cierra la sesión cuando la cuenta está restringida.
  if (notice.code.startsWith('ACCOUNT_')) {
    clearAuthSession();
  } else if (current?.code.startsWith('ACCOUNT_')) {
    // Prioriza los bloqueos de cuenta sobre las sanciones.
    return;
  }

  // Evita reabrir el mismo aviso por las actualizaciones periódicas de la agenda.
  if (
    notice.code === 'PATIENT_SANCTIONED' &&
    JSON.stringify(notice) === dismissed
  ) {
    return;
  }

  // Actualiza el aviso y notifica a los suscriptores.
  current = notice;

  listeners.forEach((listener) => listener());
};