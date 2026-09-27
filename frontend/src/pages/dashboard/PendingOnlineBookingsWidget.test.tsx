import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PendingOnlineBookingsWidget } from './PendingOnlineBookingsWidget'
import { AppLayout } from '../../layouts/AppLayout'
import { useAuth } from '../../auth/useAuth'
import { getPendingOnlineCount, listBookings, updateBookingStatus } from '../../api/bookings'
import type { AuthenticatedUser } from '../../types/auth'
import type { Booking } from '../../types/booking'
import type { Client } from '../../types/client'
import type { Master } from '../../types/staff'
import type { Service } from '../../types/service'

vi.mock('../../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../../api/staff', () => ({ getMaster: vi.fn() }))
vi.mock('../../api/bookings', () => ({
  listBookings: vi.fn(),
  updateBookingStatus: vi.fn(),
  getPendingOnlineCount: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)
const mockedListBookings = vi.mocked(listBookings)
const mockedUpdateBookingStatus = vi.mocked(updateBookingStatus)
const mockedGetPendingOnlineCount = vi.mocked(getPendingOnlineCount)

const adminUser: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@b4u.local',
  role: 'ADMIN',
  salonId: 'salon-1',
  masterId: null,
}

const client: Client = {
  id: 'client-1',
  salonId: 'salon-1',
  name: 'Anna Client',
  phone: '+48000000001',
  email: null,
  notes: null,
  tags: [],
  consentGivenAt: null,
  consentWithdrawnAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const master: Master = {
  id: 'master-1',
  salonId: 'salon-1',
  name: 'Master One',
  specializationCategoryIds: [],
  isActive: true,
  photo: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const service: Service = {
  id: 'service-1',
  salonId: 'salon-1',
  name: 'Massage',
  categoryId: 'category-massage',
  durationMin: 60,
  price: 150,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const HOUR = 60 * 60 * 1000

function makeBooking(overrides: Partial<Booking>): Booking {
  const start = Date.now() + 24 * HOUR
  return {
    id: 'booking-1',
    salonId: 'salon-1',
    clientId: 'client-1',
    masterId: 'master-1',
    serviceId: 'service-1',
    startTime: new Date(start).toISOString(),
    endTime: new Date(start + HOUR).toISOString(),
    status: 'CREATED',
    source: 'ONLINE',
    createdAt: '2026-01-01T00:00:00.000Z',
    rescheduledAt: null,
    originalStartTime: null,
    originalEndTime: null,
    ...overrides,
  }
}

// Виджет рендерится внутри AppLayout — так же, как на реальном Дашборде, — чтобы проверить,
// что действие в виджете сразу обновляет счётчик у пункта «Календарь записей».
function renderWidget(onBookingUpdated = vi.fn()) {
  mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route
            path="/dashboard"
            element={
              <PendingOnlineBookingsWidget
                clientsById={new Map([[client.id, client]])}
                mastersById={new Map([[master.id, master]])}
                servicesById={new Map([[service.id, service]])}
                onBookingUpdated={onBookingUpdated}
              />
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
  return onBookingUpdated
}

function calendarNavLink() {
  return screen.getByRole('link', { name: /Календарь записей/ })
}

describe('PendingOnlineBookingsWidget', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('requests future ONLINE bookings in CREATED status and shows date, time, client, service and master', async () => {
    const pending = makeBooking({ id: 'pending' })
    mockedListBookings.mockResolvedValue([pending])
    mockedGetPendingOnlineCount.mockResolvedValue(1)

    renderWidget()

    const row = (await screen.findByText('Anna Client')).closest('li')!
    expect(mockedListBookings).toHaveBeenCalledWith({
      source: 'ONLINE',
      status: 'CREATED',
      from: expect.any(String) as string,
    })
    expect(within(row).getByText('Massage')).toBeInTheDocument()
    expect(within(row).getByText('Master One')).toBeInTheDocument()
    expect(within(row).getByText('MO')).toBeInTheDocument()
    expect(within(row).getByText(new Date(pending.startTime).toLocaleDateString('ru-RU'))).toBeInTheDocument()
  })

  it('shows only ONLINE + CREATED + future bookings, even if the response contains others', async () => {
    mockedListBookings.mockResolvedValue([
      makeBooking({ id: 'pending', clientId: 'client-1' }),
      makeBooking({ id: 'crm', source: 'ADMIN' }),
      makeBooking({ id: 'confirmed', status: 'CONFIRMED' }),
      makeBooking({
        id: 'past',
        startTime: new Date(Date.now() - 2 * HOUR).toISOString(),
        endTime: new Date(Date.now() - HOUR).toISOString(),
      }),
    ])
    mockedGetPendingOnlineCount.mockResolvedValue(1)

    renderWidget()

    await screen.findByText('Anna Client')
    expect(screen.getAllByRole('button', { name: 'Подтвердить' })).toHaveLength(1)
  })

  it('shows the empty state when nothing is waiting', async () => {
    mockedListBookings.mockResolvedValue([])
    mockedGetPendingOnlineCount.mockResolvedValue(0)

    renderWidget()

    expect(await screen.findByText('Нет онлайн-записей, ожидающих подтверждения')).toBeInTheDocument()
    expect(within(calendarNavLink()).queryByLabelText(/Ждут подтверждения/)).not.toBeInTheDocument()
  })

  it('"Подтвердить" confirms the booking, removes it from the list and decreases the nav counter', async () => {
    const pending = makeBooking({ id: 'pending' })
    mockedListBookings.mockResolvedValue([pending])
    mockedGetPendingOnlineCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0)
    mockedUpdateBookingStatus.mockResolvedValue({ ...pending, status: 'CONFIRMED' })

    const user = userEvent.setup()
    const onBookingUpdated = renderWidget()

    await screen.findByText('Anna Client')
    expect(await within(calendarNavLink()).findByLabelText('Ждут подтверждения: 1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Подтвердить' }))

    expect(mockedUpdateBookingStatus).toHaveBeenCalledWith('pending', 'CONFIRMED')
    expect(await screen.findByText('Нет онлайн-записей, ожидающих подтверждения')).toBeInTheDocument()
    expect(onBookingUpdated).toHaveBeenCalledWith({ ...pending, status: 'CONFIRMED' })
    await waitFor(() => {
      expect(within(calendarNavLink()).queryByLabelText(/Ждут подтверждения/)).not.toBeInTheDocument()
    })
  })

  it('"Отклонить" asks for confirmation, then cancels the booking and removes it from the list', async () => {
    const pending = makeBooking({ id: 'pending' })
    mockedListBookings.mockResolvedValue([pending])
    mockedGetPendingOnlineCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0)
    mockedUpdateBookingStatus.mockResolvedValue({ ...pending, status: 'CANCELLED' })

    const user = userEvent.setup()
    renderWidget()

    await screen.findByText('Anna Client')
    await user.click(screen.getByRole('button', { name: 'Отклонить' }))

    const dialog = screen.getByRole('dialog', { name: 'Отклонить запись?' })
    expect(mockedUpdateBookingStatus).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Отклонить' }))

    expect(mockedUpdateBookingStatus).toHaveBeenCalledWith('pending', 'CANCELLED')
    expect(await screen.findByText('Нет онлайн-записей, ожидающих подтверждения')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(within(calendarNavLink()).queryByLabelText(/Ждут подтверждения/)).not.toBeInTheDocument()
    })
  })

  it('closing the reject dialog with "Отмена" leaves the booking untouched', async () => {
    mockedListBookings.mockResolvedValue([makeBooking({ id: 'pending' })])
    mockedGetPendingOnlineCount.mockResolvedValue(1)

    const user = userEvent.setup()
    renderWidget()

    await screen.findByText('Anna Client')
    await user.click(screen.getByRole('button', { name: 'Отклонить' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Отмена' }))

    expect(mockedUpdateBookingStatus).not.toHaveBeenCalled()
    expect(screen.getByText('Anna Client')).toBeInTheDocument()
  })

  it('keeps the booking and shows an error when the status change fails', async () => {
    mockedListBookings.mockResolvedValue([makeBooking({ id: 'pending' })])
    mockedGetPendingOnlineCount.mockResolvedValue(1)
    mockedUpdateBookingStatus.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'Cannot transition booking from CANCELLED to CONFIRMED' } },
    })

    const user = userEvent.setup()
    renderWidget()

    await screen.findByText('Anna Client')
    await user.click(screen.getByRole('button', { name: 'Подтвердить' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Anna Client')).toBeInTheDocument()
  })
})
