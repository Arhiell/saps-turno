import type {
  AuthenticatedUser,
} from '../types/auth.types.js';

// Define los datos de cuenta visibles en operaciones administrativas.
export const accountDisplaySelect =
  'id_usuario, nombre_usuario, email, email_verificado, activo, rol:roles!inner(codigo), persona:personas!usuarios_id_persona_fkey(nombres, apellidos)';

// Incluye la cuenta asociada a una persona mediante una proyección segura.
export const personAccountSelect =
  `cuenta:usuarios!usuarios_id_persona_fkey(${accountDisplaySelect})`;

// Verifica si el usuario tiene permisos para visualizar cuentas.
export const canViewAccount = (
  user: AuthenticatedUser
) =>
  user.rol === 'SUPER_ADMIN' ||
  user.rol === 'ADMIN_SALITA';

// Define la estructura de los datos administrativos de una cuenta.
export interface AccountDisplay {
  id_usuario: string;
  nombre_usuario: string;
  email: string;
  email_verificado: boolean;
  activo: boolean;

  persona?: {
    nombres: string;
    apellidos: string;
  } | null;

  rol: {
    codigo: string;
  };
}