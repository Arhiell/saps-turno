import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Redirección automática de la ruta base /configuracion hacia el primer apartado
 * operativo autorizado según el rol del usuario, eliminando la pantalla intermedia redundante.
 */
export default function ConfiguracionPage() {
  const { user } = useAuth();

  if (user?.rol === 'RECEPCION') {
    return <Navigate to="/configuracion/bloqueos" replace />;
  }

  return <Navigate to="/configuracion/horarios" replace />;
}
