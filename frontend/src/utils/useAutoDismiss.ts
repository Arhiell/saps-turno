import { useEffect } from 'react';

/** Tiempo estándar unificado (15s) para notificaciones de éxito, permitiendo lectura cómoda antes del auto-cierre. */
export const SUCCESS_MESSAGE_TIMEOUT_MS = 15_000;

/** Tiempo estándar unificado (15s) para errores recuperables con botón manual de cierre. */
export const RECOVERABLE_ERROR_TIMEOUT_MS = 15_000;

/** Tiempo estándar unificado (15s) para advertencias. */
export const WARNING_MESSAGE_TIMEOUT_MS = 15_000;

/** Tiempo estándar unificado (15s) para avisos informativos. */
export const INFO_MESSAGE_TIMEOUT_MS = 15_000;

/** Alias unificado (15s) para compatibilidad con el módulo de agenda y profesionales. */
export const PROFESSIONAL_MESSAGE_TIMEOUT_MS = SUCCESS_MESSAGE_TIMEOUT_MS;

/** Limpia automáticamente un mensaje después de `delayMs` cuando `value` tiene contenido y `enabled` está activo. */
export function useAutoDismiss(
  value: string | null | undefined,
  clear: (empty: '') => void,
  delayMs: number = SUCCESS_MESSAGE_TIMEOUT_MS,
  enabled: boolean = true,
): void {
  useEffect(() => {
    if (!enabled || !value) {
      return;
    }

    const timer = window.setTimeout(() => {
      clear('');
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, clear, delayMs, enabled]);
}
