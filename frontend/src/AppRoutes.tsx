import { Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth/RequireAuth'
import { RequireRole } from './auth/RequireRole'
import { AppLayout } from './layouts/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { HomeRedirect } from './pages/HomeRedirect'
import { ClientsPage } from './pages/ClientsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { DashboardPage } from './pages/admin/DashboardPage'
import { CalendarPage } from './pages/admin/CalendarPage'
import { StaffPage } from './pages/admin/StaffPage'
import { ServicesPage } from './pages/admin/ServicesPage'
import { FinancePage } from './pages/admin/FinancePage'
import { ReportsPage } from './pages/admin/ReportsPage'
import { MySchedulePage } from './pages/master/MySchedulePage'

// Отдельно от App/BrowserRouter, чтобы в тестах маршрутизацию можно было
// прогнать под MemoryRouter с произвольным initialEntries.
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomeRedirect />} />

          {/* Доступно и ADMIN, и MASTER — см. ТЗ, роли пользователей */}
          <Route path="clients" element={<ClientsPage />} />

          <Route element={<RequireRole role="ADMIN" />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>

          <Route element={<RequireRole role="MASTER" />}>
            <Route path="my-schedule" element={<MySchedulePage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
