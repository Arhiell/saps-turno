import { useState, type InputHTMLAttributes } from 'react';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  label: string;
  error?: string;
}

export default function PasswordInput({ id, label, error, className = '', ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const description = [props['aria-describedby'], error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return <div className="mb-3">
    <label className="form-label" htmlFor={id}>{label}</label>
    <div className="auth-password">
      <input {...props} id={id} type={visible ? 'text' : 'password'}
        className={`form-control ${error ? 'is-invalid' : ''} ${className}`}
        aria-invalid={Boolean(error)} aria-describedby={description} />
      <button type="button" className="auth-password-toggle" disabled={props.disabled}
        aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`} aria-pressed={visible}
        aria-controls={id} onClick={() => setVisible(value => !value)}>
        <i className={`bi ${visible ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
      </button>
    </div>
    {error && <p id={`${id}-error`} className="invalid-feedback d-block">{error}</p>}
  </div>;
}
