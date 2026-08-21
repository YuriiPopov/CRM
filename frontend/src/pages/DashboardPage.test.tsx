import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardPage } from './DashboardPage'
import { useAuth } from '../auth/useAuth'
import { listBookings } from '../api/bookings'
import { listClients } from '../api/clients'
import { getRevenueReport } from '../api/payments'
import type { AuthenticatedUser } from '../types/auth'
import type { Booking } from '../types/booking'
import type { Client } from '../types/client'
import type { RevenueReport } from '../types/payment'

vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../api/bookings', () => ({ listBookings: vi.fn() }))
vi.mock('../api/clients', () => ({ listClients: vi.fn() }))
vi.mock('../api/payments', () => ({ getRevenueReport: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)
const mockedListBookings = vi.mocked(listBookings)
const mockedListClients = vi.mocked(listClients)
const mockedGetRevenueReport = vi.mocked(getRevenueReport)

const adminUser: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@b4u.local',
  role: 'ADMIN',
  salonId: 'salon-1',
  masterId: null,
}

const masterUser: AuthenticatedUser = {
  id: 'master-user-1',
  email: 'master@b4u.local',
  role: 'MASTER',
  salonId: 'salon-1',
  masterId: 'master-1',
}

const client: Client = {
  id: 'client-1',
  salonId: 'salon-1',
  name: 'Anna Client',
  phone: '+48111222333',
  email: null,
  notes: null,
  tags: [],
  consentGivenAt: '2026-01-01T00:00:00.000Z',
  consentWithdrawnAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

function makeBooking(overrides: Partial<Booking>): Booking {
  return {
    id: 'booking-1',
    salonId: 'salon-1',
    clientId: 'client-1',
    masterId: 'master-1',
    serviceId: 'service-1',
    startTime: '2026-03-10T14:00:00.000Z',
    endTime: '2026-03-10T15:00:00.000Z',
    status: 'CREATED',
    source: 'ADMIN',
    createdAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  }
}

const revenueReport: RevenueReport = {
  from: '2026-03-01',
  to: '2026-03-31T23:59:59.999Z',
  paymentsCount: 12,
  grossAmount: 5000,
  totalDiscount: 200,
  netRevenue: 4800,
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-03-10T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('shows today’s booking count with a status breakdown, and month revenue, for ADMIN', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([
      makeBooking({ id: 'b1', status: 'CREATED' }),
      makeBooking({ id: 'b2', status: 'CONFIRMED' }),
    ])
    mockedListClients.mockResolvedValue([client])
    mockedGetRevenueReport.mockResolvedValue(revenueReport)

    renderPage()

    const todayCard = (await screen.findByText('Записи сегодня')).closest<HTMLElement>('.dashboard-card')!
    expect(within(todayCard).getByText('2')).toBeInTheDocument()
    expect(within(todayCard).getByText(/создана: 1/i)).toBeInTheDocument()
    expect(within(todayCard).getByText(/подтверждена: 1/i)).toBeInTheDocument()

    const revenueCard = screen.getByText('Выручка за месяц').closest<HTMLElement>('.dashboard-card')!
    expect(within(revenueCard).getByText('4800')).toBeInTheDocument()
    expect(within(revenueCard).getByText(/оплат: 12/i)).toBeInTheDocument()

    expect(mockedGetRevenueReport).toHaveBeenCalledWith({
      from: '2026-03-01',
      to: '2026-03-31T23:59:59.999Z',
    })
  })

  it('lists upcoming bookings with links to the client card and to the calendar', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([makeBooking({ id: 'b1' })])
    mockedListClients.mockResolvedValue([client])
    mockedGetRevenueReport.mockResolvedValue(revenueReport)

    renderPage()

    const clientLink = await screen.findByRole('link', { name: 'Anna Client' })
    expect(clientLink).toHaveAttribute('href', '/clients/client-1')

    const calendarLink = screen.getByRole('link', { name: /в календарь/i })
    expect(calendarLink).toHaveAttribute('href', '/calendar')
  })

  it('hides the revenue widget and links to /my-schedule for MASTER', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([makeBooking({ id: 'b1', masterId: 'master-1' })])
    mockedListClients.mockResolvedValue([client])

    renderPage()

    await screen.findByText('Anna Client')
    expect(screen.queryByText('Выручка за месяц')).not.toBeInTheDocument()
    expect(mockedGetRevenueReport).not.toHaveBeenCalled()

    expect(screen.getByRole('link', { name: /в календарь/i })).toHaveAttribute('href', '/my-schedule')
  })

  it('shows empty states when there are no bookings today or upcoming', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([])
    mockedListClients.mockResolvedValue([])
    mockedGetRevenueReport.mockResolvedValue({ ...revenueReport, paymentsCount: 0, netRevenue: 0 })

    renderPage()

    const todayCard = (await screen.findByText('Записи сегодня')).closest<HTMLElement>('.dashboard-card')!
    expect(within(todayCard).getByText('0')).toBeInTheDocument()
    expect(within(todayCard).queryByRole('list')).not.toBeInTheDocument()

    expect(screen.getByText(/на сегодня и завтра записей нет/i)).toBeInTheDocument()
  })

  it('shows an error message when loading fails', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockRejectedValue(new Error('network error'))
    mockedListClients.mockResolvedValue([])
    mockedGetRevenueReport.mockResolvedValue(revenueReport)

    renderPage()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
