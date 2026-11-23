import {
  useEffect,
  useState,
} from 'react';

import {
  Link,
  useLocation,
  useParams,
} from 'react-router-dom';

import {
  cancelarEnvio,
  getEnvio,
} from '../../services/notificaciones.service';

import type {
  EnvioAdministrativo,
} from '../../types/notificacion.types';

import {
  authError,
} from '../../utils/auth-errors';

import ConfirmationModal
  from '../../components/ui/ConfirmationModal';

import NotificacionesNav, {
  EstadoEnvio,
  fechaNotificacion,
} from '../../components/notificaciones/NotificacionesNav';

export default function DetalleNotificacionPage() {
  const {
    id,
  } = useParams();

  const location =
    useLocation();

  const [
    envio,
    setEnvio,
  ] =
    useState<EnvioAdministrativo | null>(
      null
    );

  const [
    error,
    setError,
  ] = useState('');

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    confirmar,
    setConfirmar,
  ] = useState(false);

  const [
    revision,
    setRevision,
  ] = useState(0);

  // Carga el detalle del envío y permite actualizarlo mediante revision.
  useEffect(() => {
    let active = true;

    setError('');

    if (id) {
      void getEnvio(id)
        .then(
          (result) => {
            if (active) {
              setEnvio(
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
        );
    }

    return () => {
      active = false;
    };
  }, [
    id,
    revision,
  ]);

  // Actualiza periódicamente los envíos que todavía están pendientes.
  useEffect(() => {
    if (
      envio?.estado !==
      'PENDIENTE'
    ) {
      return;
    }

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
        10000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [
    envio?.estado,
  ]);

  // Cancela una programación pendiente.
  const cancel =
    async () => {
      if (
        !envio ||
        busy
      ) {
        return;
      }

      setBusy(true);
      setError('');

      try {
        const result =
          await cancelarEnvio(
            envio.id_envio
          );

        setEnvio(
          result
        );

        setConfirmar(false);
      } catch (error) {
        setError(
          authError(
            error
          )
        );

        setConfirmar(false);
      } finally {
        setBusy(false);
      }
    };

  // Determina si la programación todavía puede modificarse.
  const editable =
    envio?.estado ===
      'PENDIENTE' &&
    !!envio.fecha_programada &&
    Date.parse(
      envio.fecha_programada
    ) > Date.now();

  return (
    <section className="notificaciones-page">
      <Link
        to="/notificaciones"
        className="btn btn-outline-secondary mb-3"
      >
        <i className="bi bi-arrow-left me-2" aria-hidden="true" />
        Volver al historial
      </Link>

      <NotificacionesNav />

      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}{' '}

          <button
            className="btn btn-sm btn-outline-danger"
            onClick={() =>
              setRevision(
                (value) =>
                  value + 1
              )
            }
          >
            Reintentar
          </button>
        </div>
      )}

      {!envio &&
        !error && (
          <p role="status">
            Cargando detalle…
          </p>
        )}

      {envio && (
        <article className="card border-0 shadow-sm p-3 p-md-4">
          {location.state
            ?.editado && (
            <p
              className="alert alert-success"
              role="status"
            >
              Los cambios de la programación se guardaron correctamente.
            </p>
          )}

          {location.state
            ?.creado && (
            <p
              className="alert alert-success"
              role="status"
            >
              {envio.fecha_programada
                ? `Notificación programada para el ${fechaNotificacion(
                    envio.fecha_programada
                  )}.`
                : envio.estado ===
                    'ENVIADA'
                  ? 'Notificación enviada correctamente.'
                  : 'Envío registrado. Consultá el progreso a continuación.'}
            </p>
          )}

          <h2 className="h4">
            {envio.titulo}
          </h2>

          <p>
            <EstadoEnvio
              estado={
                envio.estado
              }
            />
          </p>

          <p className="notification-message">
            {envio.mensaje}
          </p>

          <dl className="row mb-0">
            <dt className="col-12 col-md-4">
              Enviado por
            </dt>

            <dd className="col-12 col-md-8">
              {envio.remitente}
            </dd>

            <dt className="col-12 col-md-4">
              Destinatarios
            </dt>

            <dd className="col-12 col-md-8">
              {envio.destinatarios}
              {' · '}
              {envio.cantidad}{' '}
              usuarios
            </dd>

            <dt className="col-12 col-md-4">
              Canales
            </dt>

            <dd className="col-12 col-md-8">
              CORA
              {envio.email &&
                ' + Email'}
            </dd>

            <dt className="col-12 col-md-4">
              Creación
            </dt>

            <dd className="col-12 col-md-8">
              {fechaNotificacion(
                envio.fecha_creacion
              )}
            </dd>

            <dt className="col-12 col-md-4">
              Programación
            </dt>

            <dd className="col-12 col-md-8">
              {fechaNotificacion(
                envio.fecha_programada
              )}
            </dd>

            <dt className="col-12 col-md-4">
              Última entrega
            </dt>

            <dd className="col-12 col-md-8">
              {fechaNotificacion(
                envio.fecha_envio
              )}
            </dd>
          </dl>

          <p className="mt-3 mb-1">
            {
              envio.sistema_enviadas
            }{' '}
            notificaciones internas entregadas
            {envio.email &&
              ` · ${envio.email_enviados} correos enviados`}
            .
          </p>

          {!!envio.pendientes && (
            <p role="status">
              {envio.pendientes}{' '}
              entregas pendientes.
            </p>
          )}

          {!!envio.fallidas && (
            <p className="alert alert-warning">
              {envio.fallidas}{' '}
              entregas fallidas.
              Algunos correos o
              notificaciones no
              pudieron confirmarse;
              las entregas correctas
              se conservaron.
            </p>
          )}

          {!!envio.canceladas && (
            <p className="alert alert-secondary">
              {envio.canceladas}{' '}
              entregas canceladas.
              La programación fue
              cancelada o cambiaron
              los permisos o la
              pertenencia a la
              audiencia.
            </p>
          )}

          {!!envio.fallas
            ?.length && (
            <ul>
              {envio.fallas.map(
                (item) => (
                  <li
                    key={
                      item.motivo
                    }
                  >
                    {
                      item.cantidad
                    }
                    :{' '}
                    {
                      item.motivo
                    }
                  </li>
                )
              )}
            </ul>
          )}

          {editable && (
            <div className="d-flex flex-wrap gap-2 mt-3">
              <Link
                className="btn btn-outline-primary"
                to={`/notificaciones/${envio.id_envio}/editar`}
              >
                Editar programación
              </Link>

              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={() =>
                  setConfirmar(
                    true
                  )
                }
              >
                Cancelar programación
              </button>
            </div>
          )}
        </article>
      )}

      <ConfirmationModal
        open={confirmar}
        title="Cancelar programación"
        message={
          envio?.titulo ??
          ''
        }
        confirmText="Cancelar programación"
        cancelText="Volver"
        variant="warning"
        loading={busy}
        onClose={() => {
          if (!busy) {
            setConfirmar(
              false
            );
          }
        }}
        onConfirm={() =>
          void cancel()
        }
      />
    </section>
  );
}