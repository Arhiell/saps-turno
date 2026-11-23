import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import Chatbot from '../chatbot/Chatbot';
import PrivacyBanner from '../ui/PrivacyBanner';

// Define la estructura principal de la aplicación.
const AppLayout = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Identifica si el usuario tiene el rol de paciente.
  const isPatient = user?.rol === 'PACIENTE';

  // Muestra únicamente el formulario para administradores con perfil incompleto.
  if (
    user &&
    ['SUPER_ADMIN', 'ADMIN_SALITA', 'RECEPCION'].includes(user.rol) &&
    !user.perfil_completo
  ) {
    return (
      <main className="container py-4">
        <Outlet />
        <PrivacyBanner />
      </main>
    );
  }

  return (
    <div className={`app-layout${isPatient ? ' app-layout--patient' : ''}`}>
      <Sidebar />

      <div className="app-content">
        <Navbar />

        <main className="app-main" id="contenido">
          {/* Muestra un mensaje cuando el perfil se completa correctamente. */}
          {location.state?.profileCompleted === true && (
            <div
              className="alert alert-success"
              role="status"
            >
              Tu perfil se completó correctamente.
            </div>
          )}

          {/* Renderiza el contenido de la ruta actual. */}
          <Outlet />
          <PrivacyBanner />
        </main>
      </div>

      <MobileBottomNav />
      {location.pathname !== '/asistente' && <Chatbot />}
    </div>
  );
};

export default AppLayout;
