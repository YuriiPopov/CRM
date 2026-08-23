import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardPage } from './DashboardPage'
import { useAuth } from '../auth/useAuth'
import { listBookings } from '../api/bookings'
import { listClients } from '../api/clients'
import { listStaff } from '../api/staff'
import { listServices } from '../api/services'
import { getRevenueReport } from '../api/payments'
import type { AuthenticatedUser } from '../types/auth'
import type { Booking } from '../types/booking'
import type { Client } from '../types/client'
import type { Master } from '../types/staff'
import type { Service } from '../types/service'
import type { RevenueReport } from '../types/payment'

vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../api/bookings', () => ({ listBookings: vi.fn() }))
vi.mock('../api/clients', () => ({ listClients: vi.fn() }))
vi.mock('../api/staff', () => ({ listStaff: vi.fn() }))
vi.mock('../api/services', () => ({ listServices: vi.fn() }))
vi.mock('../api/payments', () => ({ getRevenueReport: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)
const mockedListBookings = vi.mocked(listBookings)
const mockedListClients = vi.mocked(listClients)
const mockedListStaff = vi.mocked(listStaff)
const mockedListServices = vi.mocked(listServices)
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

const clientTwo: Client = { ...client, id: 'client-2', name: 'Boris Client' }

const master: Master = {
  id: 'master-1',
  salonId: 'salon-1',
  name: 'Master One',
  specialization: 'SPA',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const masterTwo: Master = { ...master, id: 'master-2', name: 'Master Two' }

const service: Service = {
  id: 'service-1',
  salonId: 'salon-1',
  name: 'Massage',
  category: 'MASSAGE',
  durationMin: 60,
  price: 150,
  createdAt: '2026-01-01T00:00:00.000Z',
}

// listStaff грузится только для ADMIN (легенда "мастер → цвет" таймлайна на сегодня, см.
// masterColor.ts) — безобидный дефолт, чтобы существующие ADMIN-сценарии не ломались загрузкой.
mockedListStaff.mockResolvedValue([master])
// listServices грузится безусловно (нужна в карточке "Ближайшие записи" и ADMIN, и MASTER) —
// безобидный дефолт по той же причине.
mockedListServices.mockResolvedValue([service])

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

  it('shows the booking date, service, and master name in each "Ближайшие записи" card for ADMIN', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([makeBooking({ id: 'b1' })])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master])
    mockedListServices.mockResolvedValue([service])
    mockedGetRevenueReport.mockResolvedValue(revenueReport)

    renderPage()

    // "Anna Client" встречается и в блоке таймлайна (тоже активная запись сегодня, тоже div,
    // не li) — берём именно строку списка "Ближайшие записи".
    const matches = await screen.findAllByText('Anna Client')
    const row = matches.map((el) => el.closest('li')).find((li): li is HTMLLIElement => li !== null)!
    expect(within(row).getByText(/10\.03\.2026/)).toBeInTheDocument()
    expect(within(row).getByText('Massage')).toBeInTheDocument()
    expect(within(row).getByText('Master One')).toBeInTheDocument()
  })

  it('shows "Вы" instead of the master name in "Ближайшие записи" for MASTER', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([makeBooking({ id: 'b1', masterId: 'master-1' })])
    mockedListClients.mockResolvedValue([client])
    mockedListServices.mockResolvedValue([service])

    renderPage()

    // "Anna Client" может встретиться и в блоке таймлайна (тоже div, не li) — берём именно
    // строку списка "Ближайшие записи".
    const matches = await screen.findAllByText('Anna Client')
    const row = matches.map((el) => el.closest('li')).find((li): li is HTMLLIElement => li !== null)!
    expect(within(row).getByText('Вы')).toBeInTheDocument()
    expect(within(row).queryByText('Master One')).not.toBeInTheDocument()
    expect(mockedListStaff).not.toHaveBeenCalled()
  })

  it('hides the revenue widget and links to /my-schedule for MASTER', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([makeBooking({ id: 'b1', masterId: 'master-1' })])
    mockedListClients.mockResolvedValue([client])

    renderPage()

    await screen.findAllByText('Anna Client')
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

  it('shows a colored timeline row per master for ADMIN, each labeled with the master name', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([
      makeBooking({ id: 'b1', masterId: 'master-1', clientId: 'client-1' }),
      makeBooking({
        id: 'b2',
        masterId: 'master-2',
        clientId: 'client-2',
        startTime: '2026-03-10T16:00:00.000Z',
        endTime: '2026-03-10T17:00:00.000Z',
      }),
    ])
    mockedListClients.mockResolvedValue([client, clientTwo])
    mockedListStaff.mockResolvedValue([master, masterTwo])
    mockedGetRevenueReport.mockResolvedValue(revenueReport)

    renderPage()

    const timeline = await screen.findByRole('img', { name: /таймлайн/i })
    const rowLabels = timeline.querySelectorAll('.dashboard-timeline-row-label')
    expect(Array.from(rowLabels).map((label) => label.textContent)).toEqual(['Master One', 'Master Two'])

    // Каждая запись — в своей строке
    const rows = timeline.querySelectorAll('.dashboard-timeline-row')
    expect(within(rows[0] as HTMLElement).getByText('Anna Client')).toBeInTheDocument()
    expect(within(rows[1] as HTMLElement).getByText('Boris Client')).toBeInTheDocument()
  })

  it('puts overlapping bookings of two different masters on separate rows instead of overlapping visually', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([
      makeBooking({
        id: 'b1',
        masterId: 'master-1',
        clientId: 'client-1',
        startTime: '2026-03-10T13:45:00.000Z',
        endTime: '2026-03-10T15:45:00.000Z',
      }),
      makeBooking({
        id: 'b2',
        masterId: 'master-2',
        clientId: 'client-2',
        startTime: '2026-03-10T14:00:00.000Z',
        endTime: '2026-03-10T15:00:00.000Z',
      }),
    ])
    mockedListClients.mockResolvedValue([client, clientTwo])
    mockedListStaff.mockResolvedValue([master, masterTwo])
    mockedGetRevenueReport.mockResolvedValue(revenueReport)

    renderPage()

    const timeline = await screen.findByRole('img', { name: /таймлайн/i })
    const rows = Array.from(timeline.querySelectorAll('.dashboard-timeline-row'))
    expect(rows).toHaveLength(2)
    expect(within(rows[0] as HTMLElement).getByText('Anna Client')).toBeInTheDocument()
    expect(within(rows[0] as HTMLElement).queryByText('Boris Client')).not.toBeInTheDocument()
    expect(within(rows[1] as HTMLElement).getByText('Boris Client')).toBeInTheDocument()
    expect(within(rows[1] as HTMLElement).queryByText('Anna Client')).not.toBeInTheDocument()
  })

  it('shows only the master’s own bookings on the timeline for MASTER, in a single unlabeled row', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([makeBooking({ id: 'b1', masterId: 'master-1', clientId: 'client-1' })])
    mockedListClients.mockResolvedValue([client])

    renderPage()

    const timeline = await screen.findByRole('img', { name: /таймлайн/i })
    expect(within(timeline).getByText('Anna Client')).toBeInTheDocument()
    expect(timeline.querySelectorAll('.dashboard-timeline-row')).toHaveLength(1)
    expect(timeline.querySelector('.dashboard-timeline-row-label')).not.toBeInTheDocument()
    expect(mockedListStaff).not.toHaveBeenCalled()
  })

  it('excludes CANCELLED bookings from the timeline', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([
      makeBooking({ id: 'b1', clientId: 'client-1', status: 'CREATED' }),
      makeBooking({
        id: 'b2',
        clientId: 'client-2',
        status: 'CANCELLED',
        startTime: '2026-03-10T16:00:00.000Z',
        endTime: '2026-03-10T17:00:00.000Z',
      }),
    ])
    mockedListClients.mockResolvedValue([client, clientTwo])
    mockedListStaff.mockResolvedValue([master])
    mockedGetRevenueReport.mockResolvedValue(revenueReport)

    renderPage()

    const timeline = await screen.findByRole('img', { name: /таймлайн/i })
    expect(within(timeline).getByText('Anna Client')).toBeInTheDocument()
    expect(within(timeline).queryByText('Boris Client')).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no active bookings today for the timeline', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([makeBooking({ id: 'b1', status: 'CANCELLED' })])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master])
    mockedGetRevenueReport.mockResolvedValue(revenueReport)

    renderPage()

    expect(await screen.findByText(/на сегодня активных записей нет/i)).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /таймлайн/i })).not.toBeInTheDocument()
  })
})
