import { usePublicResource } from '../../context/usePublicResource';
import { getMunicipalNews } from '../../services/public-content.service';

import ResourceState from './ResourceState';

import {
  newsDate,
} from './NewsCard';

// Muestra las noticias obtenidas desde el portal municipal de Goya.
export default function MunicipalNewsSection() {
  const resource =
    usePublicResource(
      getMunicipalNews
    );

  return (
    <section
      className="container public-section"
      id="noticias-goya"
    >
      <h2>
        Noticias de Goya
      </h2>

      <p>
        Fuente: Municipalidad de Goya
      </p>

      {/* Estado general de carga, error o ausencia de noticias. */}
      <ResourceState
        {...resource}
        error={
          resource.error
            ? 'No fue posible cargar las noticias municipales en este momento.'
            : ''
        }
        empty={
          resource.data?.estado ===
          'empty'
        }
        emptyText="No hay noticias municipales disponibles."
      />

      {/* Informa cuando la fuente municipal no pudo actualizarse. */}
      {resource.data?.estado ===
        'error' && (
        <p
          role="status"
          className="alert alert-warning"
        >
          No fue posible cargar las noticias municipales en este momento.
        </p>
      )}

      {/* Indica cuando se muestran datos almacenados de una consulta anterior. */}
      {resource.data
        ?.desactualizado && (
        <p>
          Mostramos la última consulta disponible:{' '}
          {newsDate(
            resource.data
              .actualizacion
          )}
          .
        </p>
      )}

      {/* Listado de noticias municipales disponibles. */}
      <div className="row g-3">
        {resource.data?.items.map(
          (item) => (
            <div
              className="col-md-6 col-xl-4"
              key={item.enlace}
            >
              <article className="card h-100 p-4">
                <time
                  dateTime={
                    item.fecha
                  }
                  className="small mb-2"
                >
                  {newsDate(
                    item.fecha
                  )}
                </time>

                <h3 className="h5">
                  {item.titulo}
                </h3>

                <a
                  className="mt-auto pt-3"
                  href={item.enlace}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver noticia completa{' '}
                  <i
                    className="bi bi-box-arrow-up-right"
                    aria-hidden="true"
                  />

                  <span className="visually-hidden">
                    {' '}
                    (abre en otra pestaña)
                  </span>
                </a>
              </article>
            </div>
          )
        )}
      </div>

      {/* Acceso al listado completo del portal municipal. */}
      <a
        className="btn btn-outline-primary mt-3"
        href="https://www.goya.gob.ar/?q=novedades"
        target="_blank"
        rel="noopener noreferrer"
      >
        Todas las noticias en el portal municipal
      </a>
    </section>
  );
}