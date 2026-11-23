import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom';

import {
  useAuth,
} from '../../context/AuthContext';

import {
  crearEnvioAdministrativo,
  editarEnvioAdministrativo,
  getEnvio,
  getOpcionesEnvio,
  previewEnvio,
} from '../../services/notificaciones.service';

import type {
  Audiencia,
  NuevoEnvio,
  OpcionesEnvio,
  PreviewEnvio,
  ProgramacionOriginal,
} from '../../types/notificacion.types';

import {
  authError,
} from '../../utils/auth-errors';

import ConfirmationModal
  from '../../components/ui/ConfirmationModal';

import AudienciaSelector
  from '../../components/notificaciones/AudienciaSelector';

import NotificacionesNav, {
  fechaNotificacion,
} from '../../components/notificaciones/NotificacionesNav';

// Obtiene la fecha y hora correspondientes a Argentina.
const fechaHoraArgentina = (
  timestamp: number
) => {
  const partes =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }
    ).formatToParts(
      timestamp
    );

  const valor = (
    tipo: string
  ) =>
    partes.find(
      (parte) =>
        parte.type === tipo
    )?.value ?? '';

  return {
    fecha:
      `${valor('year')}-${valor('month')}-${valor('day')}`,

    hora:
      `${valor('hour')}:${valor('minute')}`,
  };
};

interface NuevaNotificacionPageProps {
  editar?: boolean;
}

