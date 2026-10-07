import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from './AppRoutes'
import { AuthProvider } from './auth/AuthContext'
import { setStoredToken } from './api/client'
import { fetchCurrentUser } from './api/auth'
import { getEffectiveDashboardWidgets } from './api/dashboardSettings'
import { getPendingOnlineCount, listBookings } from './api/bookings'
import { listClients } from './api/clients'
import { getMaster, listMasterServiceLinks, listStaff } from './api/staff'
import { listServices } from './api/services'
import { listMasterBlocks } from './api/masterBlocks'
import { getMasterSchedule } from './api/masterSchedules'
import { getRevenueReport, listPayments } from './api/payments'

vi.mock('./api/auth', () => ({
  login: vi.fn(),
  fetchCurrentUser: vi.fn(),
}))
// Страницы в маршрутах ("/" -> Dashboard / Calendar, /clients) грузят данные безусловно (см. их
// собственные *.test.tsx) — без моков запросы уходят в реальную сеть (на localhost:3000 может
// отвечать живой бэкенд) и на 401 interceptor из api/client.ts разлогинивает пользователя,
// ломая редиректы ниже.
vi.mock('./api/dashboardSettings', () => ({ getEffectiveDashboardWidgets: vi.fn() }))
vi.mock('./api/bookings', () => ({
  listBookings: vi.fn(),
  updateBookingStatus: vi.fn(),
  rescheduleBooking: vi.fn(),
  getPendingOnlineCount: vi.fn(),
}))
vi.mock('./api/clients', () => ({ listClients: vi.fn() }))
vi.mock('./api/staff', () => ({
  listStaff: vi.fn(),
  listMasterServiceLinks: vi.fn(),
  getMaster: vi.fn(),
}))
vi.mock('./api/services', () => ({ listServices: vi.fn() }))
vi.mock('./api/masterBlocks', () => ({
  listMasterBlocks: vi.fn(),
  createMasterBlock: vi.fn(),
  deleteMasterBlock: vi.fn(),
}))
vi.mock('./api/masterSchedules', () => ({
  getMasterSchedule: vi.fn(),
  upsertMasterSchedule: vi.fn(),
  findMasterScheduleConflicts: vi.fn(),
}))
vi.mock('./api/payments', () => ({
  getRevenueReport: vi.fn(),
  listPayments: vi.fn(),
  createPayment: vi.fn(),
}))

const mockedFetchCurrentUser = vi.mocked(fetchCurrentUser)
vi.mocked(getEffectiveDashboardWidgets).mockResolvedValue([
  'today-bookings-summary',
  'monthly-revenue',
  'daily-timeline',
  'weekly-timeline',
  'upcoming-bookings',
])
vi.mocked(listBookings).mockResolvedValue([])
vi.mocked(getPendingOnlineCount).mockResolvedValue(0)
vi.mocked(listClients).mockResolvedValue([])
vi.mocked(listStaff).mockResolvedValue([])
vi.mocked(listMasterServiceLinks).mockResolvedValue([])
vi.mocked(getMaster).mockResolvedValue({
  id: 'master-rec-1',
  salonId: 'salon-1',
  name: 'Тестовый мастер',
  specializationCategoryIds: [],
  isActive: true,
  photo: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  services: [],
})
vi.mocked(listServices).mockResolvedValue([])
vi.mocked(listMasterBlocks).mockResolvedValue([])
vi.mocked(getMasterSchedule).mockResolvedValue([])
vi.mocked(listPayments).mockResolvedValue([])
vi.mocked(getRevenueReport).mockResolvedValue({
  from: '2026-03-01',
  to: '2026-03-31T23:59:59.999Z',
  paymentsCount: 0,
  grossAmount: 0,
  totalDiscount: 0,
  netRevenue: 0,
})

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AppRoutes', () => {
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('sends an unauthenticated visitor to the login page', async () => {
    renderApp('/')

    expect(await screen.findByRole('heading', { name: /вход в b4u crm/i })).toBeInTheDocument()
  })

  it('sends an authenticated ADMIN from "/" to the dashboard', async () => {
    setStoredToken('fake-token')
    mockedFetchCurrentUser.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@b4u.local',
      role: 'ADMIN',
      salonId: 'salon-1',
      masterId: null,
    })

    renderApp('/')

    expect(await screen.findByRole('heading', { name: /дашборд/i })).toBeInTheDocument()
  })

  it('sends an authenticated MASTER from "/" to their schedule', async () => {
    setStoredToken('fake-token')
    mockedFetchCurrentUser.mockResolvedValue({
      id: 'master-1',
      email: 'master@b4u.local',
      role: 'MASTER',
      salonId: 'salon-1',
      masterId: 'master-rec-1',
    })

    renderApp('/')

    expect(await screen.findByRole('heading', { name: /моё расписание/i })).toBeInTheDocument()
  })

  it('redirects a MASTER away from an ADMIN-only route back to their own section', async () => {
    setStoredToken('fake-token')
    mockedFetchCurrentUser.mockResolvedValue({
      id: 'master-1',
      email: 'master@b4u.local',
      role: 'MASTER',
      salonId: 'salon-1',
      masterId: 'master-rec-1',
    })

    renderApp('/finance')

    expect(await screen.findByRole('heading', { name: /моё расписание/i })).toBeInTheDocument()
  })

  it('lets ADMIN reach the clients section', async () => {
    setStoredToken('fake-token')
    mockedFetchCurrentUser.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@b4u.local',
      role: 'ADMIN',
      salonId: 'salon-1',
      masterId: null,
    })

    renderApp('/clients')

    expect(await screen.findByRole('heading', { name: /клиенты/i })).toBeInTheDocument()
  })

  // item19 — Клиенты (просмотр + создание) открыты и MASTER, даже по прямому URL; только
  // редактирование/GDPR остаются ADMIN-only (скрыты внутри ClientDetailPage, не на уровне маршрута).
  it('lets MASTER reach the clients section', async () => {
    setStoredToken('fake-token')
    mockedFetchCurrentUser.mockResolvedValue({
      id: 'master-1',
      email: 'master@b4u.local',
      role: 'MASTER',
      salonId: 'salon-1',
      masterId: 'master-rec-1',
    })

    renderApp('/clients')

    expect(await screen.findByRole('heading', { name: /клиенты/i })).toBeInTheDocument()
  })

  // Backlog п.5 — Мастера/Услуги полностью недоступны роли MASTER, даже по прямому URL.
  it.each(['/staff', '/services'])(
    'redirects a MASTER away from %s back to their own section',
    async (path) => {
      setStoredToken('fake-token')
      mockedFetchCurrentUser.mockResolvedValue({
        id: 'master-1',
        email: 'master@b4u.local',
        role: 'MASTER',
        salonId: 'salon-1',
        masterId: 'master-rec-1',
      })

      renderApp(path)

      expect(await screen.findByRole('heading', { name: /моё расписание/i })).toBeInTheDocument()
    },
  )

  it('clears the session and bounces to login when /auth/me rejects (expired token)', async () => {
    setStoredToken('stale-token')
    mockedFetchCurrentUser.mockRejectedValue(new Error('Unauthorized'))

    renderApp('/dashboard')

    expect(await screen.findByRole('heading', { name: /вход в b4u crm/i })).toBeInTheDocument()
  })

  it('renders a 404 page for an unknown route', async () => {
    renderApp('/does-not-exist')

    expect(await screen.findByRole('heading', { name: /страница не найдена/i })).toBeInTheDocument()
  })
})
