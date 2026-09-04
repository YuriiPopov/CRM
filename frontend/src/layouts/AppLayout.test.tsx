import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { useAuth } from '../auth/useAuth'
import { getMaster } from '../api/staff'
import { getMasterColor } from '../pages/dashboard/masterColor'
import type { AuthenticatedUser } from '../types/auth'
import type { MasterDetail } from '../types/staff'

vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../api/staff', () => ({ getMaster: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)
const mockedGetMaster = vi.mocked(getMaster)

const adminUser: AuthenticatedUser = {
  id: 'admin-1',
  email: 'anna.admin@b4u.local',
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

const masterDetail: MasterDetail = {
  id: 'master-1',
  salonId: 'salon-1',
  name: 'Anna Master',
  specializationCategoryIds: [],
  isActive: true,
  photo: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  services: [],
}

function renderLayout(user: AuthenticatedUser) {
  mockedUseAuth.mockReturnValue({
    status: 'authenticated',
    user,
    login: vi.fn(),
    logout: vi.fn(),
  })

  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<p>Page content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppLayout user avatar', () => {
  it('shows the logged in email without the "Выполнен вход под именем" caption', () => {
    renderLayout(adminUser)
    expect(screen.getByText(adminUser.email)).toBeInTheDocument()
    expect(screen.queryByText(/Выполнен вход/)).not.toBeInTheDocument()
  })

  it('renders initials on a fixed color for ADMIN, ignoring getMasterColor', () => {
    renderLayout(adminUser)

    const placeholder = screen.getByText('AA')
    expect(placeholder).toHaveStyle({ backgroundColor: '#64748b' })
    expect(placeholder).not.toHaveStyle({ backgroundColor: getMasterColor(adminUser.id) })
    expect(mockedGetMaster).not.toHaveBeenCalled()
  })

  it('renders the linked Master photo for MASTER when loaded', async () => {
    mockedGetMaster.mockResolvedValue({ ...masterDetail, photo: 'data:image/png;base64,abc' })
    const { container } = renderLayout(masterUser)

    expect(mockedGetMaster).toHaveBeenCalledWith('master-1')
    await waitFor(() => {
      expect(container.querySelector('img.app-user-avatar')).toHaveAttribute(
        'src',
        'data:image/png;base64,abc',
      )
    })
  })

  it('falls back to initials on the master color for MASTER without a photo', async () => {
    mockedGetMaster.mockResolvedValue(masterDetail)
    renderLayout(masterUser)

    await waitFor(() => {
      const placeholder = screen.getByText('AM')
      expect(placeholder).toHaveStyle({ backgroundColor: getMasterColor('master-1') })
    })
  })
})
