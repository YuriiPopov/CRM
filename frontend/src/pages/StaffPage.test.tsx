import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { StaffPage } from './StaffPage'
import { useAuth } from '../auth/useAuth'
import { listStaff } from '../api/staff'
import { listServiceCategories } from '../api/serviceCategories'
import type { AuthenticatedUser } from '../types/auth'
import type { Master } from '../types/staff'
import type { ServiceCategoryRef } from '../types/service'

vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../api/staff', () => ({
  listStaff: vi.fn(),
  createMaster: vi.fn(),
}))
vi.mock('../api/serviceCategories', () => ({
  listServiceCategories: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)
const mockedListStaff = vi.mocked(listStaff)
const mockedListServiceCategories = vi.mocked(listServiceCategories)

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

function makeCategory(overrides: Partial<ServiceCategoryRef> = {}): ServiceCategoryRef {
  return {
    id: 'category-spa',
    salonId: 'salon-1',
    name: 'СПА',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const categories: ServiceCategoryRef[] = [
  makeCategory(),
  makeCategory({ id: 'category-massage', name: 'Массаж', isDefault: false }),
]

function makeMaster(overrides: Partial<Master>): Master {
  return {
    id: 'master-1',
    salonId: 'salon-1',
    name: 'Anna Kowalska',
    specializationCategoryIds: ['category-spa'],
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
    mockedListServiceCategories.mockResolvedValue(categories)

    renderPage()

    const link = await screen.findByRole('link', { name: /anna kowalska/i })
    expect(within(link).getByText('СПА')).toBeInTheDocument()
  })

  it('joins multiple specialization names for a master with several categories', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListStaff.mockResolvedValue([
      makeMaster({ specializationCategoryIds: ['category-spa', 'category-massage'] }),
    ])
    mockedListServiceCategories.mockResolvedValue(categories)

    renderPage()

    const link = await screen.findByRole('link', { name: /anna kowalska/i })
    expect(within(link).getByText('СПА, Массаж')).toBeInTheDocument()
  })

  it('hides inactive masters by default', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListStaff.mockResolvedValue([makeMaster({ isActive: false })])
    mockedListServiceCategories.mockResolvedValue(categories)

    renderPage()

    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument()
    expect(screen.queryByText('Anna Kowalska')).not.toBeInTheDocument()
  })

  it('shows and flags an inactive master once "Показывать неактивных" is checked, alongside active ones', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListStaff.mockResolvedValue([
      makeMaster({ id: 'm-anna', name: 'Anna Kowalska', isActive: true }),
      makeMaster({ id: 'm-boris', name: 'Boris Nowak', isActive: false }),
    ])
    mockedListServiceCategories.mockResolvedValue(categories)

    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Anna Kowalska')
    expect(screen.queryByText('Boris Nowak')).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Показывать неактивных' }))

    expect(screen.getByText('Anna Kowalska')).toBeInTheDocument()
    const inactiveLink = await screen.findByRole('link', { name: /boris nowak/i })
    expect(within(inactiveLink).getByText('Неактивен')).toBeInTheDocument()
    expect(inactiveLink).toHaveClass('client-list-item--inactive')

    const activeLink = screen.getByRole('link', { name: /anna kowalska/i })
    expect(activeLink).not.toHaveClass('client-list-item--inactive')
  })

  it('filters the list via the search box', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListStaff.mockResolvedValue([
      makeMaster({ id: 'm-anna', name: 'Anna Kowalska' }),
      makeMaster({ id: 'm-boris', name: 'Boris Nowak' }),
    ])
    mockedListServiceCategories.mockResolvedValue(categories)

    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Anna Kowalska')

    await user.type(screen.getByLabelText(/поиск/i), 'Boris')

    expect(screen.queryByText('Anna Kowalska')).not.toBeInTheDocument()
    expect(screen.getByText('Boris Nowak')).toBeInTheDocument()
  })

  it('filters the list via category checkboxes (OR across selected categories)', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListStaff.mockResolvedValue([
      makeMaster({ id: 'm-anna', name: 'Anna Kowalska', specializationCategoryIds: ['category-spa'] }),
      makeMaster({ id: 'm-boris', name: 'Boris Nowak', specializationCategoryIds: ['category-massage'] }),
      makeMaster({ id: 'm-carla', name: 'Carla Silva', specializationCategoryIds: ['category-spa', 'category-massage'] }),
    ])
    mockedListServiceCategories.mockResolvedValue(categories)

    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Anna Kowalska')

    await user.click(screen.getByRole('checkbox', { name: 'СПА' }))

    expect(screen.getByText('Anna Kowalska')).toBeInTheDocument()
    expect(screen.getByText('Carla Silva')).toBeInTheDocument()
    expect(screen.queryByText('Boris Nowak')).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Массаж' }))

    expect(screen.getByText('Anna Kowalska')).toBeInTheDocument()
    expect(screen.getByText('Boris Nowak')).toBeInTheDocument()
    expect(screen.getByText('Carla Silva')).toBeInTheDocument()
  })

  it('shows "+ Новый мастер" for ADMIN but not for MASTER (own profile only, read-only)', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListStaff.mockResolvedValue([])
    mockedListServiceCategories.mockResolvedValue(categories)
    const { unmount } = renderPage()
    expect(await screen.findByRole('button', { name: /новый мастер/i })).toBeInTheDocument()
    unmount()

    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedListStaff.mockResolvedValue([makeMaster({ id: 'master-1', name: 'Self Master' })])
    mockedListServiceCategories.mockResolvedValue(categories)
    renderPage()
    await screen.findByText('Self Master')
    expect(screen.queryByRole('button', { name: /новый мастер/i })).not.toBeInTheDocument()
  })

  it('links each master row to their detail page', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedListStaff.mockResolvedValue([makeMaster({ id: 'm-anna', name: 'Anna Kowalska' })])
    mockedListServiceCategories.mockResolvedValue(categories)

    renderPage()

    const link = await screen.findByRole('link', { name: /anna kowalska/i })
    expect(link).toHaveAttribute('href', '/staff/m-anna')
  })
})
