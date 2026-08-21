import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RequireRole } from './RequireRole'
import { useAuth } from './useAuth'
import type { AuthenticatedUser } from '../types/auth'

vi.mock('./useAuth', () => ({ useAuth: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)

const adminUser: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@b4u.local',
  role: 'ADMIN',
  salonId: 'salon-1',
  masterId: null,
}

function renderWithUser(user: AuthenticatedUser | null) {
  mockedUseAuth.mockReturnValue({
    status: user ? 'authenticated' : 'unauthenticated',
    user,
    login: vi.fn(),
    logout: vi.fn(),
  })

  return render(
    <MemoryRouter initialEntries={['/admin-only']}>
      <Routes>
        <Route path="/" element={<p>Home page</p>} />
        <Route element={<RequireRole role="ADMIN" />}>
          <Route path="/admin-only" element={<p>Admin content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireRole', () => {
  it('renders the outlet when the user role matches', () => {
    renderWithUser(adminUser)
    expect(screen.getByText('Admin content')).toBeInTheDocument()
  })

  it('redirects to / when the user role does not match', () => {
    renderWithUser({ ...adminUser, role: 'MASTER' })
    expect(screen.getByText('Home page')).toBeInTheDocument()
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument()
  })

  it('redirects to / when there is no user', () => {
    renderWithUser(null)
    expect(screen.getByText('Home page')).toBeInTheDocument()
  })
})
