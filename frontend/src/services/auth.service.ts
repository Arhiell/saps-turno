import api from './api';
import authApi from './auth-api';

import type { AccountDisplay } from '../types/account-display.types';

import type {
  CompletePatientProfileInput,
  CompletePersonInput,
  LoginRequest,
  LoginResponse,
  LoginResponseData,
  LoginResultResponse,
  LogoutRequest,
  OwnPersonUpdate,
  PasswordRecoveryInput,
  ProfileResponse,
  RefreshRequest,
  RefreshResponse,
  RegisterPatientInput,
  ResetPasswordInput,
} from '../types/auth.types';

import type { OwnPatientUpdate } from '../types/patient.types';

// Actualiza los datos personales del usuario autenticado.
export const updateOwnProfile = async (
  input: OwnPersonUpdate | OwnPatientUpdate
): Promise<ProfileResponse> => {
  const response = await api.patch<ProfileResponse>(
    '/auth/profile',
    input
  );

  return response.data;
};

// Inicia sesión con las credenciales del usuario.
export const login = async (
  data: LoginRequest
): Promise<LoginResultResponse> => {
  const response = await authApi.post<LoginResultResponse>(
    '/auth/login',
    data
  );

  return response.data;
};

// Comparte una misma solicitud cuando existen renovaciones simultáneas.
let pendingRefresh: Promise<RefreshResponse> | null = null;

// Renueva los tokens de autenticación de la sesión.
export const refreshSession = (
  data: RefreshRequest
): Promise<RefreshResponse> => {
  pendingRefresh ??= authApi
    .post<RefreshResponse>('/auth/refresh', data)
    .then(response => response.data)
    .finally(() => {
      pendingRefresh = null;
    });

  return pendingRefresh;
};

// Cierra la sesión del usuario en el servidor.
export const logout = async (
  data: LogoutRequest
): Promise<void> => {
  await authApi.post('/auth/logout', data);
};

// Registra una nueva cuenta de paciente.
export const registerPatient = async (
  data: RegisterPatientInput
) => {
  const response = await authApi.post<{
    data: {
      verificationExpiresAt: string;
    };
  }>('/auth/register', data);

  return response.data.data;
};

// Inicia sesión utilizando una credencial de Google.
export const loginWithGoogle = async (
  credential: string
): Promise<LoginResponse> => {
  return (
    await authApi.post<LoginResponse>('/auth/google', {
      credential,
    })
  ).data;
};

// Solicita un código para recuperar la contraseña.
export const requestPasswordRecovery = async (
  data: PasswordRecoveryInput
) => {
  await authApi.post('/auth/password/forgot', data);
};

// Restablece la contraseña mediante un código o token.
export const resetPassword = async (
  data: ResetPasswordInput
) => {
  await authApi.post('/auth/password/reset', data);
};

// Verifica el correo electrónico mediante un token o código.
export const verifyEmail = async (
  verification:
    | string
    | {
        email: string;
        code: string;
      }
    | {
        loginVerificationToken: string;
        code: string;
      }
) => {
  const response = await authApi.post<{
    success: boolean;
    message: string;
    data?: {
      user: LoginResponseData['user'];
      accessToken: string;
      refreshToken: string;
    };
  }>(
    '/auth/email/verify',
    typeof verification === 'string'
      ? {
          token: verification,
        }
      : verification
  );

  return response.data;
};

// Solicita el envío de un código de verificación al correo.
export const requestEmailVerification = async (
  email: string
) => {
  return (
    await authApi.post<{
      verificationExpiresAt?: string | null;
      resendAvailableAt?: string | null;
    }>('/auth/email/request', {
      email,
    })
  ).data;
};

// Obtiene el perfil completo del usuario autenticado.
export const getProfile = async (): Promise<ProfileResponse> => {
  return (
    await api.get<ProfileResponse>('/auth/me')
  ).data;
};

// Actualiza el nombre de usuario de la cuenta.
export const changeUsername = async (
  nombre_usuario: string
) => {
  await api.patch('/auth/username', {
    nombre_usuario,
  });
};

// Cambia la contraseña de la cuenta autenticada.
export const changePassword = async (
  currentPassword: string,
  newPassword: string
) => {
  await api.patch('/auth/password', {
    currentPassword,
    newPassword,
  });
};

// Solicita un código para cambiar el correo electrónico.
export const requestEmailChange = async (
  email: string
) => {
  return (
    await api.post<{
      data: {
        verificationExpiresAt: string;
      };
    }>('/auth/email/change/request', {
      email,
    })
  ).data.data;
};

// Confirma el cambio de correo mediante el código recibido.
export const confirmEmailChange = async (
  email: string,
  code: string
) => {
  await api.post('/auth/email/change/verify', {
    email,
    code,
  });
};

// Completa los datos personales del paciente o administrador.
export const completeProfile = async (
  data: CompletePatientProfileInput | CompletePersonInput
): Promise<ProfileResponse> => {
  return (
    await api.post<ProfileResponse>('/auth/profile', data)
  ).data;
};

// Conserva la API del formulario de pacientes sin duplicar la solicitud.
export const completePatientProfile = completeProfile;

// Crea una cuenta de acceso para administradores, personal de recepción o profesionales.
export const createInternalAccount = async (
  kind: 'admins' | 'professionals',
  data: {
    nombre_usuario: string;
    email: string;
    password: string;
    id_salita?: string;
    id_profesional?: string;
    rol?: 'SUPER_ADMIN' | 'ADMIN_SALITA' | 'RECEPCION';
  }
) => {
  const response = await api.post<{
    data: {
      user: Omit<AccountDisplay, 'rol'> & {
        rol: string;
      };
    };
  }>(`/users/${kind}`, data);

  // Obtiene los datos de la cuenta creada.
  const user = response.data.data.user;

  // Devuelve la información con la estructura utilizada por el frontend.
  return {
    id_usuario: user.id_usuario,
    nombre_usuario: user.nombre_usuario,
    email: user.email,
    email_verificado: user.email_verificado,
    activo: user.activo,
    rol: {
      codigo: user.rol,
    },
  };
};
