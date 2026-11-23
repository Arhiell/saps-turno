import { useAgendaSocket } from '../../context/AgendaSocketContext';

export default function ConnectionStatusBadge() {
  const { estadoConexion, reconnect } = useAgendaSocket();

  // Los WebSockets operan de forma silenciosa en segundo plano. No se muestra ningún cartel permanente si la conexión es exitosa.
  if (estadoConexion === 'conectado') {
    return null;
  }

  if (estadoConexion === 'reconectando') {
    return (
      <span
        className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle d-inline-flex align-items-center gap-1 py-1 px-2"
        title="Reconectando con el servidor en tiempo real..."
      >
        <span
          className="spinner-border spinner-border-sm"
          style={{ width: '8px', height: '8px', borderWidth: '1px' }}
        />
        <small className="fw-semibold">Reconectando...</small>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={reconnect}
      className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 py-0 px-2"
      title="Sin conexión en tiempo real. Haga clic para reintentar conectar."
    >
      <span
        className="d-inline-block rounded-circle bg-secondary"
        style={{ width: '7px', height: '7px' }}
      />
      <small>Sin conexión (reintentar)</small>
    </button>
  );
}
