import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

interface NavItem {
  to: string
  label: string
}

// Разделы по ролям — см. ТЗ, раздел 7 "UX/UI требования"
const ADMIN_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Дашборд' },
  { to: '/calendar', label: 'Календарь записей' },
  { to: '/clients', label: 'Клиенты' },
  { to: '/staff', label: 'Мастера' },
  { to: '/services', label: 'Услуги' },
  { to: '/finance', label: 'Финансы' },
  { to: '/reports', label: 'Отчёты' },
]

const MASTER_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Дашборд' },
  { to: '/my-schedule', label: 'Моё расписание' },
  { to: '/clients', label: 'Клиенты' },
  { to: '/staff', label: 'Мастера' },
  { to: '/services', label: 'Услуги' },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const navItems = user?.role === 'ADMIN' ? ADMIN_NAV : MASTER_NAV

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-title">B4U CRM</span>
        <nav aria-label="Основная навигация">
          <ul>
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to}>{item.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="app-user">
          <span>{user?.email}</span>
          <button type="button" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}
