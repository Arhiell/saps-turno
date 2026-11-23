import {
  Link,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';

import type {
  UserRole,
} from '../types/auth.types';

import {
  useAuth,
} from '../context/AuthContext';

interface ProtectedRouteProps {
  roles?: UserRole[];
  requiredPermission?: string;
}

const ProtectedRoute = ({
  roles,
  requiredPermission,
}: ProtectedRouteProps) => {
  const {
    isAuthenticated,
    isLoading,
    user,
    patient,
    hasPermission,
  } = useAuth();

  const location =
    useLocation();

  // Muestra un indicador mientras se verifica la sesión.
  if (isLoading) {
    return (
      <div className="container py-5">
        <div className="text-center">
          <div
            className="spinner-border"
            role="status"
          >
            <span className="visually-hidden">
              Cargando...
            </span>
          </div>

          <p className="mt-3 mb-0">
            Verificando sesión...
          </p>
        </div>
      </div>
    );
  }

  // Redirige al inicio de sesión si el usuario no está autenticado.
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // Obliga al paciente a completar su perfil antes de acceder al sistema.
  if (user && ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'].includes(user.rol) &&
      user.perfil_completo !== true && !['/completar-perfil', '/privacidad'].includes(location.pathname)) {
    return <Navigate to="/completar-perfil" replace />;
  }

  // Se permite acceder al perfil y a las notificaciones durante este proceso.
  if (
    user?.rol ===
      'PACIENTE' &&
    !patient &&
    ![
      '/completar-perfil',
      '/privacidad',
      '/mis-notificaciones',
    ].includes(
      location.pathname
    )
  ) {
    return (
      <Navigate
        to="/completar-perfil"
        replace
      />
    );
  }

  // Verifica que el rol tenga permiso para acceder a la ruta.
  if (
    roles &&
    !roles.some(
      (role) =>
        role === user?.rol
    )
  ) {
    return (
      <Navigate
        to="/panel"
        replace
      />
    );
  }

  // Renderiza la ruta protegida cuando se cumplen las validaciones.
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger border-0 shadow-sm p-4" role="alert">
          <div className="d-flex align-items-start gap-3">
            <i className="bi bi-shield-lock fs-3" />
            <div>
              <h4 className="alert-heading mb-1">Acceso restringido</h4>
              <p className="mb-3">
                Tu usuario no posee el permiso requerido (<code>{requiredPermission}</code>) para acceder a esta sección.
              </p>
              <Link to="/panel" className="btn btn-outline-danger btn-sm">
                Volver al panel principal
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
