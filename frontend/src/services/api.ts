import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  updateAuthTokens,
} from '../utils/auth-storage';

import { reportAccessNotice } from '../utils/access-notice';

import { refreshSession } from './auth.service';

// Extiende la configuración para identificar solicitudes reintentadas.
interface RetryableRequestConfig
  extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Configura la instancia principal de Axios.
const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    'http://localhost:3000/api',

  headers: {
    'Content-Type': 'application/json',
  },
});

// Agrega el token de acceso a las solicitudes autenticadas.
api.interceptors.request.use(
  (config) => {
    const accessToken = getAccessToken();

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Gestiona los errores de respuesta y la renovación de sesión.
api.interceptors.response.use(
  (response) => response,

  async (error: AxiosError) => {
    // Detecta restricciones de acceso o sanciones.
    reportAccessNotice(error);

    const originalRequest = error.config as
      | RetryableRequestConfig
      | undefined;

    // Solo intenta renovar el token ante un error 401.
    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    // Obtiene el token de renovación almacenado.
    const refreshToken = getRefreshToken();

    // Limpia la sesión cuando no existe un token de renovación.
    if (!refreshToken) {
      clearAuthSession();

      return Promise.reject(error);
    }

    // Evita reintentar indefinidamente la misma solicitud.
    originalRequest._retry = true;

    try {
      // Solicita nuevos tokens de autenticación.
      const response = await refreshSession({
        refreshToken,
      });

      // Actualiza los tokens almacenados.
      updateAuthTokens(
        response.data.accessToken,
        response.data.refreshToken
      );

      // Agrega el nuevo token a la solicitud original.
      originalRequest.headers.Authorization =
        `Bearer ${response.data.accessToken}`;

      // Reintenta la solicitud con el token renovado.
      return api(originalRequest);
    } catch (refreshError) {
      // Limpia la sesión si falla la renovación.
      clearAuthSession();

      return Promise.reject(refreshError);
    }
  }
);

export default api;