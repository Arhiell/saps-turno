import axios from 'axios';
import api from './api';
import authApi from './auth-api';
import type { ChatbotResponse } from '../types/chatbot.types';

export const sendChatbotMessage = async (message: string, signal: AbortSignal) => {
  const response = await api.post<ChatbotResponse>('/chatbot', { message }, {
    signal, timeout: 25_000,
  });
  const reply = response.data?.data?.reply;
  if (response.data?.success !== true || typeof reply !== 'string' || !reply.trim() || reply.length > 4_000) {
    throw new Error('Invalid assistant response');
  }
  return reply;
};

// Observa el inicio del cierre de sesión; no altera datos, tokens ni solicitudes de autenticación.
// Cancelar antes de esperar /auth/logout evita respuestas durante una revocación lenta.
export const observeChatbotLogout = (onLogout: () => void) => {
  const interceptor = authApi.interceptors.request.use(config => {
    if (config.url === '/auth/logout') onLogout();
    return config;
  });
  return () => authApi.interceptors.request.eject(interceptor);
};

export const chatbotErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    switch (error.response?.data?.code) {
      case 'CHATBOT_DISABLED': return 'El asistente está deshabilitado o pendiente de configuración. Podés seguir usando CORA.';
      case 'CHATBOT_SENSITIVE_DATA': return 'No compartas información personal ni clínica. Reformulá la consulta sin esos datos.';
      case 'CHATBOT_RATE_LIMIT':
      case 'CHATBOT_QUOTA': return 'El asistente alcanzó su límite de uso. Intentá más tarde.';
      case 'CHATBOT_INVALID_REQUEST': return 'Escribí una consulta de entre 1 y 1000 caracteres.';
    }
    if (error.response?.status === 401 || error.response?.status === 403) {
      return 'No pudimos validar tu acceso al asistente. Revisá tu sesión.';
    }
  }
  return 'No pudimos comunicarnos con el asistente. Intentá nuevamente en unos segundos.';
};
