import { 
  useCallback 
} from 'react';

import { 
  Link, 
  useParams 
} from 'react-router-dom';

import { 
  newsDate 
} from '../../components/public/NewsCard';

import ResourceState from '../../components/public/ResourceState';

import { 
  usePublicResource 
} from '../../context/usePublicResource';

import { 
  getPublicNewsDetail 
} from '../../services/public-content.service';

// Página pública con el contenido completo de una noticia.
export default function PublicNewsDetailPage() {
  const { id = '' } = useParams();

  // Mantiene la carga vinculada al identificador de la noticia.
  const loader = useCallback(
    () => getPublicNewsDetail(id),
    [id]
  );

  const resource = usePublicResource(loader);
  const news = resource.data;

  return (
    <div className="container public-section public-article">
      {/* Regreso a la sección de noticias de la página principal. */}
      <Link
        to="/#noticias"
        className="btn btn-outline-success mb-4"
      >
        <i
          className="bi bi-arrow-left me-2"
          aria-hidden="true"
        />
        Volver a noticias
      </Link>

      {/* Estado de carga o error del recurso. */}
      <ResourceState {...resource} />

      {/* Contenido completo de la noticia. */}
      {news && (
        <article>
          <p className="public-eyebrow">
            {news.categoria.nombre}
          </p>

          <h1>
            {news.titulo}
          </h1>

          <p>
            {newsDate(news.fecha_publicacion)} ·{' '}
            {news.salita?.nombre ?? 'CORA'}
          </p>

          <p className="small">
            Autor institucional:{' '}
            {news.salita
              ? `Equipo de ${news.salita.nombre}`
              : 'Administración CORA'}
          </p>

          <p className="lead">
            {news.resumen}
          </p>

          {/* Imagen de la publicación, si está disponible. */}
          {news.imagen_url && (
            <img
              className="public-article-image mb-4"
              src={news.imagen_url}
              alt={news.titulo}
              referrerPolicy="no-referrer"
            />
          )}

          {/* El contenido se presenta como texto plano. */}
          <div className="public-plain-content">
            {news.contenido}
          </div>
        </article>
      )}
    </div>
  );
}