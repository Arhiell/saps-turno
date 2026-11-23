/**
 * Política única de contraseñas de CORA:
 * - Mínimo: 8 caracteres.
 * - Máximo: 20 caracteres.
 * - Una mayúscula como mínimo.
 * - Una minúscula como mínimo.
 * - Un número como mínimo.
 * - Los símbolos especiales son opcionales.
 */

export interface PasswordRequirementsState {
  hasLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  isValid: boolean;
}

/**
 * Evalúa los requisitos individuales de la contraseña en tiempo real.
 */
export const evaluatePasswordRequirements = (password: string): PasswordRequirementsState => {
  const hasLength = password.length >= 8 && password.length <= 20;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const isValid = hasLength && hasUpper && hasLower && hasNumber;

  return {
    hasLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    isValid,
  };
};

/**
 * Devuelve el mensaje de error correspondiente al campo Contraseña,
 * o null si cumple con la política.
 */
export const validatePassword = (password: string): string | null => {
  if (!password || !password.trim()) {
    return 'La contraseña es obligatoria.';
  }
  if (password.length > 20) {
    return 'La contraseña no puede superar los 20 caracteres.';
  }
  if (password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'La contraseña debe contener al menos una mayúscula.';
  }
  if (!/[a-z]/.test(password)) {
    return 'La contraseña debe contener al menos una minúscula.';
  }
  if (!/[0-9]/.test(password)) {
    return 'La contraseña debe contener al menos un número.';
  }
  return null;
};

/**
 * Devuelve el mensaje de error correspondiente al campo Confirmar contraseña,
 * o null si coincide.
 */
export const validateConfirmation = (password: string, confirmation: string): string | null => {
  if (!confirmation) {
    return 'Debés confirmar la contraseña.';
  }
  if (password !== confirmation) {
    return 'Las contraseñas no coinciden.';
  }
  return null;
};

/**
 * Validador unificado compatible para formularios.
 */
export const passwordError = (password: string, confirmation: string): string => {
  const pwdErr = validatePassword(password);
  if (pwdErr) return pwdErr;
  const confErr = validateConfirmation(password, confirmation);
  if (confErr) return confErr;
  return '';
};
