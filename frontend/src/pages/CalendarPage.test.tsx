import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarPage } from './CalendarPage'
import { useAuth } from '../auth/useAuth'
import { listBookings, rescheduleBooking, updateBookingStatus } from '../api/bookings'
import { listClients } from '../api/clients'
import { listMasterServiceLinks, listStaff } from '../api/staff'
import { listServices } from '../api/services'
import { createPayment, listPayments } from '../api/payments'
import { listMasterBlocks } from '../api/masterBlocks'
import { getMasterSchedule } from '../api/masterSchedules'
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
  rescheduleBooking: vi.fn(),
}))
vi.mock('../api/clients', () => ({ listClients: vi.fn() }))
vi.mock('../api/staff', () => ({ listStaff: vi.fn(), listMasterServiceLinks: vi.fn() }))
vi.mock('../api/services', () => ({ listServices: vi.fn() }))
vi.mock('../api/payments', () => ({
  listPayments: vi.fn(),
  createPayment: vi.fn(),
}))
vi.mock('../api/masterBlocks', () => ({
  listMasterBlocks: vi.fn(),
  createMasterBlock: vi.fn(),
  deleteMasterBlock: vi.fn(),
}))
vi.mock('../api/masterSchedules', () => ({
  getMasterSchedule: vi.fn(),
  upsertMasterSchedule: vi.fn(),
  findMasterScheduleConflicts: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)
const mockedListBookings = vi.mocked(listBookings)
const mockedUpdateBookingStatus = vi.mocked(updateBookingStatus)
const mockedRescheduleBooking = vi.mocked(rescheduleBooking)
const mockedListClients = vi.mocked(listClients)
const mockedListStaff = vi.mocked(listStaff)
const mockedListMasterServiceLinks = vi.mocked(listMasterServiceLinks)
const mockedListServices = vi.mocked(listServices)
const mockedListPayments = vi.mocked(listPayments)
const mockedCreatePayment = vi.mocked(createPayment)
const mockedListMasterBlocks = vi.mocked(listMasterBlocks)
const mockedGetMasterSchedule = vi.mocked(getMasterSchedule)

// CalendarPage грузит связки мастер↔услуга только для формы создания записи (см.
// masterServiceFilter.ts) — сами тесты этого файла её не открывают, поэтому достаточно
// безобидного дефолта, чтобы не ломать существующие ADMIN-сценарии загрузкой.
mockedListMasterServiceLinks.mockResolvedValue([])
// Блокировки грузятся безусловно (и для ADMIN, и для MASTER) при каждом монтировании
// CalendarPage — сами тесты этого файла блокировки не открывают, безобидный дефолт.
mockedListMasterBlocks.mockResolvedValue([])
// График мастера (item28, подзадача №35) догружается при недельной/месячной сетке и в режиме
// "По мастерам" — безобидный дефолт "график не настроен" для тестов, которые не проверяют его.
mockedGetMasterSchedule.mockResolvedValue([])

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
  specializationCategoryIds: ['category-spa'],
  isActive: true,
  photo: null,
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
  categoryId: 'category-massage',
  durationMin: 60,
  price: 150,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const serviceTwo: Service = {
  ...service,
  id: 'service-2',
  name: 'Haircut',
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
  rescheduledAt: null,
  originalStartTime: null,
  originalEndTime: null,
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

// jsdom's DragEvent has no working dataTransfer — the standard RTL workaround for native
// HTML5 DnD (@testing-library/user-event doesn't fully support it either).
function makeDataTransfer() {
  return { effectAllowed: '', dropEffect: '', setData: () => {}, getData: () => '' }
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

  // item48: раньше все блокировки рендерились отдельным списком перед всеми записями,
  // независимо от времени — блокировка на 15:00 оказывалась выше записи на 10:00.
  it('interleaves a later block with an earlier booking in chronological order in the "Список" view', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([booking])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master])
    mockedListServices.mockResolvedValue([service])
    mockedListPayments.mockResolvedValue([])
    mockedListMasterBlocks.mockResolvedValue([
      {
        id: 'block-1',
        salonId: 'salon-1',
        masterId: 'master-1',
        startTime: '2026-03-10T15:00:00.000Z',
        endTime: '2026-03-10T16:00:00.000Z',
        reason: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        createdById: null,
      },
    ])

    render(<CalendarPage />)
    await selectDate('2026-03-10')
    await screen.findByText('Anna Client')

    const items = document.querySelectorAll('.booking-list > li')
    expect(items).toHaveLength(2)
    expect(within(items[0] as HTMLElement).getByText('Anna Client')).toBeInTheDocument()
    expect(within(items[1] as HTMLElement).getByText('Заблокировано')).toBeInTheDocument()

    // vi.clearAllMocks() (afterEach) clears calls, not the resolved value set above — restore
    // the file's shared "no blocks" default so later tests aren't affected by this one.
    mockedListMasterBlocks.mockResolvedValue([])
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

  it('shows the service filter to ADMIN', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([])
    mockedListClients.mockResolvedValue([])
    mockedListStaff.mockResolvedValue([master])
    mockedListServices.mockResolvedValue([service, serviceTwo])
    mockedListPayments.mockResolvedValue([])

    render(<CalendarPage />)

    expect(await screen.findByLabelText(/^услуга$/i)).toBeInTheDocument()
  })

  it('shows the service filter to MASTER, unlike the master filter', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([])
    mockedListClients.mockResolvedValue([])
    mockedListServices.mockResolvedValue([service, serviceTwo])

    render(<CalendarPage />)

    expect(await screen.findByLabelText(/^услуга$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^мастер$/i)).not.toBeInTheDocument()
  })

  it('narrows the list to bookings for the selected service, independently of the master filter', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    const bookingServiceTwo: Booking = { ...booking, id: 'booking-service-2', serviceId: 'service-2' }
    mockedListBookings.mockResolvedValue([booking, bookingServiceTwo])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master])
    mockedListServices.mockResolvedValue([service, serviceTwo])
    mockedListPayments.mockResolvedValue([])

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')
    await screen.findAllByText('Anna Client')

    await user.selectOptions(screen.getByLabelText(/^услуга$/i), 'service-2')

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getByText('Haircut')).toBeInTheDocument()
  })

  it('combines the master and service filters with AND logic', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    // `booking` is master-1/service-1 (matches both filters below); these two each match only
    // one of the two filters, so AND-combining master-1 + service-1 must exclude both of them.
    const bookingMasterOneServiceTwo: Booking = {
      ...booking,
      id: 'booking-m1-s2',
      masterId: 'master-1',
      serviceId: 'service-2',
    }
    const bookingMasterTwoServiceOne: Booking = {
      ...booking,
      id: 'booking-m2-s1',
      masterId: 'master-2',
      serviceId: 'service-1',
    }
    mockedListBookings.mockResolvedValue([booking, bookingMasterOneServiceTwo, bookingMasterTwoServiceOne])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master, masterTwo])
    mockedListServices.mockResolvedValue([service, serviceTwo])
    mockedListPayments.mockResolvedValue([])

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')
    await screen.findAllByText('Anna Client')

    await user.selectOptions(screen.getByLabelText(/^мастер$/i), 'master-1')
    await user.selectOptions(screen.getByLabelText(/^услуга$/i), 'service-1')

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getByText('Massage')).toBeInTheDocument()
  })

  it('lets MASTER narrow their own (already server-scoped) bookings by service', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    // Server already scopes GET /bookings to this master's own bookings — no masterId filtering
    // happens client-side for MASTER, only the service narrowing under test here.
    const ownBookingServiceTwo: Booking = { ...booking, id: 'booking-own-s2', serviceId: 'service-2' }
    mockedListBookings.mockResolvedValue([booking, ownBookingServiceTwo])
    mockedListClients.mockResolvedValue([client])
    mockedListServices.mockResolvedValue([service, serviceTwo])

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')
    await screen.findAllByText('Anna Client')

    await user.selectOptions(screen.getByLabelText(/^услуга$/i), 'service-2')

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getByText('Haircut')).toBeInTheDocument()
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
    const row = (await screen.findByText('Anna Client')).closest('li')!
    expect(within(row).getByText('Оплачено')).toBeInTheDocument()
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

    const masterOneColumn = screen.getByRole('heading', { name: 'Master One' }).closest<HTMLElement>('.master-column')!
    expect(within(masterOneColumn).getByText('Anna Client')).toBeInTheDocument()

    const masterTwoColumn = screen.getByRole('heading', { name: 'Master Two' }).closest<HTMLElement>('.master-column')!
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

    const masterTwoColumn = screen.getByRole('heading', { name: 'Master Two' }).closest<HTMLElement>('.master-column')!
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

  it('applies the service filter in "По мастерам" mode too, unlike the master filter', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    const bookingMasterOneServiceTwo: Booking = {
      ...booking,
      id: 'booking-m1-s2',
      masterId: 'master-1',
      serviceId: 'service-2',
    }
    const bookingMasterTwoServiceOne: Booking = {
      ...booking,
      id: 'booking-m2-s1',
      masterId: 'master-2',
      serviceId: 'service-1',
    }
    mockedListBookings.mockResolvedValue([booking, bookingMasterOneServiceTwo, bookingMasterTwoServiceOne])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master, masterTwo])
    mockedListServices.mockResolvedValue([service, serviceTwo])
    mockedListPayments.mockResolvedValue([])

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')
    await screen.findAllByText('Anna Client')

    await user.click(screen.getByRole('button', { name: /по мастерам/i }))
    await user.selectOptions(screen.getByLabelText(/^услуга$/i), 'service-1')

    const masterOneColumn = screen.getByRole('heading', { name: 'Master One' }).closest<HTMLElement>('.master-column')!
    expect(within(masterOneColumn).getAllByRole('listitem')).toHaveLength(1)
    expect(within(masterOneColumn).getByText('Massage')).toBeInTheDocument()

    const masterTwoColumn = screen.getByRole('heading', { name: 'Master Two' }).closest<HTMLElement>('.master-column')!
    expect(within(masterTwoColumn).getAllByRole('listitem')).toHaveLength(1)
    expect(within(masterTwoColumn).getByText('Massage')).toBeInTheDocument()
  })

  it('unchecking a status hides bookings with that status, and re-checking it shows them again', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    const cancelledBooking: Booking = { ...booking, id: 'booking-cancelled', status: 'CANCELLED' }
    mockedListBookings.mockResolvedValue([booking, cancelledBooking])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master])
    mockedListServices.mockResolvedValue([service])
    mockedListPayments.mockResolvedValue([])

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')
    await screen.findAllByText('Anna Client')

    expect(screen.getAllByRole('listitem')).toHaveLength(2)

    await user.click(screen.getByRole('checkbox', { name: 'Отменена' }))
    const remaining = screen.getAllByRole('listitem')
    expect(remaining).toHaveLength(1)
    expect(within(remaining[0]).getByText('Создана')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Отменена' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('shows a filter-specific empty state (not the plain "no bookings" one) when every status is unchecked', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([booking])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master])
    mockedListServices.mockResolvedValue([service])
    mockedListPayments.mockResolvedValue([])

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')
    await screen.findByText('Anna Client')

    for (const status of ['Создана', 'Подтверждена', 'Завершена', 'Отменена']) {
      await user.click(screen.getByRole('checkbox', { name: status }))
    }

    expect(await screen.findByText(/соответствующих выбранным фильтрам/i)).toBeInTheDocument()
    expect(screen.queryByText(/^на эту дату записей нет$/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Anna Client')).not.toBeInTheDocument()
  })

  it('does not show the payment filter to MASTER', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([])
    mockedListClients.mockResolvedValue([])
    mockedListServices.mockResolvedValue([])

    render(<CalendarPage />)

    await screen.findByText(/на эту дату записей нет/i)
    expect(screen.queryByText('Оплата')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Оплачено' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Не оплачено' })).not.toBeInTheDocument()
    // Статус, в отличие от оплаты, доступен и MASTER
    expect(screen.getByText('Статус')).toBeInTheDocument()
  })

  it('unchecking "Не оплачено" for ADMIN hides unpaid bookings but keeps paid ones', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([booking, completedBooking])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master])
    mockedListServices.mockResolvedValue([service])
    mockedListPayments.mockResolvedValue([existingPayment])

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')
    await screen.findAllByText('Anna Client')

    expect(screen.getAllByRole('listitem')).toHaveLength(2)

    await user.click(screen.getByRole('checkbox', { name: 'Не оплачено' }))

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getByText('Оплачено')).toBeInTheDocument()
  })

  it('applies the status filter per column in "По мастерам" mode, with a filter-specific empty state', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    const cancelledForMasterTwo: Booking = {
      ...booking,
      id: 'booking-cancelled-m2',
      masterId: 'master-2',
      status: 'CANCELLED',
    }
    mockedListBookings.mockResolvedValue([booking, cancelledForMasterTwo])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master, masterTwo])
    mockedListServices.mockResolvedValue([service])
    mockedListPayments.mockResolvedValue([])

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')
    await screen.findAllByText('Anna Client')

    await user.click(screen.getByRole('button', { name: /по мастерам/i }))
    await user.click(screen.getByRole('checkbox', { name: 'Отменена' }))

    const masterOneColumn = screen.getByRole('heading', { name: 'Master One' }).closest<HTMLElement>('.master-column')!
    expect(within(masterOneColumn).getByText('Anna Client')).toBeInTheDocument()

    const masterTwoColumn = screen.getByRole('heading', { name: 'Master Two' }).closest<HTMLElement>('.master-column')!
    expect(within(masterTwoColumn).queryByText('Anna Client')).not.toBeInTheDocument()
    expect(within(masterTwoColumn).getByText(/по выбранным фильтрам/i)).toBeInTheDocument()
  })

  it('offers "Неделя"/"Месяц" to both ADMIN and MASTER, switching to either renders the grid', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([booking])
    mockedListClients.mockResolvedValue([client])
    mockedListServices.mockResolvedValue([service])

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')
    await screen.findByText('Anna Client')

    await user.click(screen.getByRole('button', { name: /^неделя$/i }))
    expect(document.querySelectorAll('.calendar-grid-cell')).toHaveLength(7)

    await user.click(screen.getByRole('button', { name: /^месяц$/i }))
    expect(document.querySelectorAll('.calendar-grid-cell')).toHaveLength(42)
  })

  it('shows the master name (not the client) to ADMIN and "Это вы" (not the master name) to MASTER in the week grid', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([booking])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master])
    mockedListServices.mockResolvedValue([service])
    mockedListPayments.mockResolvedValue([])

    const user = userEvent.setup()
    const { unmount } = render(<CalendarPage />)
    await selectDate('2026-03-10')
    await user.click(screen.getByRole('button', { name: /^неделя$/i }))

    // "Massage" also appears as an <option> in the "Услуга" filter select, so restrict the
    // match to the <strong> the grid card renders it in (see BookingGridCard).
    const cell = (await screen.findByText('Massage', { selector: 'strong' })).closest('[data-date]')!
    expect(within(cell as HTMLElement).getByText('Master One')).toBeInTheDocument()
    expect(within(cell as HTMLElement).queryByText('Anna Client')).not.toBeInTheDocument()
    unmount()

    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([booking])
    mockedListClients.mockResolvedValue([client])
    mockedListServices.mockResolvedValue([service])

    render(<CalendarPage />)
    await selectDate('2026-03-10')
    await user.click(screen.getByRole('button', { name: /^неделя$/i }))

    expect(await screen.findByText('Anna Client')).toBeInTheDocument()
    expect(await screen.findByText('Это вы')).toBeInTheDocument()
    expect(screen.queryByText('Master One')).not.toBeInTheDocument()
  })

  it('drags a booking to another day in the week grid: calls rescheduleBooking with the new date and reloads', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings
      .mockResolvedValueOnce([booking])
      .mockResolvedValueOnce([{ ...booking, startTime: '2026-03-12T10:00:00.000Z', endTime: '2026-03-12T11:00:00.000Z' }])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master])
    mockedListServices.mockResolvedValue([service])
    mockedListPayments.mockResolvedValue([])
    mockedRescheduleBooking.mockResolvedValue({ ...booking, startTime: '2026-03-12T10:00:00.000Z' })

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')
    await user.click(screen.getByRole('button', { name: /^неделя$/i }))

    // ADMIN card body shows service/master, not the client (see BookingGridCard). "Massage"
    // also appears as an <option> in the "Услуга" filter select, so restrict to the <strong>.
    const card = (await screen.findByText('Massage', { selector: 'strong' })).closest('li')!
    const targetCell = document.querySelector('[data-date="2026-03-12"]')!
    const dataTransfer = makeDataTransfer()

    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.dragOver(targetCell, { dataTransfer })
    fireEvent.drop(targetCell, { dataTransfer })

    expect(mockedRescheduleBooking).toHaveBeenCalledWith('booking-1', {
      startTime: '2026-03-12T10:00:00.000Z',
      masterId: 'master-1',
    })
    // Optimistic update moves the card to the target cell immediately, before the API resolves.
    expect(within(targetCell as HTMLElement).getByText('Massage')).toBeInTheDocument()

    await waitFor(() => expect(mockedListBookings).toHaveBeenCalledTimes(2))
  })

  it('rolls the booking back to its original day and shows actionError when the grid reschedule is rejected', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([booking])
    mockedListClients.mockResolvedValue([client])
    mockedListStaff.mockResolvedValue([master])
    mockedListServices.mockResolvedValue([service])
    mockedListPayments.mockResolvedValue([])
    mockedRescheduleBooking.mockRejectedValue(mockAxiosError(409, 'Cannot reschedule this booking'))

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')
    await user.click(screen.getByRole('button', { name: /^неделя$/i }))

    // ADMIN card body shows service/master, not the client (see BookingGridCard). "Massage"
    // also appears as an <option> in the "Услуга" filter select, so restrict to the <strong>.
    const card = (await screen.findByText('Massage', { selector: 'strong' })).closest('li')!
    const sourceCell = document.querySelector('[data-date="2026-03-10"]')!
    const targetCell = document.querySelector('[data-date="2026-03-12"]')!
    const dataTransfer = makeDataTransfer()

    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.dragOver(targetCell, { dataTransfer })
    fireEvent.drop(targetCell, { dataTransfer })

    expect(await screen.findByRole('alert')).toHaveTextContent(/нельзя перенести/i)
    expect(within(sourceCell as HTMLElement).getByText('Massage')).toBeInTheDocument()
    expect(within(targetCell as HTMLElement).queryByText('Massage')).not.toBeInTheDocument()
  })

  it('renders no draggable cards for MASTER in the week grid', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedListBookings.mockResolvedValue([booking])
    mockedListClients.mockResolvedValue([client])
    mockedListServices.mockResolvedValue([service])

    const user = userEvent.setup()
    render(<CalendarPage />)
    await selectDate('2026-03-10')
    await user.click(screen.getByRole('button', { name: /^неделя$/i }))

    const card = (await screen.findByText('Anna Client')).closest('li')!
    expect(card).toHaveAttribute('draggable', 'false')
    expect(screen.queryByRole('button', { name: /перенести/i })).not.toBeInTheDocument()
  })

  // Регулярный график работы мастера (Backlog item28, подзадача №35).
  describe('master schedule availability', () => {
    it('darkens and blocks a non-working day in the week grid once ADMIN filters to a specific master', async () => {
      mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
      mockedListBookings.mockResolvedValue([booking]) // master-1, 2026-03-10
      mockedListClients.mockResolvedValue([client])
      mockedListStaff.mockResolvedValue([master])
      mockedListServices.mockResolvedValue([service])
      mockedListPayments.mockResolvedValue([])
      mockedGetMasterSchedule.mockResolvedValue([
        {
          id: 'schedule-1',
          salonId: 'salon-1',
          masterId: 'master-1',
          date: '2026-03-11T00:00:00.000Z',
          isWorking: false,
          startTime: null,
          endTime: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ])

      const user = userEvent.setup()
      render(<CalendarPage />)
      await selectDate('2026-03-10')
      await screen.findByLabelText(/^мастер$/i)

      // "Все мастера" (по умолчанию) — график не запрашивается, ячейка ничем не выделяется.
      await user.click(screen.getByRole('button', { name: /^неделя$/i }))
      expect(document.querySelectorAll('.calendar-grid-cell')).toHaveLength(7)
      expect(mockedGetMasterSchedule).not.toHaveBeenCalled()

      await user.selectOptions(screen.getByLabelText(/^мастер$/i), 'master-1')

      const blockedCell = await waitFor(() => {
        const cell = document.querySelector('[data-date="2026-03-11"]')!
        expect(cell.className).toContain('calendar-grid-cell--schedule-blocked')
        return cell as HTMLElement
      })
      expect(mockedGetMasterSchedule).toHaveBeenCalledWith('master-1', 2026, 3)

      const otherCell = document.querySelector('[data-date="2026-03-12"]')!
      expect(otherCell.className).not.toContain('calendar-grid-cell--schedule-blocked')

      // Перенос на заблокированный день не должен даже вызывать rescheduleBooking. "Massage"
      // also appears as an <option> in the "Услуга" filter select, so restrict to the <strong>.
      const card = await screen.findByText('Massage', { selector: 'strong' })
      const dataTransfer = makeDataTransfer()
      fireEvent.dragStart(card.closest('li')!, { dataTransfer })
      fireEvent.dragOver(blockedCell, { dataTransfer })
      fireEvent.drop(blockedCell, { dataTransfer })

      expect(mockedRescheduleBooking).not.toHaveBeenCalled()
    })

    it('darkens a MASTER\'s own non-working day on "Моё расписание" without any master filter', async () => {
      mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
      mockedListBookings.mockResolvedValue([])
      mockedListClients.mockResolvedValue([client])
      mockedListServices.mockResolvedValue([service])
      mockedGetMasterSchedule.mockResolvedValue([
        {
          id: 'schedule-1',
          salonId: 'salon-1',
          masterId: 'master-1',
          date: '2026-03-11T00:00:00.000Z',
          isWorking: false,
          startTime: null,
          endTime: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ])

      const user = userEvent.setup()
      render(<CalendarPage />)
      await selectDate('2026-03-10')
      await user.click(screen.getByRole('button', { name: /^неделя$/i }))

      expect(mockedGetMasterSchedule).toHaveBeenCalledWith('master-1', 2026, 3)
      const blockedCell = await waitFor(() => {
        const cell = document.querySelector('[data-date="2026-03-11"]')!
        expect(cell.className).toContain('calendar-grid-cell--schedule-blocked')
        return cell
      })
      expect(blockedCell).toBeTruthy()
    })

    it('hides a master\'s column entirely in "По мастерам" on their non-working day, but shows it when the day is not configured', async () => {
      mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
      mockedListBookings.mockResolvedValue([booking])
      mockedListClients.mockResolvedValue([client])
      mockedListStaff.mockResolvedValue([master, masterTwo])
      mockedListServices.mockResolvedValue([service])
      mockedListPayments.mockResolvedValue([])
      mockedGetMasterSchedule.mockImplementation((masterId) =>
        Promise.resolve(
          masterId === 'master-1'
            ? [
                {
                  id: 'schedule-1',
                  salonId: 'salon-1',
                  masterId: 'master-1',
                  date: '2026-03-10T00:00:00.000Z',
                  isWorking: false,
                  startTime: null,
                  endTime: null,
                  createdAt: '2026-01-01T00:00:00.000Z',
                },
              ]
            : [], // master-2: график не настроен ("не размечено") — колонка не скрывается
        ),
      )

      const user = userEvent.setup()
      render(<CalendarPage />)
      await selectDate('2026-03-10')
      await screen.findByText('Anna Client')

      await user.click(screen.getByRole('button', { name: /по мастерам/i }))

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Master One' })).not.toBeInTheDocument()
      })
      expect(screen.getByRole('heading', { name: 'Master Two' })).toBeInTheDocument()
    })
  })
})
