import { Link } from 'react-router-dom';

import type {
  PublicNews,
} from '../../types/public-content.types';

// Formatea la fecha de publicación con la zona horaria de Argentina.
export const newsDate = (
  value: string | null
) =>
  value
    ? new Intl.DateTimeFormat(
        'es-AR',
        {
          dateStyle:
            'medium',
          timeZone:
            'America/Argentina/Buenos_Aires',
        }
      ).format(
        new Date(
          value
        )
      )
    : 'Sin fecha de publicación';

// Representa una noticia dentro del listado público.
export default function NewsCard({
  news,
}: {
  news: PublicNews;
}) {
  return (
    <article className="card h-100 public-news-card">
      {/* Imagen de portada de la noticia, si está disponible. */}
      {news.imagen_url && (
        <img
          className="card-img-top"
          src={news.imagen_url}
          alt={news.titulo}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}

      <div className="card-body d-flex flex-column">
        {/* Categoría y fecha de publicación. */}
        <p className="small">
          <span className="badge text-bg-success me-2">
            {news.categoria.nombre}
          </span>

          {newsDate(
            news.fecha_publicacion
          )}
        </p>

        <h3 className="h5">
          {news.titulo}
        </h3>

        <p>
          {news.resumen}
        </p>

        {/* Salita responsable o información general del sistema. */}
        <p className="small">
          {news.salita
            ?.nombre ??
            'CORA · Información general'}
        </p>

        {/* Acceso al detalle completo de la noticia. */}
        <Link
          className="btn btn-outline-success mt-auto align-self-start"
          to={`/noticias/${news.id_noticia}`}
          aria-label={`Leer más: ${news.titulo}`}
        >
          Leer más{' '}
          <i
            className="bi bi-arrow-right"
            aria-hidden="true"
          />
        </Link>
      </div>
    </article>
  );
}