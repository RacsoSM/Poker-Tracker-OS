import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/graficas', label: 'Gráficas' },
  { to: '/dias', label: 'Días' },
  { to: '/manos', label: 'Manos' },
  { to: '/ajustes', label: 'Ajustes' },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => (isActive ? 'active' : '')}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
