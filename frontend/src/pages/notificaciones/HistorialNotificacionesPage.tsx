import {
  useEffect,
  useState,
} from 'react';

import AccionesProgramacion
  from '../../components/notificaciones/AccionesProgramacion';

import NotificacionesNav, {
  EstadoEnvio,
  fechaNotificacion,
} from '../../components/notificaciones/NotificacionesNav';

import {
  getEnvios,
} from '../../services/notificaciones.service';

import type {
  HistorialEnvios,
} from '../../types/notificacion.types';

import {
  authError,
} from '../../utils/auth-errors';

interface HistorialNotificacionesPageProps {
  programadas?: boolean;
}

export default function HistorialNotificacionesPage({
  programadas = false,
}: HistorialNotificacionesPageProps) {
  const [
    data,
    setData,
  ] =
    useState<HistorialEnvios | null>(
      null
    );

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    revision,
    setRevision,
  ] = useState(0);

  const [
    error,
    setError,
  ] = useState('');

  const [
    loading,
    setLoading,
  ] = useState(true);

  // Carga el historial o las notificaciones programadas.
  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');

    void getEnvios(
      page,
      programadas
    )
      .then(
        (result) => {
          if (active) {
            setData(
              result
            );
          }
        }
      )
      .catch(
        (error) => {
          if (active) {
            setError(
              authError(
                error
              )
            );
          }
        }
      )
      .finally(
        () => {
          if (active) {
            setLoading(
              false
            );
          }
        }
      );

    return () => {
      active = false;
    };
  }, [
    page,
    programadas,
    revision,
  ]);

  // Actualiza periódicamente la información mientras la pestaña esté visible.
  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          if (
            !document.hidden
          ) {
            setRevision(
              (value) =>
                value + 1
            );
          }
        },
        30000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, []);

  // Fuerza una nueva consulta de los envíos.
  const refresh = () => {
    setRevision(
      (value) =>
        value + 1
    );
  };

  return (
    <section className="notificaciones-page">
      <NotificacionesNav />

      <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
        <h2 className="h5">
          {programadas
            ? 'Notificaciones programadas'
            : 'Historial de envíos'}
        </h2>

        <button
          type="button"
          className="btn btn-outline-success btn-sm"
          disabled={loading}
          onClick={refresh}
        >
          Actualizar
        </button>
      </div>

      {error && (
        <p
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </p>
      )}

      {loading && (
        <p role="status">
          Cargando notificaciones…
        </p>
      )}

      {!loading &&
        !error &&
        !data?.envios.length && (
          <p className="card p-4">
            No hay notificaciones para mostrar.
          </p>
        )}

      {!error &&
        !!data?.envios.length && (
          <>
            {/* Vista de escritorio. */}
            <div className="d-none d-lg-block card border-0 shadow-sm">
              <table className="table align-middle notification-table mb-0">
                <thead>
                  <tr>
                    <th>
                      Fecha y asunto
                    </th>

                    <th>
                      Remitente
                    </th>

                    <th>
                      Destinatarios
                    </th>

                    <th>
                      Canales
                    </th>

                    <th>
                      Estado
                    </th>

                    <th>
                      <span className="visually-hidden">
                        Acciones
                      </span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {data.envios.map(
                    (item) => (
                      <tr
                        key={
                          item.id_envio
                        }
                      >
                        <td>
                          <small>
                            {fechaNotificacion(
                              programadas
                                ? item.fecha_programada
                                : item.fecha_creacion
                            )}
                          </small>

                          <br />

                          <strong>
                            {
                              item.titulo
                            }
                          </strong>
                        </td>

                        <td>
                          {
                            item.remitente
                          }
                        </td>

                        <td>
                          {
                            item.destinatarios
                          }

                          <br />

                          <small>
                            {
                              item.cantidad
                            }{' '}
                            destinatarios
                          </small>
                        </td>

                        <td>
                          Sistema
                          {item.email &&
                            ' + Email'}
                        </td>

                        <td>
                          <EstadoEnvio
                            estado={
                              item.estado
                            }
                          />
                        </td>

                        <td>
                          <AccionesProgramacion
                            envio={
                              item
                            }
                            onChanged={
                              refresh
                            }
                          />
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* Vista adaptada para dispositivos móviles. */}
            <div className="d-grid d-lg-none gap-3">
              {data.envios.map(
                (item) => (
                  <article
                    className="card border-0 shadow-sm p-3"
                    key={
                      item.id_envio
                    }
                  >
                    <h3 className="h6">
                      {
                        item.titulo
                      }
                    </h3>

                    <p className="text-muted">
                      {fechaNotificacion(
                        programadas
                          ? item.fecha_programada
                          : item.fecha_creacion
                      )}
                    </p>

                    <p>
                      {
                        item.destinatarios
                      }

                      <br />

                      {
                        item.cantidad
                      }{' '}
                      destinatarios
                    </p>

                    <p>
                      Enviado por:{' '}
                      {
                        item.remitente
                      }
                    </p>

                    <p>
                      Sistema
                      {item.email &&
                        ' + Email'}
                      {' · '}

                      <EstadoEnvio
                        estado={
                          item.estado
                        }
                      />
                    </p>

                    <AccionesProgramacion
                      envio={item}
                      onChanged={
                        refresh
                      }
                    />
                  </article>
                )
              )}
            </div>
          </>
        )}

      {!!data &&
        data.totalPages >
          1 && (
          <nav
            className="d-flex justify-content-between align-items-center gap-2 mt-3"
            aria-label="Paginación de envíos"
          >
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={
                loading ||
                page === 1
              }
              onClick={() =>
                setPage(
                  (value) =>
                    value - 1
                )
              }
            >
              Anterior
            </button>

            <span>
              {page}
              {' / '}
              {
                data.totalPages
              }
            </span>

            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={
                loading ||
                page >=
                  data.totalPages
              }
              onClick={() =>
                setPage(
                  (value) =>
                    value + 1
                )
              }
            >
              Siguiente
            </button>
          </nav>
        )}
    </section>
  );
}