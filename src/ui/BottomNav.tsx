import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/dias', label: 'Días', icon: '📅' },
  { to: '/graficas', label: 'Gráficas', icon: '📈' },
  { to: '/manos', label: 'Manos', icon: '🃏' },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️' },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} aria-label={t.label} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span aria-hidden="true">{t.icon}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
