
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { roleLabels } from './sidebar-menu';

import NotificationBell from './NotificationBell';

import '../../styles/navbar.css';

// Barra de navegación principal de CORA.
const Navbar = () => {
  const {
    user,
    person,
    logout,
  } = useAuth();

  const navigate = useNavigate();

  // Cierra la sesión y redirige al inicio de sesión.
  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // AuthContext ya eliminó la sesión local.
    } finally {
      navigate('/login');
    }
  };

  // Obtiene el nombre del rol para mostrarlo en la interfaz.
  const roleLabel =
    roleLabels[user?.rol ?? ''] ??
    user?.rol ??
    '';

  return (
    <header className="navbar-saps navbar-saps-modern">
      {/* Identidad del sistema. */}
      <div className="navbar-brand-saps">
        <div
          className="navbar-brand-icon"
          aria-hidden="true"
        >
          <i className="bi bi-heart-pulse" />
        </div>

        <div className="navbar-brand-content">
          <div className="navbar-brand-title">
            <span className="navbar-brand-title-primary">
              CORA
            </span>

            <span className="navbar-brand-divider" />

            <span className="navbar-brand-subtitle">
              Salud municipal
            </span>
          </div>
        </div>
      </div>

      {/* Información del usuario autenticado. */}
      <div className="navbar-user navbar-user-modern">
        {/* Notificaciones del usuario. */}
        {user && (
          <div className="navbar-notification">
            <NotificationBell key={user.id_usuario} />
          </div>
        )}

        {/* Nombre y rol del usuario. */}
        <div className="navbar-profile">
          <div
            className="navbar-profile-icon"
            aria-hidden="true"
          >
            <i className="bi bi-person" />
          </div>

          <div className="navbar-profile-info">
            <strong>
              {person
                ? `${person.nombres} ${person.apellidos}`
                : user?.nombre_usuario}
            </strong>

            <small>
              {roleLabel}
            </small>
          </div>
        </div>

        <span
          className="navbar-user-divider"
          aria-hidden="true"
        />

        {/* Cierre de sesión. */}
        <button
          type="button"
          className="navbar-logout"
          onClick={handleLogout}
        >
          <i
            className="bi bi-box-arrow-right"
            aria-hidden="true"
          />

          <span>Salir</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;
