import { useCallback, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import AdminSalitaOverview from './AdminSalitaOverview';
import RecepcionOverview from './RecepcionOverview';
import SuperAdminOverview from './SuperAdminOverview';
import PatientOverview from './PatientOverview';
import ProfessionalOverview from './ProfessionalOverview';

/**
 * Panel principal: Despacha la vista operativa según el rol del usuario autenticado.
 * - ADMIN_SALITA: Supervisión y gestión de su salita asignada.
 * - RECEPCION: Ventanilla ágil, control de llegada y sala de espera.
 * - SUPER_ADMIN: Resumen global e indicadores del sistema municipal.
 * - PROFESIONAL / PACIENTE: Fallback de seguridad si acceden directamente a /panel.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const [revision, setRevision] = useState(0);

  const handleRefresh = useCallback(() => setRevision((v) => v + 1), []);

  if (user?.rol === 'PROFESIONAL') {
    return <ProfessionalOverview revision={revision} onRefresh={handleRefresh} />;
  }

  if (user?.rol === 'ADMIN_SALITA') {
    return <AdminSalitaOverview revision={revision} onRefresh={handleRefresh} />;
  }

  if (user?.rol === 'RECEPCION') {
    return <RecepcionOverview revision={revision} onRefresh={handleRefresh} />;
  }

  if (user?.rol === 'PACIENTE') {
    return <PatientOverview revision={revision} onRefresh={handleRefresh} />;
  }

  if (user?.rol === 'SUPER_ADMIN') {
    return (
      <div className="super-admin-dashboard">
        <div className="dashboard-header mb-4">
          <p className="text-capitalize mb-2 text-muted small">
            {new Date().toLocaleDateString('es-AR', {
              timeZone: 'America/Argentina/Buenos_Aires',
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>

          <h1 className="h3 fw-bold mb-1 text-dark">
            ¡Hola, {user?.nombre_usuario}!
          </h1>

          <p className="text-muted mb-0">
            Resumen de actividad y supervisión general de todas las salitas del sistema.
          </p>
        </div>

        <SuperAdminOverview revision={revision} onRefresh={handleRefresh} />
      </div>
    );
  }

  return (
    <div className="alert alert-warning" role="alert">
      Tu rol no tiene un panel habilitado. Contactá a la administración municipal.
    </div>
  );
}
