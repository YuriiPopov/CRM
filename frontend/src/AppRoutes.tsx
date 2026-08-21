import { Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth/RequireAuth'
import { RequireRole } from './auth/RequireRole'
import { AppLayout } from './layouts/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { HomeRedirect } from './pages/HomeRedirect'
import { ClientsPage } from './pages/ClientsPage'
import { CalendarPage } from './pages/CalendarPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { DashboardPage } from './pages/admin/DashboardPage'
import { StaffPage } from './pages/admin/StaffPage'
import { ServicesPage } from './pages/admin/ServicesPage'
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

          {/* Доступно и ADMIN, и MASTER — см. ТЗ, роли пользователей. CalendarPage сам решает,
              что показать, по роли из useAuth(); /calendar и /my-schedule — два входа в один экран. */}
          <Route path="clients" element={<ClientsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="my-schedule" element={<CalendarPage />} />

          <Route element={<RequireRole role="ADMIN" />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="staff" element={<StaffPage />} />
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
