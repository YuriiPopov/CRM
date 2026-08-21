import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from './AppRoutes'
import { AuthProvider } from './auth/AuthContext'
import { setStoredToken } from './api/client'
import { fetchCurrentUser } from './api/auth'

vi.mock('./api/auth', () => ({
  login: vi.fn(),
  fetchCurrentUser: vi.fn(),
}))

const mockedFetchCurrentUser = vi.mocked(fetchCurrentUser)

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AppRoutes', () => {
  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('sends an unauthenticated visitor to the login page', async () => {
    renderApp('/')

    expect(await screen.findByRole('heading', { name: /вход в b4u crm/i })).toBeInTheDocument()
  })

  it('sends an authenticated ADMIN from "/" to the dashboard', async () => {
    setStoredToken('fake-token')
    mockedFetchCurrentUser.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@b4u.local',
      role: 'ADMIN',
      salonId: 'salon-1',
      masterId: null,
    })

    renderApp('/')

    expect(await screen.findByRole('heading', { name: /дашборд/i })).toBeInTheDocument()
  })

  it('sends an authenticated MASTER from "/" to their schedule', async () => {
    setStoredToken('fake-token')
    mockedFetchCurrentUser.mockResolvedValue({
      id: 'master-1',
      email: 'master@b4u.local',
      role: 'MASTER',
      salonId: 'salon-1',
      masterId: 'master-rec-1',
    })

    renderApp('/')

    expect(await screen.findByRole('heading', { name: /моё расписание/i })).toBeInTheDocument()
  })

  it('redirects a MASTER away from an ADMIN-only route back to their own section', async () => {
    setStoredToken('fake-token')
    mockedFetchCurrentUser.mockResolvedValue({
      id: 'master-1',
      email: 'master@b4u.local',
      role: 'MASTER',
      salonId: 'salon-1',
      masterId: 'master-rec-1',
    })

    renderApp('/finance')

    expect(await screen.findByRole('heading', { name: /моё расписание/i })).toBeInTheDocument()
  })

  it('lets both roles reach the shared clients section', async () => {
    setStoredToken('fake-token')
    mockedFetchCurrentUser.mockResolvedValue({
      id: 'master-1',
      email: 'master@b4u.local',
      role: 'MASTER',
      salonId: 'salon-1',
      masterId: 'master-rec-1',
    })

    renderApp('/clients')

    expect(await screen.findByRole('heading', { name: /клиенты/i })).toBeInTheDocument()
  })

  it('clears the session and bounces to login when /auth/me rejects (expired token)', async () => {
    setStoredToken('stale-token')
    mockedFetchCurrentUser.mockRejectedValue(new Error('Unauthorized'))

    renderApp('/dashboard')

    expect(await screen.findByRole('heading', { name: /вход в b4u crm/i })).toBeInTheDocument()
  })

  it('renders a 404 page for an unknown route', async () => {
    renderApp('/does-not-exist')

    expect(await screen.findByRole('heading', { name: /страница не найдена/i })).toBeInTheDocument()
  })
})
