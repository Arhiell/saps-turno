import { useEffect, useState } from 'react';
import {
  evaluatePasswordRequirements,
  validateConfirmation,
  validatePassword,
} from '../../utils/password-policy';
import '../../styles/auth.css';

export interface PasswordCreationFieldsProps {
  password: string;
  confirmation: string;
  onPasswordChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  passwordId?: string;
  confirmationId?: string;
  passwordLabel?: string;
  confirmationLabel?: string;
  disabled?: boolean;
  required?: boolean;
  showErrors?: boolean;
  onValidationChange?: (isValid: boolean) => void;
}

/**
 * Componente unificado, accesible y responsivo para la creación y cambio de contraseñas en CORA.
 * - Distribución en dos columnas para Contraseña y Confirmar contraseña en pantallas medianas/grandes.
 * - Bloque de «Requisitos de la contraseña» compacto con 2 columnas e indicadores en tiempo real.
 * - Errores contextuales mostrados únicamente tras perder el foco (blur) o al intentar enviar el formulario.
 * - Botón único de visibilidad por campo (con bloqueo de controles nativos superpuestos de Edge/Chromium).
 * - Cumple con la política única: 8-20 caracteres, mayúscula, minúscula, número (símbolos opcionales).
 */
export default function PasswordCreationFields({
  password,
  confirmation,
  onPasswordChange,
  onConfirmationChange,
  passwordId = 'register-password',
  confirmationId = 'register-confirmation',
  passwordLabel = 'Contraseña',
  confirmationLabel = 'Confirmar contraseña',
  disabled = false,
  required = true,
  showErrors = false,
  onValidationChange,
}: PasswordCreationFieldsProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmationTouched, setConfirmationTouched] = useState(false);
  const [prevShowErrors, setPrevShowErrors] = useState(showErrors);

  // Si showErrors pasa a false y los campos están vacíos, reinicia el estado touched (patrón oficial de React)
  if (prevShowErrors !== showErrors) {
    setPrevShowErrors(showErrors);
    if (!showErrors && !password && !confirmation) {
      setPasswordTouched(false);
      setConfirmationTouched(false);
    }
  }

  // Evaluación de requisitos en tiempo real
  const reqs = evaluatePasswordRequirements(password);
  const passwordError = validatePassword(password);
  const confirmationError = validateConfirmation(password, confirmation);

  const isValid = !passwordError && !confirmationError;

  useEffect(() => {
    onValidationChange?.(isValid);
  }, [isValid, onValidationChange]);

  // Error mostrado solo tras perder el foco o tras intentar enviar el formulario
  const displayPasswordError =
    passwordTouched || showErrors ? passwordError : null;

  const displayConfirmationError =
    confirmationTouched || showErrors ? confirmationError : null;

  return (
    <div className="password-creation-section w-100">
      {/* Distribución en 2 columnas en pantallas medianas y grandes, 1 columna en móviles */}
      <div className="row g-2 g-md-3">
        {/* Columna 1: Contraseña */}
        <div className="col-12 col-md-6">
          <label className="form-label mb-1" htmlFor={passwordId}>
            {passwordLabel} {required && '*'}
          </label>
          <div className="auth-password position-relative">
            <input
              id={passwordId}
              type={passwordVisible ? 'text' : 'password'}
              className={`form-control ${
                displayPasswordError ? 'is-invalid' : ''
              }`}
              autoComplete="new-password"
              maxLength={20}
              required={required}
              disabled={disabled}
              value={password}
              aria-invalid={Boolean(displayPasswordError)}
              aria-describedby={`${passwordId}-requirements ${
                displayPasswordError ? `${passwordId}-error` : ''
              }`}
              onChange={(e) => onPasswordChange(e.target.value)}
              onBlur={() => setPasswordTouched(true)}
            />
            <button
              type="button"
              className="auth-password-toggle"
              disabled={disabled}
              tabIndex={-1}
              aria-label={`${
                passwordVisible ? 'Ocultar' : 'Mostrar'
              } ${passwordLabel.toLowerCase()}`}
              aria-pressed={passwordVisible}
              aria-controls={passwordId}
              onClick={() => setPasswordVisible((v) => !v)}
            >
              <i
                className={`bi ${passwordVisible ? 'bi-eye-slash' : 'bi-eye'}`}
                aria-hidden="true"
              />
            </button>
          </div>

          {displayPasswordError && (
            <div
              id={`${passwordId}-error`}
              className="invalid-feedback d-block mt-1 small"
              role="alert"
            >
              {displayPasswordError}
            </div>
          )}
        </div>

        {/* Columna 2: Confirmar contraseña */}
        <div className="col-12 col-md-6">
          <label className="form-label mb-1" htmlFor={confirmationId}>
            {confirmationLabel} {required && '*'}
          </label>
          <div className="auth-password position-relative">
            <input
              id={confirmationId}
              type={confirmationVisible ? 'text' : 'password'}
              className={`form-control ${
                displayConfirmationError ? 'is-invalid' : ''
              }`}
              autoComplete="new-password"
              maxLength={20}
              required={required}
              disabled={disabled}
              value={confirmation}
              aria-invalid={Boolean(displayConfirmationError)}
              aria-describedby={
                displayConfirmationError ? `${confirmationId}-error` : undefined
              }
              onChange={(e) => onConfirmationChange(e.target.value)}
              onBlur={() => setConfirmationTouched(true)}
            />
            <button
              type="button"
              className="auth-password-toggle"
              disabled={disabled}
              tabIndex={-1}
              aria-label={`${
                confirmationVisible ? 'Ocultar' : 'Mostrar'
              } ${confirmationLabel.toLowerCase()}`}
              aria-pressed={confirmationVisible}
              aria-controls={confirmationId}
              onClick={() => setConfirmationVisible((v) => !v)}
            >
              <i
                className={`bi ${
                  confirmationVisible ? 'bi-eye-slash' : 'bi-eye'
                }`}
                aria-hidden="true"
              />
            </button>
          </div>

          {displayConfirmationError && (
            <div
              id={`${confirmationId}-error`}
              className="invalid-feedback d-block mt-1 small"
              role="alert"
            >
              {displayConfirmationError}
            </div>
          )}
        </div>
      </div>

      {/* Bloque compacto «Requisitos de la contraseña» con 2 columnas */}
      <div
        id={`${passwordId}-requirements`}
        className="password-requirements p-2 px-3 mt-2 mb-3 bg-light rounded border"
        aria-label="Requisitos de la contraseña"
      >
        <div className="password-requirements-title small fw-semibold text-secondary mb-1 d-flex align-items-center gap-1">
          <i className="bi bi-shield-check text-success" aria-hidden="true" />
          <span>Requisitos de la contraseña</span>
        </div>

        <div className="row row-cols-1 row-cols-sm-2 g-1 small">
          <div className="col d-flex align-items-center gap-2">
            <i
              className={`bi ${
                reqs.hasLength
                  ? 'bi-check-circle-fill text-success'
                  : 'bi-circle text-muted'
              }`}
              aria-hidden="true"
            />
            <span
              className={
                reqs.hasLength ? 'text-success fw-medium' : 'text-muted'
              }
            >
              Longitud entre 8 y 20 caracteres
            </span>
          </div>

          <div className="col d-flex align-items-center gap-2">
            <i
              className={`bi ${
                reqs.hasUpper
                  ? 'bi-check-circle-fill text-success'
                  : 'bi-circle text-muted'
              }`}
              aria-hidden="true"
            />
            <span
              className={reqs.hasUpper ? 'text-success fw-medium' : 'text-muted'}
            >
              Al menos una mayúscula
            </span>
          </div>

          <div className="col d-flex align-items-center gap-2">
            <i
              className={`bi ${
                reqs.hasLower
                  ? 'bi-check-circle-fill text-success'
                  : 'bi-circle text-muted'
              }`}
              aria-hidden="true"
            />
            <span
              className={reqs.hasLower ? 'text-success fw-medium' : 'text-muted'}
            >
              Al menos una minúscula
            </span>
          </div>

          <div className="col d-flex align-items-center gap-2">
            <i
              className={`bi ${
                reqs.hasNumber
                  ? 'bi-check-circle-fill text-success'
                  : 'bi-circle text-muted'
              }`}
              aria-hidden="true"
            />
            <span
              className={
                reqs.hasNumber ? 'text-success fw-medium' : 'text-muted'
              }
            >
              Al menos un número
            </span>
          </div>
        </div>

        <div className="password-requirements-optional text-muted small mt-1 pt-1 border-top border-light-subtle">
          <i className="bi bi-info-circle me-1" aria-hidden="true" />
          Los símbolos especiales son opcionales.
        </div>
      </div>
    </div>
  );
}
