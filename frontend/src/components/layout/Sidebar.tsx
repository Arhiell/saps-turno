
import { useAuth } from '../../context/AuthContext';
import SidebarItem from './SidebarItem';
import { getMenuForRole } from './sidebar-menu';

const Sidebar = () => {
  const { user, permissions } = useAuth();

  const role = user?.rol;

  const menuItems = getMenuForRole(role, permissions);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2>CORA</h2>
        <p>Salud municipal</p>
      </div>

      <nav
        className="sidebar-nav"
        aria-label="Navegación principal"
      >
        {menuItems.map((item) => (
          <SidebarItem
            key={item.path}
            item={item}
            visibleItems={menuItems}
          />
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
