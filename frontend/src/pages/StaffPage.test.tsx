import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { StaffPage } from './StaffPage'
import { useAuth } from '../auth/useAuth'
import { listStaff } from '../api/staff'
import type { AuthenticatedUser } from '../types/auth'
import type { Master } from '../types/staff'

vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../api/staff', () => ({
  listStaff: vi.fn(),
  createMaster: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)
const mockedListStaff = vi.mocked(listStaff)

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

function makeMaster(overrides: Partial<Master>): Master {
  return {
    id: 'master-1',
    salonId: 'salon-1',
    name: 'Anna Kowalska',
    specialization: 'SPA',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <StaffPage />
    </MemoryRouter>,
  )
}

describe('StaffPage', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads and lists masters with their specialization', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListStaff.mockResolvedValue([makeMaster({})])

    renderPage()

    expect(await screen.findByText('Anna Kowalska')).toBeInTheDocument()
    expect(screen.getByText('СПА')).toBeInTheDocument()
  })

  it('flags an inactive master', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListStaff.mockResolvedValue([makeMaster({ isActive: false })])

    renderPage()

    expect(await screen.findByText('Неактивен')).toBeInTheDocument()
  })

  it('filters the list via the search box', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListStaff.mockResolvedValue([
      makeMaster({ id: 'm-anna', name: 'Anna Kowalska' }),
      makeMaster({ id: 'm-boris', name: 'Boris Nowak' }),
    ])

    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Anna Kowalska')

    await user.type(screen.getByLabelText(/поиск/i), 'Boris')

    expect(screen.queryByText('Anna Kowalska')).not.toBeInTheDocument()
    expect(screen.getByText('Boris Nowak')).toBeInTheDocument()
  })

  it('shows "+ Новый мастер" for ADMIN but not for MASTER (own profile only, read-only)', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListStaff.mockResolvedValue([])
    const { unmount } = renderPage()
    expect(await screen.findByRole('button', { name: /новый мастер/i })).toBeInTheDocument()
    unmount()

    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedListStaff.mockResolvedValue([makeMaster({ id: 'master-1', name: 'Self Master' })])
    renderPage()
    await screen.findByText('Self Master')
    expect(screen.queryByRole('button', { name: /новый мастер/i })).not.toBeInTheDocument()
  })

  it('links each master row to their detail page', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListStaff.mockResolvedValue([makeMaster({ id: 'm-anna', name: 'Anna Kowalska' })])

    renderPage()

    const link = await screen.findByRole('link', { name: /anna kowalska/i })
    expect(link).toHaveAttribute('href', '/staff/m-anna')
  })
})
