import {
  NavLink,
  useLocation,
} from 'react-router-dom';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useAuth,
} from '../../context/AuthContext';

import {
  getMenuForRole,
  isMenuItemActive,
} from './sidebar-menu';

export default function MobileBottomNav() {
  const {
    user,
    permissions,
  } = useAuth();

  const {
    pathname,
  } = useLocation();

  // Controla la apertura del menú de opciones adicionales.
  const [
    open,
    setOpen,
  ] = useState(false);

  const container =
    useRef<HTMLElement>(
      null
    );

  const toggle =
    useRef<HTMLButtonElement>(
      null
    );

  // Obtiene las opciones disponibles según el rol del usuario.
  const items =
    getMenuForRole(
      user?.rol,
      permissions
    );

  const hasMore =
    items.length > 4;

  // Mantiene las opciones principales a un toque,
  // incluso cuando existen elementos dentro de "Más".
  const primaryPaths =
    user?.rol === 'PACIENTE'
      ? [
          '/panel',
          '/solicitar-turno',
          '/mis-turnos',
        ]
      : user?.rol === 'PROFESIONAL'
        ? [
            '/panel',
            '/mi-agenda',
            '/mis-pacientes',
          ]
        : [
            '/panel',
            '/turnos',
            '/pacientes',
          ];

  // Obtiene las opciones principales del menú inferior.
  const primary =
    hasMore
      ? primaryPaths.flatMap(
          (path) =>
            items.filter(
              (item) =>
                item.path === path
            )
        )
      : items;

  // Agrupa las opciones restantes dentro del menú "Más", aplanando categorías si tienen sub-elementos.
  const secondary = items.reduce<typeof items>((acc, item) => {
    if (primary.some((p) => p.path === item.path)) {
      return acc;
    }
    if (item.children && item.children.length > 0) {
      acc.push(...item.children);
    } else {
      acc.push(item);
    }
    return acc;
  }, []);

  // Cierra el menú adicional al cambiar de página.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Cierra el menú al pulsar fuera de él o presionar Escape.
  useEffect(() => {
    if (!open) {
      return;
    }

    const close = (
      event: PointerEvent
    ) => {
      if (
        !container.current?.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    };

    const escape = (
      event: KeyboardEvent
    ) => {
      if (
        event.key ===
        'Escape'
      ) {
        setOpen(false);

        toggle.current?.focus();
      }
    };

    document.addEventListener(
      'pointerdown',
      close
    );

    document.addEventListener(
      'keydown',
      escape
    );

    return () => {
      document.removeEventListener(
        'pointerdown',
        close
      );

      document.removeEventListener(
        'keydown',
        escape
      );
    };
  }, [open]);

  // Genera cada enlace del menú móvil.
  const link = (
    item:
      typeof items[number]
  ) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/panel'}
      onClick={() =>
        setOpen(false)
      }
      className={({
        isActive,
      }) =>
        `mobile-bottom-nav__link${
          isActive && isMenuItemActive(pathname, item.path, items)
            ? ' is-active'
            : ''
        }`
      }
    >
      <i
        className={`bi ${item.icon}`}
        aria-hidden="true"
      />

      <span>
        {item.path === '/mis-notificaciones'
          ? 'Notificaciones'
          : item.path === '/mis-pacientes'
            ? 'Pacientes'
            : item.label}
      </span>
    </NavLink>
  );

  return (
    <nav
      ref={container}
      className="mobile-bottom-nav"
      aria-label="Navegación móvil"
    >
      {open && (
        <div
          id="mobile-more"
          className="mobile-bottom-nav__more"
        >
          {secondary.map(
            link
          )}
        </div>
      )}

      {primary.map(
        link
      )}

      {hasMore && (
        <button
          ref={toggle}
          type="button"
          aria-expanded={
            open
          }
          aria-controls="mobile-more"
          className={`mobile-bottom-nav__link${
            secondary.some(
              (item) =>
                isMenuItemActive(pathname, item.path, items) && pathname.startsWith(
                  item.path
                )
            )
              ? ' is-active'
              : ''
          }`}
          onClick={() =>
            setOpen(
              !open
            )
          }
        >
          <i
            className="bi bi-grid"
            aria-hidden="true"
          />

          <span>
            Más
          </span>
        </button>
      )}
    </nav>
  );
}