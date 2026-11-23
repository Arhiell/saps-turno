import {
  NavLink,
} from 'react-router-dom';

import '../../styles/notificaciones.css';

// Formatea fechas utilizando la zona horaria de Argentina.
export const fechaNotificacion = (
  value: string | null
) =>
  value
    ? new Date(
        value
      ).toLocaleString(
        'es-AR',
        {
          timeZone:
            'America/Argentina/Buenos_Aires',
          dateStyle:
            'short',
          timeStyle:
            'short',
        }
      )
    : '—';

// Muestra visualmente el estado actual de un envío.
export function EstadoEnvio({
  estado,
}: {
  estado: string;
}) {
  const colores: Record<
    string,
    string
  > = {
    PENDIENTE:
      'warning text-dark',
    ENVIADA:
      'success',
    FALLIDA:
      'danger',
    CANCELADA:
      'secondary',
  };

  return (
    <span
      className={`badge bg-${
        colores[estado] ??
        'secondary'
      }`}
    >
      {estado}
    </span>
  );
}

export default function NotificacionesNav() {
  // Opciones principales de administración de notificaciones.
  const opciones = [
    [
      '/notificaciones/nueva',
      'Nueva notificación',
    ],
    [
      '/notificaciones',
      'Historial',
    ],
    [
      '/notificaciones/programadas',
      'Programadas',
    ],
  ];

  return (
    <>
      <h1 className="h3">
        Administrar notificaciones
      </h1>

      <nav
        className="nav nav-pills flex-wrap gap-2 mb-4"
        aria-label="Administración de notificaciones"
      >
        {opciones.map(
          ([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({
                isActive,
              }) =>
                `nav-link${
                  isActive
                    ? ' active'
                    : ''
                }`
              }
            >
              {label}
            </NavLink>
          )
        )}
      </nav>
    </>
  );
}