import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Link,
  Outlet,
  useLocation,
} from 'react-router-dom';

import {
  useAuth,
} from '../../context/AuthContext';

import '../../styles/public.css';

// Layout principal utilizado por las páginas públicas.
export default function PublicLayout() {
  const [
    open,
    setOpen,
  ] = useState(false);

  const toggle =
    useRef<HTMLButtonElement>(
      null
    );

  const {
    isAuthenticated,
    isLoading,
  } = useAuth();

  const {
    pathname,
    hash,
  } = useLocation();

  // Posiciona la página en la sección indicada por el hash
  // o vuelve al inicio al cambiar de ruta.
  useEffect(
    () => {
      if (hash) {
        document
          .getElementById(
            hash.slice(1)
          )
          ?.scrollIntoView();
      } else {
        window.scrollTo(
          0,
          0
        );
      }
    },
    [
      pathname,
      hash,
    ]
  );

  return (
    <div className="public-site">
      {/* Permite saltar directamente al contenido principal. */}
      <a
        className="public-skip"
        href="#contenido-publico"
      >
        Saltar al contenido
      </a>

      {/* Encabezado y navegación pública. */}
      <header className="public-header">
        <nav
          className="container public-navigation"
          aria-label="Navegación pública"
          onKeyDown={(
            event
          ) => {
            if (
              event.key ===
              'Escape'
            ) {
              setOpen(
                false
              );

              toggle.current
                ?.focus();
            }
          }}
        >
          <Link
            className="public-brand"
            to="/"
            onClick={() =>
              setOpen(
                false
              )
            }
          >
            <i
              className="bi bi-heart-pulse-fill"
              aria-hidden="true"
            />{' '}
            Cora
          </Link>

          {/* Control del menú en dispositivos pequeños. */}
          <button
            ref={toggle}
            className="btn btn-outline-success public-menu-toggle"
            aria-label="Abrir o cerrar menú"
            aria-expanded={
              open
            }
            aria-controls="public-menu"
            onClick={() =>
              setOpen(
                !open
              )
            }
          >
            <i
              className="bi bi-list"
              aria-hidden="true"
            />
          </button>

          <div
            id="public-menu"
            className={`public-menu ${
              open
                ? 'is-open'
                : ''
            }`}
          >
            {[
              [
                'Inicio',
                '/',
              ],
              [
                'Cómo funciona',
                '/#como-funciona',
              ],
              [
                'Noticias',
                '/#noticias',
              ],
              [
                'Salitas',
                '/#salitas',
              ],
              [
                'Ayuda',
                '/#ayuda',
              ],
            ].map(
              ([
                label,
                url,
              ]) => (
                <a
                  key={
                    label
                  }
                  href={
                    url
                  }
                  onClick={() =>
                    setOpen(
                      false
                    )
                  }
                >
                  {label}
                </a>
              )
            )}

            {/* Espera la restauración de la sesión antes de ofrecer acceso o registro. */}
            {!isLoading && (isAuthenticated ? (
              <Link
                className="btn btn-success"
                to="/panel"
                onClick={() => setOpen(false)}
              >
                Mi panel
              </Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)}>
                  Iniciar sesión
                </Link>
                <Link className="btn btn-success" to="/registro" onClick={() => setOpen(false)}>
                  Registrarse
                </Link>
              </>
            ))}
          </div>
        </nav>
      </header>

      {/* Contenido correspondiente a la ruta pública actual. */}
      <main
        id="contenido-publico"
        tabIndex={-1}
      >
        <Outlet />
      </main>

      {/* Pie de página con información y accesos institucionales. */}
      <footer className="public-footer mt-5">
        <div className="container d-flex flex-wrap justify-content-between gap-4">
          <div>
            <strong>
              Cora - Conexión y Organización de la Red de Atención
            </strong>

            <p className="mb-0">
              Atención primaria cerca de vos.
            </p>

            <small>
              Municipalidad de Goya · Corrientes
            </small>
          </div>

          <div className="d-flex flex-column gap-2">
            <a
              href="https://www.goya.gob.ar/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Portal municipal{' '}
              <i
                className="bi bi-box-arrow-up-right"
                aria-hidden="true"
              />
            </a>

            <a href="/#salitas">
              Contacto y teléfonos de las SAPS
            </a>

            <Link to="/acceso-personal">
              Acceso del personal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
