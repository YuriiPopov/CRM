import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateBookingModal } from './CreateBookingModal'
import { useAuth } from '../../auth/useAuth'
import { getAvailableSlots } from '../../api/publicBooking'
import type { AuthenticatedUser } from '../../types/auth'
import type { Client } from '../../types/client'
import type { Master, MasterServiceLink } from '../../types/staff'
import type { Service } from '../../types/service'

vi.mock('../../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../../api/bookings', () => ({ createBooking: vi.fn() }))
vi.mock('../../api/publicBooking', () => ({ getAvailableSlots: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)
const mockedGetAvailableSlots = vi.mocked(getAvailableSlots)

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

const masterOne: Master = {
  id: 'master-1',
  salonId: 'salon-1',
  name: 'Anna Master',
  specializationCategoryIds: ['category-spa'],
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const masterTwo: Master = { ...masterOne, id: 'master-2', name: 'Boris Master' }
const masterThree: Master = { ...masterOne, id: 'master-3', name: 'No Services Master' }

const serviceOne: Service = {
  id: 'service-1',
  salonId: 'salon-1',
  name: 'Massage',
  categoryId: 'category-massage',
  durationMin: 60,
  price: 150,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const serviceTwo: Service = { ...serviceOne, id: 'service-2', name: 'Manicure', categoryId: 'category-manicure' }

// master-1 offers only service-1, master-2 offers only service-2, master-3 offers nothing
const links: MasterServiceLink[] = [
  { masterId: 'master-1', serviceId: 'service-1' },
  { masterId: 'master-2', serviceId: 'service-2' },
]

function renderModal(overrides: Partial<Parameters<typeof CreateBookingModal>[0]> = {}) {
  return render(
    <CreateBookingModal
      clients={[client]}
      masters={[masterOne, masterTwo, masterThree]}
      services={[serviceOne, serviceTwo]}
      masterServiceLinks={links}
      defaultDate="2026-03-10"
      onClose={vi.fn()}
      onCreated={vi.fn()}
      onClientCreated={vi.fn()}
      {...overrides}
    />,
  )
}

function optionLabels(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole('option')
    .map((option) => option.textContent ?? '')
}

describe('CreateBookingModal — mutual master/service filtering', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedGetAvailableSlots.mockResolvedValue({ date: '2026-03-10', masterId: '', serviceId: '', slots: [] })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows every master and every service while nothing is selected yet', () => {
    renderModal()

    expect(optionLabels(screen.getByLabelText(/мастер/i))).toEqual([
      expect.stringMatching(/выберите мастера/i),
      'Anna Master',
      'Boris Master',
      'No Services Master',
    ])
    expect(optionLabels(screen.getByLabelText(/услуга/i))).toEqual([
      expect.stringMatching(/выберите услугу/i),
      expect.stringContaining('Massage'),
      expect.stringContaining('Manicure'),
    ])
  })

  it('narrows the service list to only what the selected master offers', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.selectOptions(screen.getByLabelText(/мастер/i), 'master-1')

    expect(optionLabels(screen.getByLabelText(/услуга/i))).toEqual([
      expect.stringMatching(/выберите услугу/i),
      expect.stringContaining('Massage'),
    ])
  })

  it('narrows the master list to only those offering the selected service', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.selectOptions(screen.getByLabelText(/услуга/i), 'service-2')

    expect(optionLabels(screen.getByLabelText(/мастер/i))).toEqual([
      expect.stringMatching(/выберите мастера/i),
      'Boris Master',
    ])
  })

  // Примечание: раз оба списка живьём сужаются друг другом одновременно, выбрать через сам
  // <select> вариант, несовместимый с текущим значением другого поля, невозможно в принципе —
  // любая доступная в списке опция уже гарантированно совместима (сама логика сужения это
  // обеспечивает). Поэтому сценарий "сброс несовместимого выбора" через клики по форме
  // непроверяем — а вот сама защита (isMasterServiceLinked) целиком покрыта юнит-тестами
  // в masterServiceFilter.test.ts, включая ветку "несовместимо".
  it('keeps a previously selected master intact when narrowing removes other options, without ever leaving an invalid pair', async () => {
    const user = userEvent.setup()
    renderModal()

    const masterSelect = screen.getByLabelText(/мастер/i) as HTMLSelectElement
    const serviceSelect = screen.getByLabelText(/услуга/i) as HTMLSelectElement

    await user.selectOptions(masterSelect, 'master-1')
    await user.selectOptions(serviceSelect, 'service-1')

    // На этом этапе оба списка сужены друг другом до единственного взаимно совместимого варианта
    expect(optionLabels(masterSelect)).toEqual([expect.stringMatching(/выберите мастера/i), 'Anna Master'])
    expect(optionLabels(serviceSelect)).toEqual([
      expect.stringMatching(/выберите услугу/i),
      expect.stringContaining('Massage'),
    ])
    expect(masterSelect.value).toBe('master-1')
    expect(serviceSelect.value).toBe('service-1')
  })

  it('does not reset the other selection when switching to a compatible pair', async () => {
    const user = userEvent.setup()
    renderModal()

    const masterSelect = screen.getByLabelText(/мастер/i) as HTMLSelectElement
    const serviceSelect = screen.getByLabelText(/услуга/i) as HTMLSelectElement

    await user.selectOptions(masterSelect, 'master-1')
    await user.selectOptions(serviceSelect, 'service-1')

    expect(masterSelect.value).toBe('master-1')
    expect(serviceSelect.value).toBe('service-1')
  })

  it('shows no service options (without crashing) for a master with no linked services', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.selectOptions(screen.getByLabelText(/мастер/i), 'master-3')

    expect(optionLabels(screen.getByLabelText(/услуга/i))).toEqual([expect.stringMatching(/выберите услугу/i)])
  })

  it('has no selectable master field for MASTER', () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    renderModal({ masters: [], masterServiceLinks: [] })

    expect(screen.queryByLabelText(/мастер/i)).not.toBeInTheDocument()
    expect(screen.getByText('Мастер: вы')).toBeInTheDocument()
  })

  // Backlog п.5 — сервисы, доступные MASTER в форме создания записи, сужаются до тех, что
  // привязаны к нему через MasterService (masterServiceLinks), тем же приёмом, что и для ADMIN.
  it('narrows the service list to only what the current master offers, for MASTER', () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    renderModal({ masters: [], masterServiceLinks: links })

    expect(optionLabels(screen.getByLabelText(/услуга/i))).toEqual([
      expect.stringMatching(/выберите услугу/i),
      expect.stringContaining('Massage'),
    ])
  })

  it('shows no service options for MASTER with no linked services', () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    renderModal({ masters: [], masterServiceLinks: [] })

    expect(optionLabels(screen.getByLabelText(/услуга/i))).toEqual([expect.stringMatching(/выберите услугу/i)])
  })
})
