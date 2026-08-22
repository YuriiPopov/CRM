import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarPage } from './CalendarPage'
import { useAuth } from '../auth/useAuth'
import { listBookings, updateBookingStatus } from '../api/bookings'
import { listClients } from '../api/clients'
import { listStaff } from '../api/staff'
import { listServices } from '../api/services'
import { createPayment, listPayments } from '../api/payments'
import type { AuthenticatedUser } from '../types/auth'
import type { Booking } from '../types/booking'
import type { Client } from '../types/client'
import type { Master } from '../types/staff'
import type { Service } from '../types/service'
import type { Payment, PaymentView } from '../types/payment'

vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../api/bookings', () => ({
  listBookings: vi.fn(),
  updateBookingStatus: vi.fn(),
}))
vi.mock('../api/clients', () => ({ listClients: vi.fn() }))
vi.mock('../api/staff', () => ({ listStaff: vi.fn() }))
vi.mock('../api/services', () => ({ listServices: vi.fn() }))
vi.mock('../api/payments', () => ({
  listPayments: vi.fn(),
  createPayment: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)
const mockedListBookings = vi.mocked(listBookings)
const mockedUpdateBookingStatus = vi.mocked(updateBookingStatus)
const mockedListClients = vi.mocked(listClients)
const mockedListStaff = vi.mocked(listStaff)
const mockedListServices = vi.mocked(listServices)
const mockedListPayments = vi.mocked(listPayments)
const mockedCreatePayment = vi.mocked(createPayment)

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

const masterTwo: Master = {
  ...master,
  id: 'master-2',
  name: 'Master Two',
}

const inactiveMaster: Master = {
  ...master,
  id: 'master-3',
  name: 'Retired Master',
  isActive: false,
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

const completedBooking: Booking = {
  ...booking,
  id: 'booking-2',
  status: 'COMPLETED',
}

const existingPayment: PaymentView = {
  id: 'payment-1',
  bookingId: 'booking-2',
  amount: 150,
  discount: 0,
  method: 'cash',
  status: 'paid',
  paidAt: '2026-03-10T12:00:00.000Z',
}

const createdPayment: Payment = {
  id: 'payment-new',
  bookingId: 'booking-2',
  amount: 150,
  discount: 0,
  method: 'cash',
  status: 'paid',
  paidAt: '2026-03-10T12:00:00.000Z',
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
    mockedListPayments.mockResolvedValue([])

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
    mockedListPayments.mockResolvedValue([])

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
    mockedListPayments.mockResolvedValue([])

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
    mockedListPayments.mockResolvedValue([])
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

  it('offers "Создать оплату" for a COMPLETED booking without a payment, defaults the amount to the service price, and marks it paid once created', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([completedBooking])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master])
    mockedListServices.mockResolvedValue([service])
    mockedListPayments.mockResolvedValueOnce([]).mockResolvedValueOnce([existingPayment])
    mockedCreatePayment.mockResolvedValue(createdPayment)

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')

    await user.click(screen.getByRole('button', { name: /создать оплату/i }))

    const dialog = await screen.findByRole('dialog', { name: /оплата записи/i })
    expect((within(dialog).getByLabelText(/сумма/i) as HTMLInputElement).value).toBe('150')

    await user.click(within(dialog).getByRole('button', { name: /создать оплату/i }))

    expect(mockedCreatePayment).toHaveBeenCalledWith({
      bookingId: 'booking-2',
      amount: 150,
      discount: 0,
      method: 'cash',
    })
    expect(await screen.findByText('Оплачено')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /создать оплату/i })).not.toBeInTheDocument()
  })

  it('shows "Оплачено" and hides the payment button for a booking that already has a payment', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([completedBooking])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master])
    mockedListServices.mockResolvedValue([service])
    mockedListPayments.mockResolvedValue([existingPayment])

    render(<CalendarPage />)
    await selectDate('2026-03-10')

    const row = (await screen.findByText('Anna Client')).closest('li')!
    expect(within(row).getByText('Оплачено')).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: /создать оплату/i })).not.toBeInTheDocument()
  })

  it('never offers "Создать оплату" to MASTER, even for a completed booking, and never fetches payments', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([completedBooking])
    mockedListClients.mockResolvedValue([client])
    mockedListServices.mockResolvedValue([service])

    render(<CalendarPage />)
    await selectDate('2026-03-10')

    await screen.findByText('Anna Client')
    expect(screen.queryByRole('button', { name: /создать оплату/i })).not.toBeInTheDocument()
    expect(mockedListPayments).not.toHaveBeenCalled()
  })

  it('shows a friendly message and keeps the modal open when the booking already has a payment (409)', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([completedBooking])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master])
    mockedListServices.mockResolvedValue([service])
    mockedListPayments.mockResolvedValue([])
    mockedCreatePayment.mockRejectedValue(mockAxiosError(409, 'This booking already has a payment'))

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')

    await user.click(screen.getByRole('button', { name: /создать оплату/i }))
    const dialog = await screen.findByRole('dialog', { name: /оплата записи/i })
    await user.click(within(dialog).getByRole('button', { name: /создать оплату/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/уже есть оплата/i)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('does not offer the "По мастерам" toggle to MASTER', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([])
    mockedListClients.mockResolvedValue([])
    mockedListServices.mockResolvedValue([])

    render(<CalendarPage />)

    await screen.findByText(/на эту дату записей нет/i)
    expect(screen.queryByRole('button', { name: /по мастерам/i })).not.toBeInTheDocument()
  })

  it('switches to columns per active master, hides the master filter, and groups/sorts bookings within each column', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    const earlyBookingForMasterTwo: Booking = {
      ...booking,
      id: 'booking-early-m2',
      masterId: 'master-2',
      startTime: '2026-03-10T09:00:00.000Z',
      endTime: '2026-03-10T09:30:00.000Z',
    }
    const lateBookingForMasterTwo: Booking = {
      ...booking,
      id: 'booking-late-m2',
      masterId: 'master-2',
      startTime: '2026-03-10T15:00:00.000Z',
      endTime: '2026-03-10T15:30:00.000Z',
    }
    mockedListBookings.mockResolvedValue([lateBookingForMasterTwo, booking, earlyBookingForMasterTwo])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master, masterTwo, inactiveMaster])
    mockedListServices.mockResolvedValue([service])
    mockedListPayments.mockResolvedValue([])

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')
    await screen.findAllByText('Anna Client')

    await user.click(screen.getByRole('button', { name: /по мастерам/i }))

    // Фильтр "Мастер" скрыт в этом режиме
    expect(screen.queryByLabelText(/^мастер$/i)).not.toBeInTheDocument()

    // Колонка только для активных мастеров, неактивный ("Retired Master") не показан
    expect(screen.getByRole('heading', { name: 'Master One' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Master Two' })).toBeInTheDocument()
    expect(screen.queryByText('Retired Master')).not.toBeInTheDocument()

    const masterOneColumn = screen.getByRole('heading', { name: 'Master One' }).closest('.master-column')!
    expect(within(masterOneColumn).getByText('Anna Client')).toBeInTheDocument()

    const masterTwoColumn = screen.getByRole('heading', { name: 'Master Two' }).closest('.master-column')!
    const masterTwoItems = within(masterTwoColumn).getAllByRole('listitem')
    expect(masterTwoItems.map((item) => item.className)).toEqual([
      expect.stringContaining('booking-item'),
      expect.stringContaining('booking-item'),
    ])
    expect(within(masterTwoItems[0]).getByText(/09:00/)).toBeInTheDocument()
    expect(within(masterTwoItems[1]).getByText(/15:00/)).toBeInTheDocument()

    // Переключение обратно на "Список" восстанавливает фильтр "Мастер"
    await user.click(screen.getByRole('button', { name: /^список$/i }))
    expect(screen.getByLabelText(/^мастер$/i)).toBeInTheDocument()
  })

  it('shows an empty state for a master with no bookings on the selected day', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([booking])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master, masterTwo])
    mockedListServices.mockResolvedValue([service])
    mockedListPayments.mockResolvedValue([])

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')
    await screen.findByText('Anna Client')

    await user.click(screen.getByRole('button', { name: /по мастерам/i }))

    const masterTwoColumn = screen.getByRole('heading', { name: 'Master Two' }).closest('.master-column')!
    expect(within(masterTwoColumn).getByText(/нет записей/i)).toBeInTheDocument()
  })

  it('keeps applying the selected-master filter when returning to "Список" after "По мастерам"', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    const bookingForMasterTwo: Booking = { ...booking, id: 'booking-m2', masterId: 'master-2' }
    mockedListBookings.mockResolvedValue([booking, bookingForMasterTwo])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master, masterTwo])
    mockedListServices.mockResolvedValue([service])
    mockedListPayments.mockResolvedValue([])

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')
    await screen.findAllByText('Anna Client')

    await user.selectOptions(screen.getByLabelText(/^мастер$/i), 'master-2')
    await user.click(screen.getByRole('button', { name: /по мастерам/i }))
    await user.click(screen.getByRole('button', { name: /^список$/i }))

    // Фильтр остался выставленным на master-2, а не сбросился в "Все мастера" —
    // видна только одна запись (Master Two), запись Master One отфильтрована
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getByText('Master Two')).toBeInTheDocument()
  })
})
