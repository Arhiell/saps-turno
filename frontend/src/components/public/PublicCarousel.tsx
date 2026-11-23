import {
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react';

// Propiedades configurables del carrusel público.
interface Props {
  label: string;
  slides: ReactNode[];
  autoPlay?: boolean;
  slideLabels?: string[];
}

// Carrusel reutilizable para contenido público.
export function PublicCarousel({
  label,
  slides,
  autoPlay = false,
  slideLabels,
}: Props) {
  const [
    index,
    setIndex,
  ] = useState(0);

  const [
    paused,
    setPaused,
  ] = useState(false);

  const [
    hovered,
    setHovered,
  ] = useState(false);

  const [
    focused,
    setFocused,
  ] = useState(false);

  const [
    reducedMotion,
    setReducedMotion,
  ] = useState(false);

  const selectorId =
    useId();

  // Evita que el índice quede fuera de rango
  // si cambia la cantidad de diapositivas.
  const current =
    Math.min(
      index,
      Math.max(
        0,
        slides.length - 1
      )
    );

  // Respeta la preferencia del usuario de reducir animaciones.
  useEffect(
    () => {
      const media =
        window.matchMedia(
          '(prefers-reduced-motion: reduce)'
        );

      const update = () =>
        setReducedMotion(
          media.matches
        );

      update();

      media.addEventListener(
        'change',
        update
      );

      return () =>
        media.removeEventListener(
          'change',
          update
        );
    },
    []
  );

  // Solo rota automáticamente cuando no existe una pausa activa.
  const rotating =
    autoPlay &&
    !paused &&
    !hovered &&
    !focused &&
    !reducedMotion &&
    slides.length > 1;

  // Avanza automáticamente cada cinco segundos.
  useEffect(
    () => {
      if (!rotating) {
        return;
      }

      const timer =
        window.setInterval(
          () => {
            if (
              !document.hidden
            ) {
              setIndex(
                (
                  current +
                  1
                ) %
                  slides.length
              );
            }
          },
          5000
        );

      return () =>
        window.clearInterval(
          timer
        );
    },
    [
      rotating,
      current,
      slides.length,
    ]
  );

  // No renderiza el carrusel cuando no existen diapositivas.
  if (!slides.length) {
    return null;
  }

  return (
    <div
      className="carousel public-carousel"
      role="region"
      aria-roledescription="carrusel"
      aria-label={label}
      onMouseEnter={() =>
        setHovered(
          true
        )
      }
      onMouseLeave={() =>
        setHovered(
          false
        )
      }
      onFocusCapture={() =>
        setFocused(
          true
        )
      }
      onBlurCapture={(
        event
      ) => {
        if (
          !event.currentTarget.contains(
            event.relatedTarget
          )
        ) {
          setFocused(
            false
          );
        }
      }}
    >
      {/* Selector directo de diapositivas, si se proporcionan etiquetas. */}
      {slideLabels &&
        slides.length >
          1 && (
          <div className="mb-3">
            <label
              className="form-label fw-semibold"
              htmlFor={
                selectorId
              }
            >
              Elegí una SAPS
            </label>

            <select
              id={
                selectorId
              }
              className="form-select"
              value={
                current
              }
              onChange={(
                event
              ) =>
                setIndex(
                  Number(
                    event
                      .target
                      .value
                  )
                )
              }
            >
              {slideLabels.map(
                (
                  title,
                  position
                ) => (
                  <option
                    key={
                      position
                    }
                    value={
                      position
                    }
                  >
                    {title}
                  </option>
                )
              )}
            </select>
          </div>
        )}

      {/* Diapositiva actualmente visible. */}
      <div
        className="carousel-inner"
        aria-live={
          rotating
            ? 'off'
            : 'polite'
        }
      >
        <div
          className="carousel-item active"
          role="group"
          aria-roledescription="diapositiva"
          aria-label={`${current + 1} de ${slides.length}`}
        >
          {
            slides[
              current
            ]
          }
        </div>
      </div>

      {/* Controles de navegación del carrusel. */}
      {slides.length >
        1 && (
        <div className="d-flex flex-wrap align-items-center justify-content-center gap-3 mt-3">
          <button
            className="btn btn-outline-success"
            aria-label={`Anterior: ${label}`}
            onClick={() =>
              setIndex(
                (
                  current -
                  1 +
                  slides.length
                ) %
                  slides.length
              )
            }
          >
            <i
              className="bi bi-chevron-left"
              aria-hidden="true"
            />
          </button>

          <span>
            {current + 1}{' '}
            /{' '}
            {
              slides.length
            }
          </span>

          <button
            className="btn btn-outline-success"
            aria-label={`Siguiente: ${label}`}
            onClick={() =>
              setIndex(
                (
                  current +
                  1
                ) %
                  slides.length
              )
            }
          >
            <i
              className="bi bi-chevron-right"
              aria-hidden="true"
            />
          </button>

          {/* Permite controlar el autoplay manualmente. */}
          {autoPlay &&
            !reducedMotion && (
            <button
              className="btn btn-outline-success"
              onClick={() =>
                setPaused(
                  !paused
                )
              }
              aria-pressed={
                paused
              }
            >
              <i
                className={`bi ${
                  paused
                    ? 'bi-play-fill'
                    : 'bi-pause-fill'
                } me-1`}
                aria-hidden="true"
              />

              {paused
                ? 'Reanudar'
                : 'Pausar'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Información destacada sobre las funciones principales del sistema.
const information = [
  [
    'bi-phone',
    'Solicitá turnos desde tu celular.',
    'Accedé a tu cuenta y elegí entre las opciones disponibles.',
  ],
  [
    'bi-hospital',
    'Conocé tu salita y sus profesionales.',
    'Completá tu perfil para consultar la cobertura que te corresponde.',
  ],
  [
    'bi-bell',
    'Consultá los avisos sobre tus turnos.',
    'Tus notificaciones privadas están disponibles al iniciar sesión.',
  ],
  [
    'bi-megaphone',
    'Enterate de campañas y novedades.',
    'La información pública de las SAPS, en un solo lugar.',
  ],
];

// Presenta los principales beneficios de CORA.
export default function InformationalCarousel() {
  return (
    <section
      className="container public-section"
      aria-label="Beneficios de CORA"
    >
      <PublicCarousel
        label="Información de CORA"
        slides={information.map(
          ([
            icon,
            title,
            text,
          ]) => (
            <div
              className="public-information"
              key={title}
            >
              <i
                className={`bi ${icon}`}
                aria-hidden="true"
              />

              <div>
                <h2 className="h4">
                  {title}
                </h2>

                <p className="mb-0">
                  {text}
                </p>
              </div>
            </div>
          )
        )}
      />
    </section>
  );
}