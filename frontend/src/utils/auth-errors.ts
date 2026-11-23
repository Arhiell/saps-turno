import axios from 'axios';
export { passwordError } from './password-policy';

export const authError = (error: unknown): string => {
  if (axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> | { message: string }[] }>(error)) {
    const body = error.response?.data;
    if (body?.errors) {
      const messages = Array.isArray(body.errors) ? body.errors.map(item => item.message) : Object.values(body.errors).flat();
      if (messages.length) return messages.join('. ');
    }
    return body?.message ?? 'No pudimos conectar con el servidor. Volvé a intentar.';
  }
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
};
