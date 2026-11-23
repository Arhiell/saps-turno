import { useEffect, type ReactNode } from 'react';

interface ActionInlineFeedbackProps {
  variant: 'error' | 'success';
  message: string;
  blockLabel?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  extra?: ReactNode;
}

/**
 * Mensaje contextual ubicado junto a las acciones del formulario o bloque afectado.
 */
export function ActionInlineFeedback({
  variant,
  message,
  blockLabel,
  actionLabel,
  onAction,
  onDismiss,
  extra,
}: ActionInlineFeedbackProps) {
  const isError = variant === 'error';

  return (
    <div
      className={`alert ${isError ? 'alert-danger' : 'alert-success'} py-2 px-3 mb-0 d-flex flex-wrap align-items-start justify-content-between gap-2`}
      role={isError ? 'alert' : 'status'}
      data-testid={isError ? 'cora-inline-error' : 'cora-inline-success'}
    >
      <div className="d-flex flex-column gap-1 flex-grow-1" style={{ minWidth: 0 }}>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <i
            className={`bi ${
              isError ? 'bi-exclamation-octagon-fill' : 'bi-check-circle-fill'
            } flex-shrink-0`}
            aria-hidden="true"
          />
          {blockLabel && (
            <span className="badge text-bg-danger-subtle text-danger-emphasis border border-danger-subtle">
              {blockLabel}
            </span>
          )}
          <span className="small fw-medium">{message}</span>
        </div>
        {extra}
      </div>

      <div className="d-flex align-items-center gap-2 flex-shrink-0">
        {actionLabel && onAction && (
          <button
            type="button"
            className={`btn btn-sm ${
              isError ? 'btn-outline-danger' : 'btn-outline-success'
            }`}
            onClick={onAction}
          >
            {actionLabel}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            className="btn-close btn-sm"
            aria-label="Cerrar aviso"
            onClick={onDismiss}
          />
        )}
      </div>
    </div>
  );
}

export type FeedbackVariant = 'success' | 'error' | 'warning' | 'info';

interface FloatingFeedbackToastProps {
  variant: FeedbackVariant;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

const variantStyles: Record<
  FeedbackVariant,
  {
    toastClass: string;
    icon: string;
    actionBtnClass: string;
  }
> = {
  success: {
    toastClass: 'toast-success',
    icon: 'bi-check-circle-fill text-success',
    actionBtnClass: 'btn-outline-success',
  },
  error: {
    toastClass: 'toast-error',
    icon: 'bi-exclamation-triangle-fill text-danger',
    actionBtnClass: 'btn-outline-danger',
  },
  warning: {
    toastClass: 'toast-warning',
    icon: 'bi-exclamation-circle-fill text-warning',
    actionBtnClass: 'btn-outline-warning text-dark',
  },
  info: {
    toastClass: 'toast-info',
    icon: 'bi-info-circle-fill text-primary',
    actionBtnClass: 'btn-outline-primary',
  },
};

/**
 * Notificación flotante centralizada y unificada de CORA.
 * - Ubicación uniforme en la esquina superior derecha (o full-width en móvil).
 * - Radios de 12px, paleta semántica armonizada (verde, rojo, naranja/amarillo, azul).
 * - Botón de cierre ("X") siempre accesible.
 * - Soporta título opcional y acción rápida contextual.
 */
export function FloatingFeedbackToast({
  variant,
  title,
  message,
  actionLabel,
  onAction,
  onDismiss,
}: FloatingFeedbackToastProps) {
  // Si no hay mensaje real, nunca renderizar un cartel flotante vacío
  if (!message || !message.trim()) {
    return null;
  }

  // Garantiza auto-cierre estricto a los 15 segundos para no quedar flotando
  useEffect(() => {
    if (!onDismiss) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, 15_000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [message, onDismiss]);

  const isAssertive = variant === 'error';
  const config = variantStyles[variant] ?? variantStyles.info;

  return (
    <div
      className="cora-floating-toast-region no-print"
      aria-live={isAssertive ? 'assertive' : 'polite'}
    >
      <div
        className={`cora-floating-toast ${config.toastClass} d-flex align-items-start justify-content-between gap-3`}
        role={isAssertive ? 'alert' : 'status'}
      >
        <div className="d-flex align-items-start gap-2 flex-grow-1" style={{ minWidth: 0 }}>
          <i
            className={`bi ${config.icon} mt-1 flex-shrink-0 fs-5`}
            aria-hidden="true"
          />
          <div className="d-flex flex-column gap-1 flex-grow-1" style={{ minWidth: 0 }}>
            {title && <span className="fw-semibold small">{title}</span>}
            <div className="small fw-normal" style={{ overflowWrap: 'anywhere' }}>
              {message}
            </div>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2 flex-shrink-0 mt-1">
          {actionLabel && onAction && (
            <button
              type="button"
              className={`btn btn-sm ${config.actionBtnClass} text-nowrap`}
              onClick={onAction}
            >
              {actionLabel}
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              className="btn-close btn-sm"
              aria-label="Cerrar notificación"
              onClick={onDismiss}
            />
          )}
        </div>
      </div>
    </div>
  );
}
