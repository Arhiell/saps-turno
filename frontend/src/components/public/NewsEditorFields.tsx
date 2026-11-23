import {
  useEffect,
  useState,
} from 'react';

import type {
  NewsCategory,
  NewsInput,
} from '../../types/public-content.types';

import {
  retainedNewsDate,
} from '../../utils/news-schedule';

// Propiedades necesarias para editar los datos de una noticia.
interface Props {
  value: NewsInput;
  onChange: (
    value: NewsInput
  ) => void;

  categories:
    NewsCategory[];

  salitas: {
    id_salita: string;
    nombre: string;
  }[];

  global: boolean;
  original: NewsInput | null;
}

// Convierte una fecha ISO al formato requerido por datetime-local
// sin perder la representación de la zona horaria local.
const localDate = (
  value: string | null
) => {
  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  return new Date(
    date.getTime() -
      date.getTimezoneOffset() *
        60_000
  )
    .toISOString()
    .slice(
      0,
      16
    );
};

// Campos utilizados para crear o editar una noticia.
export default function NewsEditorFields({
  value,
  original,
  onChange,
  categories,
  salitas,
  global,
}: Props) {
  const [
    now,
    setNow,
  ] =
    useState(
      Date.now
    );

  // Actualiza la hora actual para mantener vigentes
  // los límites mínimos de los campos de fecha.
  useEffect(
    () => {
      const timer =
        window.setInterval(
          () =>
            setNow(
              Date.now()
            ),
          1000
        );

      return () =>
        window.clearInterval(
          timer
        );
    },
    []
  );

  // Obtiene el comienzo del próximo minuto.
  const nextMinute = (
    date: number
  ) =>
    localDate(
      new Date(
        (
          Math.floor(
            date /
              60_000
          ) +
          1
        ) *
          60_000
      ).toISOString()
    );

  // Conserva fechas existentes al editar cuando corresponde.
  const startMin =
    retainedNewsDate(
      value,
      original,
      'fecha_publicacion'
    )
      ? undefined
      : nextMinute(
          now
        );

  const endMin =
    retainedNewsDate(
      value,
      original,
      'fecha_finalizacion'
    )
      ? undefined
      : nextMinute(
          Math.max(
            now,
            value.fecha_publicacion
              ? Date.parse(
                  value.fecha_publicacion
                )
              : now
          )
        );

  // Actualiza un campo conservando el resto del formulario.
  const update = <
    K extends keyof NewsInput,
  >(
    key: K,
    input: NewsInput[K]
  ) => {
    onChange({
      ...value,
      [key]:
        input,
    });
  };

  return (
    <div className="row g-3">
      {/* Información principal de la noticia. */}
      <div className="col-12">
        <label
          className="form-label"
          htmlFor="news-title"
        >
          Título (hasta 160 caracteres)
        </label>

        <input
          id="news-title"
          className="form-control"
          required
          maxLength={160}
          value={value.titulo}
          onChange={(event) =>
            update(
              'titulo',
              event.target.value
            )
          }
        />
      </div>

      <div className="col-12">
        <label
          className="form-label"
          htmlFor="news-summary"
        >
          Resumen (hasta 300 caracteres)
        </label>

        <textarea
          id="news-summary"
          className="form-control"
          required
          rows={3}
          maxLength={300}
          value={value.resumen}
          onChange={(event) =>
            update(
              'resumen',
              event.target.value
            )
          }
        />
      </div>

      <div className="col-12">
        <label
          className="form-label"
          htmlFor="news-content"
        >
          Contenido (texto plano, hasta 20.000 caracteres)
        </label>

        <textarea
          id="news-content"
          className="form-control"
          required
          rows={9}
          maxLength={20000}
          value={value.contenido}
          onChange={(event) =>
            update(
              'contenido',
              event.target.value
            )
          }
        />
      </div>

      {/* Categoría y alcance de la publicación. */}
      <div className="col-md-6">
        <label
          className="form-label"
          htmlFor="news-category"
        >
          Categoría
        </label>

        <select
          id="news-category"
          className="form-select"
          required
          value={value.id_categoria}
          onChange={(event) =>
            update(
              'id_categoria',
              event.target.value
            )
          }
        >
          <option value="">
            Seleccioná una categoría
          </option>

          {categories.map(
            (item) => (
              <option
                key={
                  item.id_categoria
                }
                value={
                  item.id_categoria
                }
              >
                {item.nombre}
              </option>
            )
          )}
        </select>
      </div>

      <div className="col-md-6">
        <label
          className="form-label"
          htmlFor="news-salita"
        >
          Alcance
        </label>

        <select
          id="news-salita"
          className="form-select"
          required={!global}
          value={
            value.id_salita ??
            ''
          }
          onChange={(event) =>
            update(
              'id_salita',
              event.target.value ||
                null
            )
          }
        >
          <option value="">
            {global
              ? 'Global · Todas las SAPS'
              : 'Seleccioná tu salita'}
          </option>

          {salitas.map(
            (item) => (
              <option
                key={
                  item.id_salita
                }
                value={
                  item.id_salita
                }
              >
                {item.nombre}
              </option>
            )
          )}
        </select>
      </div>

      {/* Imagen opcional de la publicación. */}
      <div className="col-12">
        <label
          className="form-label"
          htmlFor="news-image"
        >
          Imagen: URL HTTPS (opcional)
        </label>

        <input
          id="news-image"
          className="form-control"
          type="url"
          maxLength={2048}
          placeholder="https://..."
          value={
            value.imagen_url ??
            ''
          }
          onChange={(event) =>
            update(
              'imagen_url',
              event.target.value ||
                null
            )
          }
        />
      </div>

      {/* Programación de publicación y finalización. */}
      <div className="col-md-6">
        <label
          className="form-label"
          htmlFor="news-start"
        >
          Publicación (opcional; vacía = al publicar)
        </label>

        <input
          id="news-start"
          className="form-control"
          type="datetime-local"
          min={startMin}
          value={localDate(
            value.fecha_publicacion
          )}
          onChange={(event) =>
            update(
              'fecha_publicacion',
              event.target.value
                ? new Date(
                    event.target.value
                  ).toISOString()
                : null
            )
          }
        />

        <p className="form-text">
          Elegí una fecha y hora futuras. Si queda vacía,
          se registra el momento de publicar.
        </p>
      </div>

      <div className="col-md-6">
        <label
          className="form-label"
          htmlFor="news-end"
        >
          Finalización (opcional)
        </label>

        <input
          id="news-end"
          className="form-control"
          type="datetime-local"
          min={endMin}
          value={localDate(
            value.fecha_finalizacion
          )}
          onChange={(event) =>
            update(
              'fecha_finalizacion',
              event.target.value
                ? new Date(
                    event.target.value
                  ).toISOString()
                : null
            )
          }
        />

        <p className="form-text">
          Debe ser posterior a la publicación y al momento actual.
          Vacía: sin finalización automática.
        </p>
      </div>

      {/* Estado actual de la noticia. */}
      <div className="col-md-6">
        <label
          className="form-label"
          htmlFor="news-state"
        >
          Estado
        </label>

        <select
          id="news-state"
          className="form-select"
          value={value.estado}
          onChange={(event) =>
            update(
              'estado',
              event.target
                .value as NewsInput['estado']
            )
          }
        >
          <option value="BORRADOR">
            Borrador / Despublicada
          </option>

          <option value="PUBLICADA">
            Publicada
          </option>

          <option value="ARCHIVADA">
            Archivada / Retirada
          </option>
        </select>
      </div>

      {/* Permite destacar la noticia en el listado público. */}
      <div className="col-md-6 d-flex align-items-center">
        <div className="form-check mt-4">
          <input
            id="news-featured"
            className="form-check-input"
            type="checkbox"
            checked={
              value.destacada
            }
            onChange={(event) =>
              update(
                'destacada',
                event.target
                  .checked
              )
            }
          />

          <label
            className="form-check-label"
            htmlFor="news-featured"
          >
            Destacar publicación
          </label>
        </div>
      </div>

      <p className="small mb-0">
        Las fechas se ingresan en la zona horaria de tu dispositivo.
        Una noticia publicada con fecha futura se mostrará al llegar
        ese momento.
      </p>
    </div>
  );
}