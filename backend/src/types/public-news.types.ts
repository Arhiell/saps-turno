import type {
  NewsInput,
} from '../validators/public-news.validator.js';

// Representa una noticia disponible en la sección pública.
export interface PublicNews {
  id_noticia: string;

  titulo: string;
  resumen: string;
  contenido: string;

  imagen_url: string | null;

  fecha_publicacion:
    string | null;

  fecha_finalizacion:
    string | null;

  destacada: boolean;

  // Categoría pública asociada a la noticia.
  categoria: {
    id_categoria: string;
    nombre: string;
    es_aviso: boolean;
  };

  // Salita asociada, si la publicación pertenece a una.
  salita: {
    id_salita: string;
    nombre: string;
  } | null;
}

// Extiende la información pública con los datos
// necesarios para la administración de la noticia.
export interface AdminNews
  extends PublicNews,
    NewsInput {
  id_autor: string;
  fecha_actualizacion: string;
}