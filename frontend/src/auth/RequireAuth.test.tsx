import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './RequireAuth'
import { useAuth } from './useAuth'
import type { AuthStatus } from './auth-context'

vi.mock('./useAuth', () => ({ useAuth: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)

function renderWithStatus(status: AuthStatus, initialPath = '/protected') {
  mockedUseAuth.mockReturnValue({
    status,
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
  })

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route element={<RequireAuth />}>
          <Route path="/protected" element={<p>Protected content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  it('shows a loading state while auth status is resolving', () => {
    renderWithStatus('loading')
    expect(screen.getByText(/загрузка/i)).toBeInTheDocument()
  })

  it('redirects to /login when unauthenticated', () => {
    renderWithStatus('unauthenticated')
    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('renders the protected outlet when authenticated', () => {
    renderWithStatus('authenticated')
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })
})
