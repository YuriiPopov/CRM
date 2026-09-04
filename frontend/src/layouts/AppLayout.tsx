import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { MasterAvatar } from '../components/MasterAvatar'
import { getMaster } from '../api/staff'
import type { Master } from '../types/staff'

interface NavItem {
  to: string
  label: string
}

// Нейтральный цвет заглушки для ADMIN — своего masterId у администратора нет, поэтому
// getMasterColor (детерминированный по masterId) здесь не применим (item43).
const ADMIN_AVATAR_COLOR = '#64748b'

// Разделы по ролям — см. ТЗ, раздел 7 "UX/UI требования"
const ADMIN_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Дашборд' },
  { to: '/calendar', label: 'Календарь записей' },
  { to: '/clients', label: 'Клиенты' },
  { to: '/staff', label: 'Мастера' },
  { to: '/services', label: 'Услуги' },
  { to: '/finance', label: 'Финансы' },
  { to: '/reports', label: 'Отчёты' },
  { to: '/dashboard-settings', label: 'Видимость дашборда' },
]

// Мастера/Услуги исключены для MASTER (Backlog п.5) — эти разделы полностью недоступны
// роли MASTER (см. RequireRole role="ADMIN" в AppRoutes для тех же маршрутов). Клиенты —
// доступны (просмотр + создание, без редактирования/GDPR) начиная с item19, см. комментарий
// у маршрутов /clients в AppRoutes.
const MASTER_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Дашборд' },
  { to: '/my-schedule', label: 'Моё расписание' },
  { to: '/clients', label: 'Клиенты' },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const navItems = user?.role === 'ADMIN' ? ADMIN_NAV : MASTER_NAV
  const [currentMaster, setCurrentMaster] = useState<Master | null>(null)

  // Фото/цвет мастера для аватара в шапке (item43) — AuthenticatedUser несёт только masterId,
  // саму запись Master (с photo) подгружаем отдельно, как и остальные потребители api/staff.ts.
  useEffect(() => {
    if (user?.role !== 'MASTER' || !user.masterId) {
      setCurrentMaster(null)
      return
    }

    let cancelled = false
    getMaster(user.masterId)
      .then((master) => {
        if (!cancelled) setCurrentMaster(master)
      })
      .catch(() => {
        if (!cancelled) setCurrentMaster(null)
      })

    return () => {
      cancelled = true
    }
  }, [user?.role, user?.masterId])

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
          {user?.role === 'MASTER' && currentMaster && (
            <MasterAvatar master={currentMaster} className="app-user-avatar" />
          )}
          {user?.role === 'ADMIN' && (
            <MasterAvatar
              master={{ id: user.id, name: user.email.split('@')[0].replace(/[._-]+/g, ' '), photo: null }}
              color={ADMIN_AVATAR_COLOR}
              className="app-user-avatar"
            />
          )}
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
