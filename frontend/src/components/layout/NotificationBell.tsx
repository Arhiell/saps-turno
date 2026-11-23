import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';
import { createPortal } from 'react-dom';

import {
  getNotificaciones,
  leerNotificacion,
  leerTodasNotificaciones,
} from '../../services/notificaciones.service';
import { useAgendaSocket } from '../../context/AgendaSocketContext';

import type {
  Notificacion,
} from '../../types/notificacion.types';

// Íconos utilizados según el tipo de notificación.
const icons: Record<string, string> = {
  TURNO_CREADO: 'bi-calendar-plus',
  TURNO_CANCELADO: 'bi-calendar-x',
  TURNO_REPROGRAMADO: 'bi-calendar2-week',
  CAMBIO_PROFESIONAL: 'bi-person-badge',
};

export default function NotificationBell() {
  // Controla la apertura del panel.
  const [open, setOpen] = useState(false);

  // Notificaciones visibles.
  const [items, setItems] = useState<Notificacion[]>([]);

  // Cantidad total de notificaciones sin leer.
  const [unread, setUnread] = useState<number | null>(null);

  // Estados de carga y acciones.
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Mensajes de respuesta.
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mensajeAbierto, setMensajeAbierto] = useState<Notificacion | null>(null);

  // Permite recargar las notificaciones.
  const [revision, setRevision] = useState(0);

  // Referencias para controlar el panel y el botón.
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const navigate = useNavigate();
  const { ultimoEvento, resyncTick } = useAgendaSocket();

  // Sincroniza inmediatamente ante eventos WebSocket
  useEffect(() => {
    if (ultimoEvento || resyncTick > 0) {
      setRevision((v) => v + 1);
    }
  }, [ultimoEvento, resyncTick]);

  // Sincroniza el badge cuando se lee desde la página de la bandeja.
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('notificaciones-actualizadas', refresh);
    return () => window.removeEventListener('notificaciones-actualizadas', refresh);
  }, []);

  // CARGA DE NOTIFICACIONES

  useEffect(() => {
    let active = true;

    // Conserva la lista visible durante las actualizaciones para evitar parpadeos.
    // El estado de carga inicial ya comienza en true.

    // Cuenta todas las pendientes,
    // sin cargar más notificaciones de las visibles en la campana.
    void Promise.all([
      getNotificaciones(1, undefined, 3),
      getNotificaciones(1, false, 1),
    ])
      .then(([list, pending]) => {
        if (!active) {
          return;
        }

        setItems(list.notificaciones);
        setUnread(pending.total);
      })
      .catch(() => {
        if (active) {
          setError(
            'No se pudieron cargar las notificaciones.'
          );
          setUnread(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [revision]);

  // ACTUALIZACIÓN AUTOMÁTICA

  useEffect(() => {
    // Actualiza las notificaciones cada 30 segundos
    // cuando la página está visible y el panel cerrado.
    const timer = window.setInterval(() => {
      if (
        !document.hidden &&
        !open
      ) {
        setRevision(
          (v) => v + 1
        );
      }
    }, 30000);

    return () =>
      window.clearInterval(timer);
  }, [open]);

  // CIERRE DEL PANEL

  useEffect(() => {
    if (!open) {
      return;
    }

    // Cierra el panel al hacer clic fuera.
    const closeOutside = (
      event: PointerEvent
    ) => {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target) &&
        !(event.target instanceof Element && event.target.closest('.notification-message-modal, .notification-message-backdrop'))
      ) {
        setOpen(false);
      }
    };

    // Cierra el panel con Escape y devuelve el foco.
    const escape = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        if (mensajeAbierto) {
          setMensajeAbierto(null);
        } else {
          setOpen(false);
          trigger.current?.focus();
        }
      }
    };

    document.addEventListener(
      'pointerdown',
      closeOutside
    );

    document.addEventListener(
      'keydown',
      escape
    );

    return () => {
      document.removeEventListener(
        'pointerdown',
        closeOutside
      );

      document.removeEventListener(
        'keydown',
        escape
      );
    };
  }, [open, mensajeAbierto]);


  // MARCAR COMO LEÍDA
  const read = async (
    item?: Notificacion
  ) => {
    if (busy) {
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      // Marca una notificación individual como leída.
      if (item) {
        if (!item.leida) {
          await leerNotificacion(
            item.id_notificacion
          );
        }
      } else {
        // Marca todas las notificaciones como leídas.
        await leerTodasNotificaciones();
      }

      // Fuerza la actualización de la lista.
      setSuccess(
        item
          ? 'Notificación leída.'
          : 'Todas las notificaciones fueron marcadas como leídas.'
      );

      // Si está relacionada con un turno,
      // navega hacia el detalle correspondiente.
      if (item?.id_turno) {
        setOpen(false);

        navigate(
          `/mis-turnos/${item.id_turno}`
        );
      }
    } catch {
      setError(
        'No se pudo marcar como leída. Volvé a intentar.'
      );
    } finally {
      setBusy(false);
    }
  };

  // Abre una notificación y la marca como leída al seleccionarla.
  const viewNotification = async (item: Notificacion) => {
    setMensajeAbierto(item);

    if (item.leida || busy) {
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await leerNotificacion(item.id_notificacion);

      // Actualiza el estado local para reflejar el cambio inmediatamente.
      setItems((current) =>
        current.map((notification) =>
          notification.id_notificacion === item.id_notificacion
            ? { ...notification, leida: true }
            : notification
        )
      );

      setMensajeAbierto((current) =>
        current?.id_notificacion === item.id_notificacion
          ? { ...current, leida: true }
          : current
      );

      setUnread((current) =>
        current === null ? null : Math.max(0, current - 1)
      );
      setSuccess('Notificación leída.');

    } catch {
      setError(
        'No se pudo marcar como leída. Volvé a intentar.'
      );
    } finally {
      setBusy(false);
    }
  };

  // INTERFAZ

  return (
    <>
    <div
      className="notification-bell"
      ref={container}
    >
      {/* Botón principal de notificaciones. */}
      <button
        ref={trigger}
        className="btn btn-outline-success position-relative"
        type="button"
        aria-label={`Notificaciones${
          unread === null
            ? ''
            : `, ${unread} sin leer`
        }`}
        aria-expanded={open}
        aria-controls="patient-notifications"
        onClick={() => {
          // La bandeja ya se carga al montar y se sincroniza mediante el evento global.
          // Evita repetir inmediatamente las dos consultas al abrir la campanita.
          setOpen((current) => !current);
        }}
      >
        <i
          className="bi bi-bell"
          aria-hidden="true"
        />

        {/* Contador de notificaciones pendientes. */}
        {!!unread && (
          <span
            className="notification-count"
            aria-hidden="true"
          >
            {unread > 99
              ? '99+'
              : unread}
          </span>
        )}
      </button>

      {/* Panel desplegable de notificaciones. */}
      {open && (
        <section
          id="patient-notifications"
          className="notification-panel"
          aria-label="Notificaciones"
        >
          {/* Encabezado del panel. */}
          <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
            <h2 className="h5 mb-0">
              Notificaciones
            </h2>

            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              Cerrar
            </button>
          </div>

          {/* Marca todas las notificaciones como leídas. */}
          <button
            className="btn btn-sm btn-outline-primary mb-3"
            disabled={
              busy ||
              loading ||
              !unread
            }
            onClick={() =>
              void read()
            }
          >
            Marcar todas como leídas
          </button>

          {/* Mensaje de error. */}
          {error && (
            <div
              className="alert alert-danger"
              role="alert"
            >
              {error}{' '}

              <button
                className="btn btn-sm btn-outline-danger"
                disabled={busy}
                onClick={() =>
                  setRevision(
                    (v) => v + 1
                  )
                }
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Mensaje de éxito. */}
          {success && (
            <p
              role="status"
              className="text-success"
            >
              {success}
            </p>
          )}

          {/* Estado de carga o listado de notificaciones. */}
          {loading ? (
            <p role="status">
              Cargando notificaciones…
            </p>
          ) : (
            <>
              {!error &&
                !items.length && (
                  <p>
                  No tenés notificaciones para mostrar.
                  </p>
                )}

              {/* Listado de notificaciones. */}
              <div className="d-grid gap-2">
                {items.map(
                  (item) => (
                    <article
                      key={item.id_notificacion}
                      className={`notification-item ${
                        item.leida
                          ? ''
                          : 'is-unread'
                      }`}
                    >
                      <strong>
                        <i
                          className={`bi ${
                            icons[item.tipo] ??
                            'bi-envelope'
                          } me-2`}
                          aria-hidden="true"
                        />

                        {item.titulo}
                      </strong>

                      <span className="notification-message-preview-text">
                        {item.mensaje.length > 160 ? `${item.mensaje.slice(0, 160)}…` : item.mensaje}
                      </span>

                      <small>Enviado por: {item.remitente ?? 'CORA · Notificación automática'}</small>

                      <small>
                        {new Date(
                          item.fecha_envio ?? item.fecha_creacion
                        ).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
                        {' · '}
                        {item.leida
                          ? 'Leída'
                          : 'Sin leer'}
                      </small>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success align-self-start"
                        onClick={() => void viewNotification(item)}
                      >
                        Ver notificación
                      </button>
                    </article>
                  )
                )}
              </div>
            </>
          )}

          <button className="btn btn-link w-100 mt-3" onClick={() => { setOpen(false); navigate('/mis-notificaciones'); }}>
            Ver todas las notificaciones
          </button>

        </section>
      )}
    </div>
    {mensajeAbierto && createPortal(
      <>
        <div className="notification-message-backdrop" onMouseDown={() => setMensajeAbierto(null)} />
        <section
          className="notification-message-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notification-message-title"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setMensajeAbierto(null);
          }}
        >
          <article className="notification-message-dialog">
            <header className="notification-message-header">
              <h2 id="notification-message-title">{mensajeAbierto.titulo}</h2>
              <button type="button" className="btn-close" aria-label="Cerrar mensaje" onClick={() => setMensajeAbierto(null)} />
            </header>
            <p className="notification-message-full">{mensajeAbierto.mensaje}</p>
            <footer className="notification-message-footer">
              <small>
                Enviado por: {mensajeAbierto.remitente ?? 'CORA · Notificación automática'}
                <br />
                {new Date(mensajeAbierto.fecha_envio ?? mensajeAbierto.fecha_creacion).toLocaleString('es-AR', {
                  timeZone: 'America/Argentina/Buenos_Aires',
                })}
              </small>
              <button type="button" className="btn btn-outline-secondary" onClick={() => setMensajeAbierto(null)}>Cerrar</button>
            </footer>
          </article>
        </section>
      </>,
      document.body,
    )}
    </>
  );
}
