import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  getNotificaciones,
  leerNotificacion,
  leerTodasNotificaciones,
} from '../../services/notificaciones.service';

import type {
  NotificacionesResponse,
} from '../../types/notificacion.types';

import {
  authError,
} from '../../utils/auth-errors';

import {
  fechaNotificacion,
} from '../../components/notificaciones/NotificacionesNav';
import { useAuth } from '../../context/AuthContext';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import PaginationControls from '../../components/ui/PaginationControls';
import { PROFESSIONAL_MESSAGE_TIMEOUT_MS, useAutoDismiss } from '../../utils/useAutoDismiss';

export default function MisNotificacionesPage() {
  const { user } = useAuth();
  const [
    data,
    setData,
  ] = useState<NotificacionesResponse | null>(null);

  const [
    filter,
    setFilter,
  ] = useState('todas');

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  const [
    success,
    setSuccess,
  ] = useState('');

  // Evita que una respuesta anterior sobrescriba una carga más reciente.
  const requestId = useRef(0);

  useAutoDismiss(error, setError, PROFESSIONAL_MESSAGE_TIMEOUT_MS, user?.rol === 'PROFESIONAL');

  // Oculta automáticamente los mensajes de éxito después de 5 segundos.
  useEffect(() => {
    if (!success) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSuccess('');
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [success]);

  // Evita que loadNotifications cambie de referencia al actualizar data.
  const hasDataRef = useRef(false);

  // Carga la bandeja y conserva los datos actuales durante las actualizaciones.
  const loadNotifications = useCallback(async (
    showInitialLoading = false,
  ) => {
    const currentRequest = ++requestId.current;

    if (showInitialLoading && !hasDataRef.current) {
      setLoading(true);
    }

    setError('');

    try {
      const result = await getNotificaciones(
        page,
        filter === 'todas'
          ? undefined
          : filter === 'leidas',
        15,
      );

      if (currentRequest !== requestId.current) {
        return;
      }

      // Si una eliminación o un filtro deja vacía la página, retrocede una página.
      if (
        !result.notificaciones.length &&
        page > 1
      ) {
        setPage((value) => value - 1);
      } else {
        hasDataRef.current = true;
        setData(result);
      }
    } catch (loadError) {
      if (currentRequest === requestId.current) {
        setError(authError(loadError));
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }, [filter, page]);

  // Carga al entrar y cuando cambian el filtro o la página.
  useEffect(() => {
    void loadNotifications(true);

    return () => {
      // Invalida la solicitud si cambian los parámetros o se desmonta la página.
      requestId.current += 1;
    };
  }, [loadNotifications]);

  // Sincronización automática con WebSockets
  const { resyncTick } = useAgendaSocket();
  const lastResyncTickRef = useRef<number>(resyncTick);

  useEffect(() => {
    if (resyncTick > 0 && resyncTick !== lastResyncTickRef.current) {
      lastResyncTickRef.current = resyncTick;
      void loadNotifications(false);
    }
  }, [resyncTick, loadNotifications]);

  // Actualiza solo ante eventos relevantes o cuando el usuario vuelve a la pestaña.
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) {
        void loadNotifications(false);
      }
    };

    window.addEventListener(
      'notificaciones-actualizadas',
      refresh,
    );

    document.addEventListener(
      'visibilitychange',
      refresh,
    );

    return () => {
      window.removeEventListener(
        'notificaciones-actualizadas',
        refresh,
      );

      document.removeEventListener(
        'visibilitychange',
        refresh,
      );
    };
  }, [loadNotifications]);

  // Marca una notificación o todas como leídas y actualiza la interfaz enseguida.
  const read = async (id?: string) => {
    if (busy) {
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      if (id) {
        await leerNotificacion(id);

        setData((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            notificaciones: current.notificaciones.map((item) =>
              item.id_notificacion === id
                ? { ...item, leida: true }
                : item
            ),
          };
        });
      } else {
        await leerTodasNotificaciones();

        setData((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            notificaciones: current.notificaciones.map((item) => ({
              ...item,
              leida: true,
            })),
          };
        });
      }

      setSuccess(
        id
          ? 'Notificación marcada como leída.'
          : 'Todas las notificaciones fueron marcadas como leídas.',
      );

      // El servicio ya emite notificaciones-actualizadas al completar el PATCH.
      // No se vuelve a emitir aquí para evitar una petición duplicada.
    } catch (readError) {
      setError(authError(readError));
    } finally {
      setBusy(false);
    }
  };

  const unreadCount = data?.notificaciones.filter((item) => !item.leida).length ?? 0;

  return (
    <section className="notificaciones-page">
      <h1 className="h3">
        Mis notificaciones
      </h1>

      <div className="patient-results-summary mb-3">
        <div>
          <span>Totales</span>
          <strong>{data?.total ?? 0}</strong>
        </div>
        <div>
          <span>Sin leer</span>
          <strong>{unreadCount}</strong>
        </div>
        <div>
          <span>Leídas</span>
          <strong>{(data?.total ?? 0) - unreadCount}</strong>
        </div>
      </div>

      <div className="row g-2 align-items-end mb-4">
        {/* Selector de filtro */}
        <div className="col-12 col-sm-auto" style={{ minWidth: '180px' }}>
          <label
            htmlFor="notificacion-filtro"
            className="form-label mb-1 small fw-semibold text-secondary"
          >
            Mostrar
          </label>

          <select
            id="notificacion-filtro"
            className="form-select"
            style={{ height: '42px', fontSize: '0.95rem' }}
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(1);
              setSuccess('');
              setError('');
            }}
          >
            <option value="todas">
              Todas
            </option>

            <option value="nuevas">
              No leídas
            </option>

            <option value="leidas">
              Leídas
            </option>
          </select>
        </div>

        {/* Botón uniforme de marcar todas como leídas */}
        <div className="col-12 col-sm-auto">
          <button
            type="button"
            className="btn btn-outline-success d-inline-flex align-items-center justify-content-center gap-2 w-100 text-nowrap px-3"
            style={{ height: '42px', fontSize: '0.95rem' }}
            disabled={busy || loading || unreadCount === 0}
            onClick={() => void read()}
            title="Marcar todas las notificaciones como leídas"
          >
            <i className="bi bi-check2-all fs-5" aria-hidden="true" />
            <span>
              {busy
                ? 'Actualizando…'
                : 'Marcar todas como leídas'}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="alert alert-success"
          role="status"
          aria-live="polite"
        >
          {success}
        </div>
      )}

      {loading && !data && (
        <div className="card border-0 shadow-sm p-4 text-center text-muted mb-4" role="status">
          <div>
            <div className="spinner-border spinner-border-sm text-success me-2" aria-hidden="true" />
            <span className="align-middle">Cargando notificaciones…</span>
          </div>
        </div>
      )}

      {!loading &&
        !error &&
        !data?.notificaciones.length && (
          <div className="card border-0 shadow-sm p-4 text-center text-muted mb-4" role="status">
            <i className="bi bi-bell-slash fs-2 text-muted mb-2 d-block" aria-hidden="true" />
            <p className="mb-0">No tenés notificaciones en este momento.</p>
          </div>
        )}

      {!error && (
        <div className="d-grid gap-3">
          {data?.notificaciones.map((item) => (
            <article
              key={item.id_notificacion}
              className={`card p-3 shadow-sm ${
                item.leida
                  ? 'border-0'
                  : 'border-success'
              }`}
            >
              <div className="d-flex flex-wrap justify-content-between gap-2">
                <h2 className="h5">
                  {item.titulo}
                </h2>

                <span
                  className={`badge align-self-start flex-shrink-0 ${
                    item.leida
                      ? 'bg-secondary'
                      : 'bg-success'
                  }`}
                >
                  {item.leida
                    ? 'Leída'
                    : 'Sin leer'}
                </span>
              </div>

              <p className="notification-message">
                {item.mensaje}
              </p>

              <p className="small text-muted">
                {fechaNotificacion(
                  item.fecha_envio ??
                    item.fecha_creacion,
                )}

                {' · Enviado por: '}

                {item.remitente ??
                  'CORA · Notificación automática'}
              </p>

              {!item.leida && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success align-self-start"
                  disabled={busy}
                  onClick={() =>
                    void read(item.id_notificacion)
                  }
                >
                  Marcar como leída
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      {!!data && (
        <PaginationControls
          page={page}
          totalPages={data.totalPages}
          totalItems={data.total}
          itemsPerPage={15}
          onPageChange={setPage}
          loading={loading}
          itemLabel="notificaciones"
          className="mt-4"
        />
      )}
    </section>
  );
}
