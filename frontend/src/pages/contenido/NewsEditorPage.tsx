import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import NewsEditorFields from '../../components/public/NewsEditorFields';
import ConfirmationModal from '../../components/ui/ConfirmationModal';

import { useAuth } from '../../context/AuthContext';

import {
  getAdminNewsDetail,
  getNewsCategories,
  saveNews,
} from '../../services/public-content.service';

import { getAdminSalitas } from '../../services/salitas.service';

import type {
  NewsCategory,
  NewsInput,
} from '../../types/public-content.types';

import { authError } from '../../utils/auth-errors';
import { newsScheduleError } from '../../utils/news-schedule';

// Valores iniciales de una nueva publicación.
const empty: NewsInput = {
  titulo: '',
  resumen: '',
  contenido: '',
  imagen_url: null,
  id_salita: null,
  id_categoria: '',
  destacada: false,
  estado: 'BORRADOR',
  fecha_publicacion: null,
  fecha_finalizacion: null,
};

// Formulario administrativo para crear o editar noticias públicas.
export default function NewsEditorPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const navigate = useNavigate();

  const [value, setValue] = useState<NewsInput>(empty);
  const [original, setOriginal] = useState<NewsInput | null>(null);

  const [categories, setCategories] = useState<NewsCategory[]>([]);

  const [salitas, setSalitas] = useState<
    {
      id_salita: string;
      nombre: string;
    }[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const [modal, setModal] = useState<
    'save' | 'cancel' | 'success' | 'error' | null
  >(null);

  // Detecta si alguno de los campos editables fue modificado.
  const dirty = Object.keys(empty).some(
    (key) =>
      value[key as keyof NewsInput] !==
      (original ?? empty)[key as keyof NewsInput]
  );

  // Solicita confirmación antes de salir cuando existen cambios.
  const requestCancel = () => {
    if (busy) {
      return;
    }

    if (dirty) {
      setModal('cancel');
    } else {
      navigate('/contenido');
    }
  };

  // Carga categorías, salitas y la publicación existente al editar.
  useEffect(() => {
    let active = true;

    setLoading(true);
    setReady(false);
    setError('');

    Promise.all([
      getNewsCategories(),
      getAdminSalitas(),
      id
        ? getAdminNewsDetail(id)
        : Promise.resolve(null),
    ])
      .then(
        ([
          options,
          sites,
          news,
        ]) => {
          if (!active) {
            return;
          }

          setCategories(options);

          setSalitas(
            sites.data.filter(
              (item) => item.activo
            )
          );

          setOriginal(news);

          // Envía al formulario únicamente los campos editables.
          // La autoría nunca proviene de los datos del formulario.
          setValue(
            news
              ? (Object.fromEntries(
                  Object.keys(empty).map((key) => [
                    key,
                    news[key as keyof NewsInput],
                  ])
                ) as unknown as NewsInput)
              : empty
          );

          setReady(true);
        }
      )
      .catch((cause) => {
        if (active) {
          setError(
            authError(cause)
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    // Evita actualizar el estado después de desmontar el componente.
    return () => {
      active = false;
    };
  }, [id, attempt]);

  // Valida el formulario antes de solicitar la confirmación.
  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (busy || !ready) {
      return;
    }

    const scheduleError =
      newsScheduleError(
        value,
        original
      );

    if (scheduleError) {
      setError(scheduleError);
      setModal('error');
      return;
    }

    setError('');
    setModal('save');
  };

  // Guarda la publicación después de la confirmación del usuario.
  const confirmSave = async () => {
    if (busy || !ready) {
      return;
    }

    // Se valida nuevamente para evitar guardar datos
    // que hayan quedado inválidos antes de confirmar.
    const scheduleError =
      newsScheduleError(
        value,
        original
      );

    if (scheduleError) {
      setError(scheduleError);
      setModal('error');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await saveNews(
        id,
        value
      );

      setModal('success');
    } catch (cause) {
      setError(
        authError(cause)
      );

      setModal('error');
    } finally {
      setBusy(false);
    }
  };

  // Mensaje mostrado antes de guardar según el estado seleccionado.
  const saveMessage =
    value.estado === 'BORRADOR'
      ? 'Se guardará como borrador y no será visible en la página pública.'
      : value.estado === 'ARCHIVADA'
        ? 'La publicación quedará archivada y no será visible en la página pública.'
        : value.fecha_publicacion
          ? 'Se guardará como publicada y será visible dentro de las fechas indicadas.'
          : 'La publicación será visible en la página pública al guardar.';

  return (
    <section className="container-fluid">
      {/* Regreso al listado con protección frente a cambios sin guardar. */}
      <button
        type="button"
        className="btn btn-outline-secondary mb-3"
        disabled={
          busy ||
          modal === 'success'
        }
        onClick={requestCancel}
      >
        <i className="bi bi-arrow-left me-2" aria-hidden="true" />
        Volver a contenido público
      </button>

      <h1 className="h3">
        {id
          ? 'Editar publicación'
          : 'Crear noticia pública'}
      </h1>

      <p>
        El contenido publicado será visible sin iniciar sesión.
      </p>

      {/* Estado inicial de carga. */}
      {loading && (
        <p role="status">
          Cargando formulario...
        </p>
      )}

      {/* Error de carga o validación. */}
      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}

          {!ready && (
            <button
              className="btn btn-outline-secondary d-block mt-2"
              onClick={() =>
                setAttempt(
                  attempt + 1
                )
              }
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      {/* Formulario disponible una vez finalizada la carga inicial. */}
      {ready && (
        <form
          className="card p-3 p-md-4"
          onSubmit={submit}
        >
          <fieldset disabled={busy}>
            <NewsEditorFields
              value={value}
              original={original}
              onChange={setValue}
              categories={categories}
              salitas={salitas}
              global={
                user?.rol ===
                'SUPER_ADMIN'
              }
            />
          </fieldset>

          <div className="d-flex flex-column flex-sm-row gap-2 mt-4">
            <button
              className="btn btn-success"
              disabled={
                busy ||
                modal === 'success'
              }
              type="submit"
            >
              {busy
                ? 'Guardando...'
                : 'Guardar publicación'}
            </button>

            <button
              className="btn btn-outline-secondary"
              disabled={
                busy ||
                modal === 'success'
              }
              type="button"
              onClick={requestCancel}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Confirmación previa al guardado. */}
      <ConfirmationModal
        open={modal === 'save'}
        title="Guardar publicación"
        subtitle="Revisá el estado antes de confirmar."
        message={saveMessage}
        detail={
          <>
            <strong>
              {value.titulo}
            </strong>

            <p className="small mb-0 mt-2">
              Estado: {value.estado}
            </p>
          </>
        }
        confirmText="Confirmar y guardar"
        cancelText="Seguir editando"
        variant="primary"
        icon="bi-check-circle"
        loading={busy}
        onClose={() => {
          if (!busy) {
            setModal(null);
          }
        }}
        onConfirm={() =>
          void confirmSave()
        }
      />

      {/* Confirmación para descartar cambios. */}
      <ConfirmationModal
        open={modal === 'cancel'}
        title="Descartar cambios"
        subtitle="Tenés cambios sin guardar."
        message="¿Querés salir y descartar los cambios de esta publicación?"
        notice="La publicación guardada anteriormente, si existe, no se modificará."
        confirmText="Descartar y salir"
        cancelText="Seguir editando"
        variant="warning"
        icon="bi-arrow-left"
        onClose={() =>
          setModal(null)
        }
        onConfirm={() =>
          navigate('/contenido')
        }
      />

      {/* Resultado exitoso del guardado. */}
      <ConfirmationModal
        open={modal === 'success'}
        title="Publicación guardada"
        subtitle="La operación se completó correctamente."
        message={
          value.estado === 'BORRADOR'
            ? 'El borrador se guardó. Todavía no es visible en la página pública.'
            : value.estado === 'ARCHIVADA'
              ? 'La publicación quedó archivada y no es visible en la página pública.'
              : 'La publicación se guardó y se mostrará durante el período de publicación definido.'
        }
        notice={null}
        hideCancel
        confirmText="Volver al listado"
        variant="success"
        icon="bi-check-circle"
        onClose={() =>
          navigate('/contenido')
        }
        onConfirm={() =>
          navigate('/contenido')
        }
      />

      {/* Error producido durante la validación o el guardado. */}
      <ConfirmationModal
        open={modal === 'error'}
        title="No se pudo guardar"
        subtitle="Revisá la información e intentá nuevamente."
        message={error}
        notice={null}
        hideCancel
        confirmText="Entendido"
        variant="danger"
        icon="bi-exclamation-circle"
        onClose={() =>
          setModal(null)
        }
        onConfirm={() =>
          setModal(null)
        }
      />
    </section>
  );
}