// Categoría utilizada para clasificar las noticias.
export interface NewsCategory {
  id_categoria: string;
  nombre: string;
  es_aviso: boolean;
}

// Información de una noticia visible desde el sitio público.
export interface PublicNews {
  id_noticia: string;
  titulo: string;
  resumen: string;
  contenido: string;
  imagen_url: string | null;
  fecha_publicacion: string | null;
  fecha_finalizacion: string | null;
  destacada: boolean;
  categoria: NewsCategory;
  salita: {
    id_salita: string;
    nombre: string;
  } | null;
}

// Campos editables al crear o modificar una noticia.
export interface NewsInput {
  titulo: string;
  resumen: string;
  contenido: string;
  imagen_url: string | null;
  id_salita: string | null;
  id_categoria: string;
  destacada: boolean;
  estado: 'BORRADOR' | 'PUBLICADA' | 'ARCHIVADA';
  fecha_publicacion: string | null;
  fecha_finalizacion: string | null;
}

// Información adicional disponible para la administración.
export interface AdminNews extends PublicNews, NewsInput {
  id_autor: string;
  fecha_actualizacion: string;
}

// Respuesta paginada de noticias.
// Por defecto contiene noticias públicas, pero permite otros tipos.
export interface NewsList<T = PublicNews> {
  items: T[];
  total: number;
}

// Información de una salita expuesta en la página pública.
export interface PublicSalita {
  id_salita: string;
  nombre: string;
  direccion: string;
  telefono: string | null;
  horario_apertura: string | null;
  horario_cierre: string | null;
  zona: string | null;
}

// Noticia obtenida desde la fuente institucional municipal.
export interface MunicipalNews {
  titulo: string;
  enlace: string;
  fecha: string;
}

// Resultado de la consulta de noticias municipales.
export interface MunicipalResult {
  items: MunicipalNews[];
  estado: 'success' | 'empty' | 'error';
  fuente: string;
  actualizacion: string | null;
  desactualizado: boolean;
}