export default function NuevaNotificacionPage({
  editar = false,
}: NuevaNotificacionPageProps) {
  const {
    user,
  } = useAuth();

  const navigate =
    useNavigate();

  const {
    id,
  } = useParams();

  const [
    original,
    setOriginal,
  ] =
    useState<ProgramacionOriginal | null>(
      null
    );

  const [
    success,
    setSuccess,
  ] =
    useState<{
      id: string;
      mensaje: string;
    } | null>(
      null
    );

  const [
    reset,
    setReset,
  ] = useState(0);

  // El superadministrador puede utilizar alcance global.
  const global =
    user?.rol ===
    'SUPER_ADMIN';

  const [
    opciones,
    setOpciones,
  ] =
    useState<OpcionesEnvio>({
      salitas: [],
      especialidades: [],
    });

  const [
    ready,
    setReady,
  ] = useState(false);

  const [
    audiencia,
    setAudiencia,
  ] =
    useState<Audiencia>({
      tipo: 'USUARIOS',
    });

  const [
    individual,
    setIndividual,
  ] = useState(false);

  const [
    nombre,
    setNombre,
  ] = useState('');

  const [
    titulo,
    setTitulo,
  ] = useState('');

  const [
    mensaje,
    setMensaje,
  ] = useState('');

  const [
    email,
    setEmail,
  ] = useState(true);

  const [
    programar,
    setProgramar,
  ] = useState(false);

  const [
    fecha,
    setFecha,
  ] = useState('');

  const [
    hora,
    setHora,
  ] = useState('');

  const [
    reloj,
    setReloj,
  ] = useState(
    () => Date.now()
  );

  const [
    preview,
    setPreview,
  ] =
    useState<PreviewEnvio | null>(
      null
    );

  const [
    countLoading,
    setCountLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  const [
    countError,
    setCountError,
  ] = useState('');

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    confirmar,
    setConfirmar,
  ] =
    useState<NuevoEnvio | null>(
      null
    );

  const [
    revision,
    setRevision,
  ] = useState(0);

  // Clave utilizada para identificar la operación actual.
  const clave =
    useRef(
      crypto.randomUUID()
    );

  // Evita confirmar el mismo envío más de una vez.
  const sending =
    useRef(false);

  const key =
    JSON.stringify(
      audiencia
    );

  // Verifica que la audiencia tenga los datos mínimos requeridos.
  const validAudience =
    (
      global ||
      !!audiencia.id_salita
    ) &&
    (
      !individual ||
      !!audiencia.id_usuario
    ) &&
    (
      audiencia.tipo !==
        'ROL' ||
      !!audiencia.rol
    );

  const hoyArgentina =
    fechaHoraArgentina(
      reloj
    );

  const proximoMinutoArgentina =
    fechaHoraArgentina(
      Math.ceil(
        reloj / 60000
      ) * 60000
    );

  // Mantiene actualizada la hora utilizada por los campos de programación.
  useEffect(() => {
    const timer =
      window.setInterval(
        () =>
          setReloj(
            Date.now()
          ),
        15000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, []);

  // Carga las opciones disponibles y, al editar, la programación existente.
  useEffect(() => {
    let active = true;

    setReady(false);
    setError('');

    void Promise.all([
      getOpcionesEnvio(),
      editar && id
        ? getEnvio(id)
        : Promise.resolve(
            null
          ),
    ])
      .then(
        ([
          result,
          envio,
        ]) => {
          if (!active) {
            return;
          }

          // Solo permite editar programaciones futuras que sigan pendientes.
          if (
            editar &&
            (
              !envio ||
              envio.estado !==
                'PENDIENTE' ||
              !envio.fecha_programada ||
              Date.parse(
                envio.fecha_programada
              ) <=
                Date.now()
            )
          ) {
            throw new Error(
              'Esta notificación ya no se puede editar. Solo se admiten programaciones futuras sin iniciar.'
            );
          }

          if (envio) {
            const {
              audiencia,
              titulo,
              mensaje,
              email,
              fecha_programada,
            } = envio;

            // Conserva la programación original para validar la edición.
            setOriginal({
              audiencia,
              titulo,
              mensaje,
              email,
              fecha_programada,
            });

            setAudiencia(
              audiencia
            );

            setTitulo(
              titulo
            );

            setMensaje(
              mensaje
            );

            setEmail(
              email
            );

            setIndividual(
              !!audiencia.id_usuario
            );

            setNombre(
              envio.destinatarios
            );

            setProgramar(
              true
            );

            // Convierte el instante guardado al horario de Argentina
            // para completar los inputs de fecha y hora.
            const local =
              new Date(
                Date.parse(
                  fecha_programada!
                ) -
                  3 *
                    3600000
              ).toISOString();

            setFecha(
              local.slice(
                0,
                10
              )
            );

            setHora(
              local.slice(
                11,
                16
              )
            );
          }

          setOpciones(
            result
          );

          setReady(
            true
          );
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

    return () => {
      active = false;
    };
  }, [
    revision,
    editar,
    id,
  ]);

  // Calcula automáticamente la cantidad de destinatarios.
  useEffect(() => {
    let active = true;

    setPreview(null);
    setCountError('');
    setCountLoading(false);

    if (!validAudience) {
      return;
    }

    setCountLoading(
      true
    );

    const timer =
      window.setTimeout(
        () => {
          void previewEnvio(
            JSON.parse(
              key
            ) as Audiencia
          )
            .then(
              (result) => {
                if (active) {
                  setPreview(
                    result
                  );
                }
              }
            )
            .catch(
              (error) => {
                if (active) {
                  setCountError(
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
                  setCountLoading(
                    false
                  );
                }
              }
            );
        },
        250
      );

    return () => {
      active = false;

      window.clearTimeout(
        timer
      );
    };
  }, [
    key,
    validAudience,
    revision,
    reset,
  ]);

  // Genera una descripción legible de la audiencia seleccionada.
  const grupo = [
    individual
      ? nombre
      : {
          USUARIOS:
            'Todos los usuarios',
          PACIENTES:
            'Pacientes',
          PROFESIONALES:
            'Profesionales',
          ADMINISTRADORES:
            'Administradores',
          ROL:
            `Rol ${audiencia.rol ?? ''}`,
        }[audiencia.tipo],

    opciones.salitas.find(
      (item) =>
        item.id_salita ===
        audiencia.id_salita
    )?.nombre,

    opciones.especialidades.find(
      (item) =>
        item.id_especialidad ===
        audiencia.id_especialidad
    )?.nombre,
  ]
    .filter(Boolean)
    .join(' · ');

  // Valida el formulario y prepara la confirmación del envío.
  const revisar = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    setError('');

    if (
      !validAudience ||
      busy
    ) {
      return;
    }

    // Valida el asunto antes de solicitar la confirmación.
    if (
      !/^[\p{L}\p{N} .,;:¿?¡!()'"\-]+$/u.test(
        titulo.trim()
      ) ||
      titulo.trim().length <
        3 ||
      titulo.trim().length >
        160
    ) {
      setError(
        'El asunto debe tener entre 3 y 160 caracteres, sin HTML, emojis ni caracteres especiales.'
      );

      return;
    }

    // Valida el contenido permitido para el mensaje.
    if (
      !/^[\p{L}\p{N} .,;:¿?¡!()'"\-\n/@%+ºª°€$&=]+$/u.test(
        mensaje.trim()
      ) ||
      mensaje.trim().length <
        3 ||
      mensaje.trim().length >
        2000
    ) {
      setError(
        'El mensaje debe tener entre 3 y 2000 caracteres, sin HTML, emojis ni caracteres de control.'
      );

      return;
    }

    // Construye la fecha con UTC−3 independientemente
    // de la zona horaria configurada en el dispositivo.
    const instant =
      programar
        ? new Date(
            `${fecha}T${hora}:00-03:00`
          )
        : null;

    if (
      programar &&
      (
        !instant ||
        !Number.isFinite(
          instant.getTime()
        ) ||
        instant.getTime() <=
          Date.now()
      )
    ) {
      setError(
        'Seleccioná una fecha y hora futuras.'
      );

      return;
    }

    setBusy(true);

    try {
      // Recalcula los destinatarios antes de mostrar la confirmación.
      const actual =
        await previewEnvio(
          audiencia
        );

      setPreview(
        actual
      );

      if (
        !actual.cantidad
      ) {
        setError(
          'No se encontraron destinatarios.'
        );

        return;
      }

      setConfirmar({
        audiencia,
        titulo:
          titulo.trim(),
        mensaje:
          mensaje.trim(),
        email,
        fecha_programada:
          instant?.toISOString() ??
          null,
        confirmacion:
          actual.confirmacion,
        clave:
          clave.current,
      });
    } catch (error) {
      setError(
        authError(
          error
        )
      );
    } finally {
      setBusy(false);
    }
  };

  // Confirma la creación o edición de la notificación.
  const enviar =
    async () => {
      if (
        !confirmar ||
        sending.current
      ) {
        return;
      }

      // Vuelve a comprobar la fecha antes de guardar.
      if (
        confirmar.fecha_programada &&
        Date.parse(
          confirmar.fecha_programada
        ) <= Date.now()
      ) {
        setConfirmar(
          null
        );

        setError(
          'La fecha y hora seleccionadas ya pasaron. Elegí un horario futuro y volvé a confirmar.'
        );

        return;
      }

      sending.current =
        true;

      setBusy(true);
      setError('');

      try {
        if (editar) {
          if (
            !id ||
            !original
          ) {
            throw new Error(
              'No se pudo cargar la programación original.'
            );
          }

          await editarEnvioAdministrativo(
            id,
            confirmar,
            original
          );

          navigate(
            `/notificaciones/${id}`,
            {
              replace: true,
              state: {
                editado:
                  true,
              },
            }
          );
        } else {
          const envio =
            await crearEnvioAdministrativo(
              confirmar
            );

          setSuccess({
            id:
              envio.id_envio,

            mensaje:
              confirmar.fecha_programada
                ? `Notificación programada para el ${fechaNotificacion(
                    confirmar.fecha_programada
                  )}.`
                : 'Notificación registrada correctamente para su envío. Podés consultar el progreso en el detalle.',
          });

          // Limpia el formulario únicamente después de confirmar el guardado.
          setAudiencia({
            tipo: 'USUARIOS',
          });

          setIndividual(
            false
          );

          setNombre('');
          setTitulo('');
          setMensaje('');
          setEmail(true);
          setProgramar(false);
          setFecha('');
          setHora('');
          setPreview(null);
          setCountError('');
          setConfirmar(null);

          setReset(
            (value) =>
              value + 1
          );

          // La próxima notificación utiliza una nueva clave.
          clave.current =
            crypto.randomUUID();
        }
      } catch (error) {
        setError(
          authError(
            error
          )
        );

        setConfirmar(
          null
        );
      } finally {
        sending.current =
          false;

        setBusy(false);
      }
    };

  // Una modificación inicia una operación nueva;
  // los reintentos conservan la misma clave.
  const changed = () => {
    clave.current =
      crypto.randomUUID();
  };

  return (
    <section className="notificaciones-page">
      <NotificacionesNav />

      {success && (
        <div
          className="alert alert-success"
          role="status"
        >
          {success.mensaje}{' '}

          <Link
            to={`/notificaciones/${success.id}`}
          >
            Ver detalle del envío
          </Link>
        </div>
      )}

      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}

          {!ready && (
            <>
              {' '}

              <button
                type="button"
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
            </>
          )}
        </div>
      )}

      {!ready &&
        !error && (
          <p role="status">
            Cargando opciones…
          </p>
        )}

      <form
        onSubmit={
          revisar
        }
        onChange={
          changed
        }
        className="card border-0 shadow-sm p-3 p-md-4"
      >
        <fieldset
          disabled={
            !ready ||
            busy ||
            !!confirmar
          }
        >
          <legend className="h5 mb-3">
            {editar
              ? 'Editar notificación programada'
              : 'Nueva notificación'}
          </legend>

          <AudienciaSelector
            key={reset}
            value={
              audiencia
            }
            onChange={(
              value
            ) => {
              setAudiencia(
                value
              );

              changed();
            }}
            opciones={
              opciones
            }
            global={
              global
            }
            individual={
              individual
            }
            onIndividual={
              setIndividual
            }
            onNombre={
              setNombre
            }
          />

          {individual &&
            audiencia.id_usuario &&
            nombre && (
              <p className="form-text">
                Destinatario seleccionado:{' '}
                {nombre}
              </p>
            )}

          <p
            className="form-text mt-3"
            role="status"
          >
            {countLoading
              ? 'Calculando destinatarios…'
              : preview
                ? `${preview.cantidad} destinatarios encontrados`
                : 'Completá la selección de destinatarios.'}
          </p>

          {countError && (
            <p
              className="text-danger"
              role="alert"
            >
              {countError}{' '}

              <button
                type="button"
                className="btn btn-sm btn-link"
                onClick={() =>
                  setRevision(
                    (value) =>
                      value + 1
                  )
                }
              >
                Reintentar
              </button>
            </p>
          )}

          <label
            htmlFor="notificacion-asunto"
            className="form-label"
          >
            Asunto
          </label>

          <input
            id="notificacion-asunto"
            className="form-control"
            value={
              titulo
            }
            onChange={(
              e
            ) =>
              setTitulo(
                e.target.value
              )
            }
            minLength={3}
            maxLength={160}
            required
          />

          <p className="form-text">
            {titulo.length}
            /160 caracteres
          </p>

          <label
            htmlFor="notificacion-mensaje"
            className="form-label"
          >
            Mensaje
          </label>

          <textarea
            id="notificacion-mensaje"
            className="form-control"
            rows={6}
            value={
              mensaje
            }
            onChange={(
              e
            ) =>
              setMensaje(
                e.target.value
              )
            }
            minLength={3}
            maxLength={2000}
            required
          />

          <p className="form-text">
            {mensaje.length}
            /2000 caracteres.
            Texto sin HTML ni emojis.
          </p>

          <fieldset className="mb-3">
            <legend className="h6">
              Envío
            </legend>

            {!editar && (
              <label className="me-3">
                <input
                  className="form-check-input me-2"
                  type="radio"
                  name="envio"
                  checked={
                    !programar
                  }
                  onChange={() =>
                    setProgramar(
                      false
                    )
                  }
                />

                Enviar ahora
              </label>
            )}

            <label>
              <input
                className="form-check-input me-2"
                type="radio"
                name="envio"
                checked={
                  programar
                }
                onChange={() =>
                  setProgramar(
                    true
                  )
                }
              />

              Programar
            </label>
          </fieldset>

          {programar && (
            <div className="row g-3 mb-3">
              <div className="col-12 col-md-6">
                <label
                  htmlFor="envio-fecha"
                  className="form-label"
                >
                  Fecha
                </label>

                <input
                  id="envio-fecha"
                  type="date"
                  className="form-control"
                  required
                  min={
                    hoyArgentina.fecha
                  }
                  value={
                    fecha
                  }
                  onChange={(
                    e
                  ) =>
                    setFecha(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="col-12 col-md-6">
                <label
                  htmlFor="envio-hora"
                  className="form-label"
                >
                  Hora de Argentina (UTC−3)
                </label>

                <input
                  id="envio-hora"
                  type="time"
                  className="form-control"
                  required
                  min={
                    fecha ===
                    hoyArgentina.fecha
                      ? proximoMinutoArgentina.hora
                      : undefined
                  }
                  value={
                    hora
                  }
                  onChange={(
                    e
                  ) =>
                    setHora(
                      e.target.value
                    )
                  }
                />
              </div>
            </div>
          )}

          <fieldset className="mb-3">
            <legend className="h6">
              Canales
            </legend>

            <label className="d-block">
              <input
                className="form-check-input me-2"
                type="checkbox"
                checked
                disabled
              />

              CORA (obligatorio)
            </label>

            <label className="d-block mt-2">
              <input
                className="form-check-input me-2"
                type="checkbox"
                checked={
                  email
                }
                onChange={(
                  e
                ) =>
                  setEmail(
                    e.target.checked
                  )
                }
              />

              Correo electrónico
            </label>
          </fieldset>

          <button
            type="submit"
            className="btn btn-success notification-submit"
            disabled={
              !validAudience ||
              countLoading ||
              !preview?.cantidad
            }
          >
            {busy
              ? 'Procesando…'
              : editar
                ? 'Revisar cambios'
                : 'Revisar y confirmar'}
          </button>

          {editar && (
            <Link
              className="btn btn-outline-secondary ms-2 mt-2"
              to={`/notificaciones/${id}`}
            >
              Volver sin guardar
            </Link>
          )}
        </fieldset>
      </form>

      <ConfirmationModal
        open={
          !!confirmar
        }
        title={
          editar
            ? 'Guardar cambios de programación'
            : programar
              ? 'Programar notificación'
              : 'Enviar notificación'
        }
        message={
          confirmar?.titulo ??
          ''
        }
        detail={
          <div>
            <p>
              {grupo}
            </p>

            <p>
              {preview?.cantidad}{' '}
              destinatarios · CORA
              {email
                ? ' + Email'
                : ''}
            </p>

            <p>
              {confirmar?.fecha_programada
                ? `Programada: ${fechaNotificacion(
                    confirmar.fecha_programada
                  )}`
                : 'Enviar ahora'}
            </p>
          </div>
        }
        confirmText={
          editar
            ? 'Guardar cambios'
            : programar
              ? 'Confirmar programación'
              : 'Confirmar envío'
        }
        variant="success"
        loading={
          busy
        }
        onClose={() => {
          if (!busy) {
            setConfirmar(
              null
            );
          }
        }}
        onConfirm={() =>
          void enviar()
        }
      />
    </section>
  );
}