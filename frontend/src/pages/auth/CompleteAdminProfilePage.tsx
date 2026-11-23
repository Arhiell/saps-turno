import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { completeProfile } from '../../services/auth.service';

import type { CompletePersonInput } from '../../types/auth.types';

import { authError } from '../../utils/auth-errors';

import PersonProfileFields from '../../components/ui/PersonProfileFields';

// Permite completar los datos personales de una cuenta administrativa.
export default function CompleteAdminProfilePage() {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();

  // Almacena los datos personales del formulario.
  const [form, setForm] = useState<CompletePersonInput>({
    dni: '',
    nombres: '',
    apellidos: '',
    localidad: 'Goya',
    provincia: 'Corrientes',
  });

  // Controla el procesamiento y los mensajes de error.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Redirige al panel si el perfil ya está completo.
  if (user?.perfil_completo) {
    return <Navigate to="/panel" replace />;
  }

  // Valida y envía los datos para completar el perfil.
  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (busy) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      // Omite los campos opcionales vacíos para conservar los valores por defecto.
      const input = Object.fromEntries(
        Object.entries(form).filter(
          ([, value]) => value !== '' && value !== null
        )
      ) as CompletePersonInput;

      // Guarda los datos personales en el servidor.
      const response = await completeProfile(input);

      // Actualiza el perfil y redirige al panel principal.
      updateProfile(response.data);

      navigate('/panel', {
        replace: true,
        state: { profileCompleted: true },
      });
    } catch (cause) {
      setError(authError(cause));
    } finally {
      setBusy(false);
    }
  };

  // Cierra la sesión y redirige al inicio de sesión.
  const leave = async () => {
    setBusy(true);

    try {
      await logout();
    } catch {
      // AuthContext elimina la sesión local aunque falle la revocación.
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <section
      className="card shadow-sm mx-auto"
      style={{ maxWidth: 800 }}
    >
      <div className="card-body p-3 p-md-4">
        {/* Encabezado del formulario. */}
        <p className="text-primary fw-semibold">
          <i className="bi bi-heart-pulse me-2" />
          CORA
        </p>

        <h1 className="h3">
          Completá tus datos personales
        </h1>

        <p className="text-muted">
          Antes de continuar, necesitamos algunos datos para completar tu perfil.
        </p>

        {/* Muestra el correo electrónico verificado. */}
        <p className="small text-break">
          Correo verificado: <strong>{user?.email}</strong>
        </p>

        <p className="small text-muted">
          Los campos con * son obligatorios.
        </p>

        {/* Muestra los errores al completar el perfil. */}
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {/* Formulario para completar los datos personales. */}
        <form onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy}>
            <PersonProfileFields
              value={form}
              onChange={setForm}
            />

            {/* Permite guardar el perfil o cerrar la sesión. */}
            <div className="d-flex flex-wrap gap-2 mt-4">
              <button
                className="btn btn-saps"
                type="submit"
              >
                {busy && (
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                  />
                )}

                {busy ? 'Guardando…' : 'Completar perfil'}
              </button>

              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => void leave()}
              >
                Cerrar sesión
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </section>
  );
}