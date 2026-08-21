import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ServicesPage } from './ServicesPage'
import { useAuth } from '../auth/useAuth'
import { deleteService, listServices } from '../api/services'
import type { AuthenticatedUser } from '../types/auth'
import type { Service } from '../types/service'

vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../api/services', () => ({
  listServices: vi.fn(),
  createService: vi.fn(),
  updateService: vi.fn(),
  deleteService: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)
const mockedListServices = vi.mocked(listServices)
const mockedDeleteService = vi.mocked(deleteService)

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

function makeService(overrides: Partial<Service>): Service {
  return {
    id: 'service-1',
    salonId: 'salon-1',
    name: 'Manicure',
    category: 'MANICURE_PEDICURE',
    durationMin: 60,
    price: 100,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function mockAxiosError(status: number, message: string) {
  return { isAxiosError: true, response: { status, data: { message } } }
}

describe('ServicesPage', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads and lists services with category/duration/price', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListServices.mockResolvedValue([makeService({})])

    render(<ServicesPage />)

    expect(await screen.findByText('Manicure')).toBeInTheDocument()
    expect(screen.getByText('Маникюр/педикюр')).toBeInTheDocument()
    expect(screen.getByText(/60 мин/)).toBeInTheDocument()
  })

  it('filters the list via the search box', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListServices.mockResolvedValue([
      makeService({ id: 's-manicure', name: 'Manicure' }),
      makeService({ id: 's-massage', name: 'Relax Massage', category: 'MASSAGE' }),
    ])

    const user = userEvent.setup()
    render(<ServicesPage />)
    await screen.findByText('Manicure')

    await user.type(screen.getByLabelText(/поиск/i), 'Massage')

    expect(screen.queryByText('Manicure')).not.toBeInTheDocument()
    expect(screen.getByText('Relax Massage')).toBeInTheDocument()
  })

  it('shows create/edit/delete actions for ADMIN but only a read-only list for MASTER', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListServices.mockResolvedValue([makeService({})])
    const { unmount } = render(<ServicesPage />)
    expect(await screen.findByRole('button', { name: /новая услуга/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /редактировать/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /удалить/i })).toBeInTheDocument()
    unmount()

    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedListServices.mockResolvedValue([makeService({})])
    render(<ServicesPage />)
    await screen.findByText('Manicure')
    expect(screen.queryByRole('button', { name: /новая услуга/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /редактировать/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /удалить/i })).not.toBeInTheDocument()
  })

  it('shows a friendly message when deleting a service still referenced elsewhere (409)', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListServices.mockResolvedValue([makeService({})])
    mockedDeleteService.mockRejectedValue(
      mockAxiosError(
        409,
        'Cannot delete a service that is still referenced by masters, materials, or bookings',
      ),
    )

    const user = userEvent.setup()
    render(<ServicesPage />)
    await screen.findByText('Manicure')

    await user.click(screen.getByRole('button', { name: /удалить/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^удалить$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/ещё используется/i)
    // Service is still listed since deletion failed
    expect(screen.getByText('Manicure')).toBeInTheDocument()
  })

  it('removes the service from the list after a successful delete', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListServices.mockResolvedValue([makeService({})])
    mockedDeleteService.mockResolvedValue(undefined)

    const user = userEvent.setup()
    render(<ServicesPage />)
    await screen.findByText('Manicure')

    await user.click(screen.getByRole('button', { name: /удалить/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^удалить$/i }))

    expect(await screen.findByText(/услуг пока нет/i)).toBeInTheDocument()
  })
})
