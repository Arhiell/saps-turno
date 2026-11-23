import { AppError } from '../utils/app-error.js';

// Verifica que la cuenta esté activa y no tenga un bloqueo vigente.
export const assertAccountAccess = (
  user: {
    activo: boolean;
    bloqueado_hasta?: string | null;
  },
  now = new Date()
) => {
  // Impide el acceso a cuentas deshabilitadas.
  if (!user.activo) {
    throw new AppError(
      'Tu cuenta fue deshabilitada por la administración. Contactá a tu salita para conocer el motivo y solicitar su revisión.',
      403,
      'ACCOUNT_DISABLED'
    );
  }

  // Impide el acceso mientras exista un bloqueo temporal vigente.
  if (
    user.bloqueado_hasta &&
    Date.parse(user.bloqueado_hasta) > now.getTime()
  ) {
    throw new AppError(
      'Tu cuenta está bloqueada temporalmente. Podrás ingresar cuando finalice el bloqueo.',
      423,
      'ACCOUNT_BLOCKED',
      {
        fecha_fin: user.bloqueado_hasta,
      }
    );
  }
};