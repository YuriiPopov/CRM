import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarPage } from './CalendarPage'
import { useAuth } from '../auth/useAuth'
import { listBookings, updateBookingStatus } from '../api/bookings'
import { listClients } from '../api/clients'
import { listStaff } from '../api/staff'
import { listServices } from '../api/services'
import type { AuthenticatedUser } from '../types/auth'
import type { Booking } from '../types/booking'
import type { Client } from '../types/client'
import type { Master } from '../types/staff'
import type { Service } from '../types/service'

vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../api/bookings', () => ({
  listBookings: vi.fn(),
  updateBookingStatus: vi.fn(),
}))
vi.mock('../api/clients', () => ({ listClients: vi.fn() }))
vi.mock('../api/staff', () => ({ listStaff: vi.fn() }))
vi.mock('../api/services', () => ({ listServices: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)
const mockedListBookings = vi.mocked(listBookings)
const mockedUpdateBookingStatus = vi.mocked(updateBookingStatus)
const mockedListClients = vi.mocked(listClients)
const mockedListStaff = vi.mocked(listStaff)
const mockedListServices = vi.mocked(listServices)

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
  specialization: 'SPA',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const service: Service = {
  id: 'service-1',
  salonId: 'salon-1',
  name: 'Massage',
  category: 'MASSAGE',
  durationMin: 60,
  price: 150,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const booking: Booking = {
  id: 'booking-1',
  salonId: 'salon-1',
  clientId: 'client-1',
  masterId: 'master-1',
  serviceId: 'service-1',
  startTime: '2026-03-10T10:00:00.000Z',
  endTime: '2026-03-10T11:00:00.000Z',
  status: 'CREATED',
  source: 'ADMIN',
  createdAt: '2026-03-01T00:00:00.000Z',
}

function mockAxiosError(status: number, message: string) {
  return { isAxiosError: true, response: { status, data: { message } } }
}

async function selectDate(value: string) {
  const dateInput = await screen.findByLabelText(/дата/i)
  fireEvent.change(dateInput, { target: { value } })
}

describe('CalendarPage', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads and displays a booking on the selected day, resolving client/service/master names', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([booking])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master])
    mockedListServices.mockResolvedValue([service])

    render(<CalendarPage />)
    await selectDate('2026-03-10')

    const row = (await screen.findByText('Anna Client')).closest('li')!
    expect(within(row).getByText('Massage')).toBeInTheDocument()
    expect(within(row).getByText('Master One')).toBeInTheDocument()
  })

  it('shows nothing for a day with no bookings', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([booking])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master])
    mockedListServices.mockResolvedValue([service])

    render(<CalendarPage />)
    await selectDate('2026-03-11')

    expect(await screen.findByText(/на эту дату записей нет/i)).toBeInTheDocument()
    expect(screen.queryByText('Anna Client')).not.toBeInTheDocument()
  })

  it('shows the master filter for ADMIN', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([])
    mockedListClients.mockResolvedValue([])
    mockedListStaff.mockResolvedValue([master])
    mockedListServices.mockResolvedValue([])

    render(<CalendarPage />)

    expect(await screen.findByLabelText(/мастер/i)).toBeInTheDocument()
    expect(mockedListStaff).toHaveBeenCalled()
  })

  it('hides the master filter for MASTER and never fetches the staff list', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([])
    mockedListClients.mockResolvedValue([])
    mockedListServices.mockResolvedValue([])

    render(<CalendarPage />)

    expect(await screen.findByText(/на эту дату записей нет/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/мастер/i)).not.toBeInTheDocument()
    expect(mockedListStaff).not.toHaveBeenCalled()
  })

  it('shows a friendly message and leaves the booking unchanged when a status change is rejected (409)', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([booking])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master])
    mockedListServices.mockResolvedValue([service])
    mockedUpdateBookingStatus.mockRejectedValue(
      mockAxiosError(409, 'Cannot transition booking from CREATED to CONFIRMED'),
    )

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')

    const confirmButton = await screen.findByRole('button', { name: /подтвердить/i })
    await user.click(confirmButton)

    expect(await screen.findByRole('alert')).toHaveTextContent(/недопустим/i)
    // Booking is still shown (list was not corrupted by the failed action)
    expect(screen.getByText('Anna Client')).toBeInTheDocument()
  })

  it('only offers status actions allowed for the current role (MASTER cannot confirm)', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([booking])
    mockedListClients.mockResolvedValue([client])
    mockedListServices.mockResolvedValue([service])

    render(<CalendarPage />)
    await selectDate('2026-03-10')

    await screen.findByText('Anna Client')
    expect(screen.queryByRole('button', { name: /подтвердить/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /отменить/i })).toBeInTheDocument()
  })
})
