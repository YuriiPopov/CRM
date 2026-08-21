import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LoginPage } from './LoginPage'
import { useAuth } from '../auth/useAuth'

vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>Home page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  it('submits credentials and navigates home on success', async () => {
    const login = vi.fn().mockResolvedValue(undefined)
    mockedUseAuth.mockReturnValue({ status: 'unauthenticated', user: null, login, logout: vi.fn() })

    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByLabelText(/email/i), 'admin@b4u.local')
    await user.type(screen.getByLabelText(/пароль/i), 'AdminPass1')
    await user.click(screen.getByRole('button', { name: /войти/i }))

    expect(login).toHaveBeenCalledWith('admin@b4u.local', 'AdminPass1')
    expect(await screen.findByText('Home page')).toBeInTheDocument()
  })

  it('shows an error message when login fails', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Invalid credentials'))
    mockedUseAuth.mockReturnValue({ status: 'unauthenticated', user: null, login, logout: vi.fn() })

    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByLabelText(/email/i), 'admin@b4u.local')
    await user.type(screen.getByLabelText(/пароль/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /войти/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/неверный email или пароль/i)
  })

  it('redirects away immediately when already authenticated', () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: { id: 'u1', email: 'admin@b4u.local', role: 'ADMIN', salonId: 's1', masterId: null },
      login: vi.fn(),
      logout: vi.fn(),
    })

    renderLoginPage()

    expect(screen.getByText('Home page')).toBeInTheDocument()
  })
})
