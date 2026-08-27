import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { StaffDetailPage } from './StaffDetailPage'
import { useAuth } from '../auth/useAuth'
import { assignService, getMaster, unassignService, updateMaster } from '../api/staff'
import { listServices } from '../api/services'
import { listServiceCategories } from '../api/serviceCategories'
import type { AuthenticatedUser } from '../types/auth'
import type { MasterDetail } from '../types/staff'
import type { Service, ServiceCategoryRef } from '../types/service'

vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../api/staff', () => ({
  getMaster: vi.fn(),
  assignService: vi.fn(),
  unassignService: vi.fn(),
  updateMaster: vi.fn(),
}))
vi.mock('../api/services', () => ({ listServices: vi.fn() }))
vi.mock('../api/serviceCategories', () => ({ listServiceCategories: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)
const mockedGetMaster = vi.mocked(getMaster)
const mockedAssignService = vi.mocked(assignService)
const mockedUnassignService = vi.mocked(unassignService)
const mockedUpdateMaster = vi.mocked(updateMaster)
const mockedListServices = vi.mocked(listServices)
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

const spaCategory: ServiceCategoryRef = {
  id: 'category-spa',
  salonId: 'salon-1',
  name: 'СПА',
  isDefault: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const massageCategory: ServiceCategoryRef = {
  id: 'category-massage',
  salonId: 'salon-1',
  name: 'Массаж',
  isDefault: false,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const manicureCategory: ServiceCategoryRef = {
  id: 'category-manicure',
  salonId: 'salon-1',
  name: 'Маникюр/педикюр',
  isDefault: false,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const categories: ServiceCategoryRef[] = [spaCategory, massageCategory, manicureCategory]

const massageService: Service = {
  id: 'service-1',
  salonId: 'salon-1',
  name: 'Massage',
  categoryId: 'category-massage',
  durationMin: 60,
  price: 150,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const manicureService: Service = {
  id: 'service-2',
  salonId: 'salon-1',
  name: 'Manicure',
  categoryId: 'category-manicure',
  durationMin: 30,
  price: 80,
  createdAt: '2026-01-01T00:00:00.000Z',
}

function makeMasterDetail(overrides: Partial<MasterDetail> = {}): MasterDetail {
  return {
    id: 'master-1',
    salonId: 'salon-1',
    name: 'Anna Kowalska',
    specializationCategoryIds: ['category-spa'],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    services: [massageService],
    ...overrides,
  }
}

function mockAxiosError(status: number, message: string) {
  return { isAxiosError: true, response: { status, data: { message } } }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/staff/master-1']}>
      <Routes>
        <Route path="/staff" element={<p>Staff list</p>} />
        <Route path="/staff/:id" element={<StaffDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StaffDetailPage', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads the master card and their attached services (ADMIN)', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedGetMaster.mockResolvedValue(makeMasterDetail())
    mockedListServices.mockResolvedValue([massageService, manicureService])
    mockedListServiceCategories.mockResolvedValue(categories)

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Anna Kowalska' })).toBeInTheDocument()
    expect(screen.getByText('СПА')).toBeInTheDocument()
    expect(screen.getByText('Активен')).toBeInTheDocument()
    const row = screen.getByText('Massage').closest('li')!
    expect(within(row).getByText(/60 мин/)).toBeInTheDocument()
  })

  it('joins multiple specialization names for a master with several categories', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedGetMaster.mockResolvedValue(
      makeMasterDetail({ specializationCategoryIds: ['category-spa', 'category-massage'] }),
    )
    mockedListServices.mockResolvedValue([massageService, manicureService])
    mockedListServiceCategories.mockResolvedValue(categories)

    renderPage()

    await screen.findByRole('heading', { name: 'Anna Kowalska' })
    expect(screen.getByText('СПА, Массаж')).toBeInTheDocument()
  })

  it('shows Edit and service-management controls for ADMIN, offering only unattached services', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedGetMaster.mockResolvedValue(makeMasterDetail())
    mockedListServices.mockResolvedValue([massageService, manicureService])
    mockedListServiceCategories.mockResolvedValue(categories)

    renderPage()

    expect(await screen.findByRole('button', { name: /редактировать/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /отвязать/i })).toBeInTheDocument()

    const select = screen.getByLabelText(/привязать услугу/i)
    expect(within(select).queryByText('Massage')).not.toBeInTheDocument()
    expect(within(select).getByText('Manicure')).toBeInTheDocument()
  })

  it('is read-only for MASTER viewing their own profile', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedGetMaster.mockResolvedValue(makeMasterDetail())
    mockedListServiceCategories.mockResolvedValue(categories)

    renderPage()

    await screen.findByRole('heading', { name: 'Anna Kowalska' })
    expect(screen.queryByRole('button', { name: /редактировать/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /отвязать/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/привязать услугу/i)).not.toBeInTheDocument()
    expect(mockedListServices).not.toHaveBeenCalled()
  })

  it('attaches a service and refreshes the attached list', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedGetMaster
      .mockResolvedValueOnce(makeMasterDetail())
      .mockResolvedValueOnce(makeMasterDetail({ services: [massageService, manicureService] }))
    mockedListServices.mockResolvedValue([massageService, manicureService])
    mockedListServiceCategories.mockResolvedValue(categories)
    mockedAssignService.mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Anna Kowalska' })

    await user.selectOptions(screen.getByLabelText(/привязать услугу/i), 'service-2')
    await user.click(screen.getByRole('button', { name: /^привязать$/i }))

    expect(mockedAssignService).toHaveBeenCalledWith('master-1', 'service-2')
    expect(await screen.findByText('Manicure')).toBeInTheDocument()
  })

  it('detaches a service after confirmation from the list', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedGetMaster
      .mockResolvedValueOnce(makeMasterDetail())
      .mockResolvedValueOnce(makeMasterDetail({ services: [] }))
    mockedListServices.mockResolvedValue([massageService, manicureService])
    mockedListServiceCategories.mockResolvedValue(categories)
    mockedUnassignService.mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Anna Kowalska' })

    await user.click(screen.getByRole('button', { name: /отвязать/i }))

    expect(mockedUnassignService).toHaveBeenCalledWith('master-1', 'service-1')
    expect(await screen.findByText(/услуги не привязаны/i)).toBeInTheDocument()
  })

  it('shows a friendly message and resyncs the list when detach fails (404, already unassigned)', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedGetMaster
      .mockResolvedValueOnce(makeMasterDetail())
      .mockResolvedValueOnce(makeMasterDetail({ services: [] }))
    mockedListServices.mockResolvedValue([massageService, manicureService])
    mockedListServiceCategories.mockResolvedValue(categories)
    mockedUnassignService.mockRejectedValue(
      mockAxiosError(404, 'Service is not assigned to this master'),
    )

    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Anna Kowalska' })

    await user.click(screen.getByRole('button', { name: /отвязать/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/уже не привязана/i)
    expect(await screen.findByText(/услуги не привязаны/i)).toBeInTheDocument()
  })

  it('saves edits through the edit modal and reloads the card', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedGetMaster.mockResolvedValue(makeMasterDetail())
    mockedListServices.mockResolvedValue([massageService, manicureService])
    mockedListServiceCategories.mockResolvedValue(categories)
    mockedUpdateMaster.mockResolvedValue(makeMasterDetail())

    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Anna Kowalska' })

    await user.click(screen.getByRole('button', { name: /редактировать/i }))
    await user.clear(screen.getByLabelText(/^имя$/i))
    await user.type(screen.getByLabelText(/^имя$/i), 'Anna Nowak')
    await user.click(screen.getByRole('button', { name: /сохранить/i }))

    expect(mockedUpdateMaster).toHaveBeenCalledWith(
      'master-1',
      expect.objectContaining({ name: 'Anna Nowak' }),
    )
    expect(mockedGetMaster).toHaveBeenCalledTimes(2)
  })

  it('shows a not-found message when the master cannot be loaded (out of scope / 404)', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedGetMaster.mockRejectedValue(mockAxiosError(404, 'Master not found'))
    mockedListServices.mockResolvedValue([])
    mockedListServiceCategories.mockResolvedValue(categories)

    renderPage()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /к списку мастеров/i })).toBeInTheDocument()
  })
})
