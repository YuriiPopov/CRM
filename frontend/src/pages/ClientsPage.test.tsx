import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ClientsPage } from './ClientsPage'
import { useAuth } from '../auth/useAuth'
import { listClients } from '../api/clients'
import type { AuthenticatedUser } from '../types/auth'
import type { Client } from '../types/client'

vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../api/clients', () => ({
  listClients: vi.fn(),
  createClient: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)
const mockedListClients = vi.mocked(listClients)

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

function makeClient(overrides: Partial<Client>): Client {
  return {
    id: 'client-1',
    salonId: 'salon-1',
    name: 'Anna Kowalska',
    phone: '+48111111111',
    email: null,
    notes: null,
    tags: [],
    consentGivenAt: '2026-01-01T00:00:00.000Z',
    consentWithdrawnAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ClientsPage />
    </MemoryRouter>,
  )
}

describe('ClientsPage', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads and lists clients', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListClients.mockResolvedValue([
      makeClient({ id: 'c-anna', name: 'Anna Kowalska' }),
      makeClient({ id: 'c-boris', name: 'Boris Nowak', phone: '+48222222222' }),
    ])

    renderPage()

    expect(await screen.findByText('Anna Kowalska')).toBeInTheDocument()
    expect(screen.getByText('Boris Nowak')).toBeInTheDocument()
  })

  it('filters the list as the user types in the search box', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListClients.mockResolvedValue([
      makeClient({ id: 'c-anna', name: 'Anna Kowalska' }),
      makeClient({ id: 'c-boris', name: 'Boris Nowak', phone: '+48222222222' }),
    ])

    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Anna Kowalska')

    await user.type(screen.getByLabelText(/поиск/i), 'Boris')

    expect(screen.queryByText('Anna Kowalska')).not.toBeInTheDocument()
    expect(screen.getByText('Boris Nowak')).toBeInTheDocument()
  })

  it('shows an empty-state message when nothing matches the search', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListClients.mockResolvedValue([makeClient({ id: 'c-anna', name: 'Anna Kowalska' })])

    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Anna Kowalska')

    await user.type(screen.getByLabelText(/поиск/i), 'no such client')

    expect(await screen.findByText(/ничего не найдено/i)).toBeInTheDocument()
  })

  it('shows "+ Новый клиент" for ADMIN but not for MASTER', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListClients.mockResolvedValue([])
    const { unmount } = renderPage()
    expect(await screen.findByRole('button', { name: /новый клиент/i })).toBeInTheDocument()
    unmount()

    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedListClients.mockResolvedValue([])
    renderPage()
    await screen.findByText(/клиентов пока нет/i)
    expect(screen.queryByRole('button', { name: /новый клиент/i })).not.toBeInTheDocument()
  })

  it('links each client row to their detail page', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListClients.mockResolvedValue([makeClient({ id: 'c-anna', name: 'Anna Kowalska' })])

    renderPage()

    const link = await screen.findByRole('link', { name: /anna kowalska/i })
    expect(link).toHaveAttribute('href', '/clients/c-anna')
  })
})
