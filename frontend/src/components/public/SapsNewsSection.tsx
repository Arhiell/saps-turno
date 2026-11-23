import {
  useCallback,
  useState,
} from 'react';

import {
  usePublicResource,
} from '../../context/usePublicResource';

import {
  getPublicNews,
} from '../../services/public-content.service';

import NewsCard from './NewsCard';
import { PublicCarousel } from './PublicCarousel';
import ResourceState from './ResourceState';

// Cargas específicas para noticias destacadas y avisos.
const loadFeatured = () =>
  getPublicNews(1, {
    destacada: true,
  });

const loadNotices = () =>
  getPublicNews(1, {
    avisos: true,
  });

// Sección pública de novedades y avisos de las SAPS.
export default function SapsNewsSection() {
  const [page, setPage] = useState(1);

  // Mantiene la carga vinculada a la página seleccionada.
  const loader = useCallback(
    () => getPublicNews(page),
    [page]
  );

  const news =
    usePublicResource(loader);

  const featured =
    usePublicResource(loadFeatured);

  const notices =
    usePublicResource(loadNotices);

  return (
    <>
      {/* Noticias destacadas y listado general. */}
      <section
        className="container public-section"
        id="noticias"
      >
        <p className="public-eyebrow">
          INFORMACIÓN DE TU COMUNIDAD
        </p>

        <h2>
          Novedades de las SAPS
        </h2>

        <ResourceState
          {...featured}
          empty={featured.data?.items.length === 0}
          emptyText="No hay noticias destacadas."
        />

        {featured.data && (
          <PublicCarousel
            label="Noticias destacadas SAPS"
            slides={featured.data.items.map((item) => (
              <NewsCard
                key={item.id_noticia}
                news={item}
              />
            ))}
          />
        )}

        <h3 className="h4 mt-4">
          Todas las novedades
        </h3>

        <ResourceState
          {...news}
          empty={news.data?.items.length === 0}
          emptyText="No hay novedades publicadas."
        />

        <div className="row g-3 mt-1">
          {news.data?.items.map((item) => (
            <div
              className="col-md-6 col-xl-4"
              key={item.id_noticia}
            >
              <NewsCard news={item} />
            </div>
          ))}
        </div>

        {/* Navegación entre páginas de noticias. */}
        <nav
          className="d-flex flex-wrap gap-3 align-items-center mt-3"
          aria-label="Páginas de noticias"
        >
          <button
            className="btn btn-outline-success"
            disabled={page === 1 || news.loading}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </button>

          <span>
            Página {page}
          </span>

          <button
            className="btn btn-outline-success"
            disabled={
              news.loading ||
              page * 6 >= (news.data?.total ?? 0)
            }
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </button>
        </nav>
      </section>

      {/* Avisos importantes actualmente vigentes. */}
      <section
        className="container public-section"
        id="avisos"
      >
        <h2>
          <i
            className="bi bi-megaphone me-2"
            aria-hidden="true"
          />
          Avisos importantes
        </h2>

        <ResourceState
          {...notices}
          empty={notices.data?.items.length === 0}
          emptyText="No hay avisos vigentes."
        />

        {notices.data && (
          <PublicCarousel
            label="Avisos importantes"
            slides={notices.data.items.map((item) => (
              <NewsCard
                key={item.id_noticia}
                news={item}
              />
            ))}
          />
        )}
      </section>
    </>
  );
}