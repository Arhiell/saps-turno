import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import {
  isMenuItemActive,
  type SidebarMenuItem,
} from './sidebar-menu';

// Propiedades del elemento individual del menú lateral.
interface SidebarItemProps {
  item: SidebarMenuItem;
  visibleItems: SidebarMenuItem[];
}

// Renderiza un enlace o un grupo desplegable dentro del sidebar.
const SidebarItem = ({
  item,
  visibleItems,
}: SidebarItemProps) => {
  const { pathname } = useLocation();

  const hasChildren = Boolean(item.children && item.children.length > 0);

  const isChildActive = Boolean(
    item.children?.some((child) =>
      isMenuItemActive(pathname, child.path, visibleItems)
    )
  );

  const isCurrentActive = isMenuItemActive(pathname, item.path, visibleItems);
  const active = isCurrentActive || isChildActive;

  // Estado para expandir/contraer el submenú si tiene hijos
  const [expanded, setExpanded] = useState<boolean>(() => active);

  // Expande automáticamente cuando la ruta actual corresponde a este menú o sus hijos
  useEffect(() => {
    if (active) {
      setExpanded(true);
    }
  }, [pathname, active]);

  if (hasChildren && item.children) {
    return (
      <div className={`sidebar-group ${active ? 'sidebar-group--active' : ''}`}>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          title={item.label}
          aria-expanded={expanded}
          aria-controls={`submenu-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
          className={`sidebar-item sidebar-item--toggle ${active ? 'active' : ''}`}
        >
          <i className={`bi ${item.icon}`} aria-hidden="true" />
          <span className="sidebar-item-label">{item.label}</span>
          <i
            className={`bi bi-chevron-${expanded ? 'down' : 'right'} sidebar-chevron ms-auto`}
            aria-hidden="true"
          />
        </button>

        {expanded && (
          <div
            id={`submenu-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            className="sidebar-submenu"
            role="group"
            aria-label={`Submenú ${item.label}`}
          >
            {item.children.map((child) => {
              const childActive = isMenuItemActive(
                pathname,
                child.path,
                visibleItems
              );

              return (
                <Link
                  key={child.path}
                  to={child.path}
                  title={child.label}
                  aria-current={childActive ? 'page' : undefined}
                  className={`sidebar-subitem ${childActive ? 'active' : ''}`}
                >
                  <i className={`bi ${child.icon}`} aria-hidden="true" />
                  <span>{child.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to={item.path}
      title={item.label}
      aria-current={active ? 'page' : undefined}
      className={`sidebar-item ${active ? 'active' : ''}`}
    >
      {/* Ícono asociado a la opción del menú. */}
      <i className={`bi ${item.icon}`} aria-hidden="true" />

      <span>{item.label}</span>
    </Link>
  );
};

export default SidebarItem;
