import { Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth/RequireAuth'
import { RequireRole } from './auth/RequireRole'
import { AppLayout } from './layouts/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { HomeRedirect } from './pages/HomeRedirect'
import { ClientsPage } from './pages/ClientsPage'
import { ClientDetailPage } from './pages/ClientDetailPage'
import { CalendarPage } from './pages/CalendarPage'
import { StaffPage } from './pages/StaffPage'
import { StaffDetailPage } from './pages/StaffDetailPage'
import { ServicesPage } from './pages/ServicesPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { DashboardPage } from './pages/DashboardPage'
import { FinancePage } from './pages/admin/FinancePage'
import { ReportsPage } from './pages/admin/ReportsPage'

// Отдельно от App/BrowserRouter, чтобы в тестах маршрутизацию можно было
// прогнать под MemoryRouter с произвольным initialEntries.
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomeRedirect />} />

          {/* Доступно и ADMIN, и MASTER — см. ТЗ, роли пользователей.
              /calendar и /my-schedule — два входа в один экран. */}
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="my-schedule" element={<CalendarPage />} />
          <Route path="dashboard" element={<DashboardPage />} />

          {/* Клиенты — просмотр + создание доступны и ADMIN, и MASTER (Backlog, item19):
              backend уже разрешает POST/GET /clients и GET /clients/:id обеим ролям, а
              PATCH/DELETE/GDPR остаются строго ADMIN (см. isAdmin-гейты внутри страниц —
              редактирование/экспорт/GDPR на карточке клиента ими и закрыты). */}
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />

          {/* Мастера/Услуги — только ADMIN (Backlog п.5): раньше страницы сами
              скрывали часть UI по роли (см. isAdmin-гейты внутри), но сами маршруты оставались
              доступны MASTER по прямому URL. Явный RequireRole закрывает и это — тем же
              приёмом, что уже применён к finance/reports ниже. */}
          <Route element={<RequireRole role="ADMIN" />}>
            <Route path="staff" element={<StaffPage />} />
            <Route path="staff/:id" element={<StaffDetailPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
