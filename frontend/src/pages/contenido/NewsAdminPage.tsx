import { 
  useCallback, 
  useState 
} from 'react';

import { 
  Link, 
  useLocation 
} from 'react-router-dom';

import ResourceState from '../../components/public/ResourceState';

import { 
  useAuth 
} from '../../context/AuthContext';

import { 
  usePublicResource 
} from '../../context/usePublicResource';

import { 
  getAdminNews 
} from '../../services/public-content.service';

// Formatea fechas administrativas usando la zona horaria de Argentina.
const adminDate = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
    hourCycle: 'h23',
  }).format(new Date(value));

// Panel administrativo para gestionar las noticias públicas.
export default function NewsAdminPage() {
  const { user } = useAuth();
  const { state } = useLocation();

  const [page, setPage] = useState(1);

  // Mantiene la carga vinculada a la página seleccionada.
  const load = useCallback(
    () => getAdminNews(page),
    [page]
  );

  const resource = usePublicResource(load);

  return (
    <section className="container-fluid">
      {/* Encabezado y acceso a la creación de noticias. */}
      <div className="d-flex flex-wrap gap-3 justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">
          Contenido público · Noticias
        </h1>

        <Link
          className="btn btn-success"
          to="/contenido/nueva"
        >
          <i
            className="bi bi-plus-lg me-2"
            aria-hidden="true"
          />
          Crear noticia
        </Link>
      </div>

      {/* Descripción según el rol administrativo. */}
      <p>
        {user?.rol === 'SUPER_ADMIN'
          ? 'Administrá las noticias globales y moderá las publicaciones de las salitas.'
          : 'Gestioná tus publicaciones de las salitas que tenés asignadas.'}
      </p>

      {/* Mensaje recibido desde otra navegación, por ejemplo después de guardar. */}
      {typeof state?.message === 'string' && (
        <p
          className="alert alert-success"
          role="status"
        >
          {state.message}
        </p>
      )}

      <ResourceState
        {...resource}
        empty={resource.data?.items.length === 0}
        emptyText="Todavía no hay publicaciones en tu alcance."
      />

      {/* Noticias disponibles dentro del alcance del administrador. */}
      <div className="row g-3">
        {resource.data?.items.map((news) => (
          <div
            className="col-md-6 col-xl-4"
            key={news.id_noticia}
          >
            <article className="card h-100 p-3">
              <div className="d-flex flex-wrap gap-2 mb-3">
                <span className="badge text-bg-secondary">
                  {news.estado}
                </span>

                {news.destacada && (
                  <span className="badge text-bg-success">
                    Destacada
                  </span>
                )}
              </div>

              <h2 className="h5">
                {news.titulo}
              </h2>

              <p>
                {news.resumen}
              </p>

              <p className="small">
                {news.salita?.nombre ?? 'Global'} ·{' '}
                {news.categoria.nombre}
              </p>

              <p className="small">
                Publicación:{' '}
                {news.fecha_publicacion
                  ? `${adminDate(news.fecha_publicacion)} h`
                  : 'Al publicar'}
              </p>

              <p className="small">
                Finalización:{' '}
                {news.fecha_finalizacion
                  ? `${adminDate(news.fecha_finalizacion)} h`
                  : 'Sin finalización automática'}
              </p>

              <p className="small text-muted">
                Hora de Argentina (UTC−3)
              </p>

              <Link
                className="btn btn-outline-primary mt-auto"
                to={`/contenido/${news.id_noticia}/editar`}
              >
                Editar / Gestionar estado
              </Link>
            </article>
          </div>
        ))}
      </div>

      {/* Navegación entre páginas del contenido administrativo. */}
      <nav
        className="d-flex flex-wrap gap-3 align-items-center mt-4"
        aria-label="Páginas de contenido público"
      >
        <button
          className="btn btn-outline-secondary"
          disabled={page === 1 || resource.loading}
          onClick={() => setPage(page - 1)}
        >
          Anterior
        </button>

        <span>
          Página {page}
        </span>

        <button
          className="btn btn-outline-secondary"
          disabled={
            resource.loading ||
            page * 9 >= (resource.data?.total ?? 0)
          }
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </button>
      </nav>
    </section>
  );
}