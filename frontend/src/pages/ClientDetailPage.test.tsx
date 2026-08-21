import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ClientDetailPage } from './ClientDetailPage'
import { useAuth } from '../auth/useAuth'
import { eraseClientData, exportClientData, updateClient } from '../api/clients'
import { listStaff } from '../api/staff'
import type { AuthenticatedUser } from '../types/auth'
import type { ClientExport } from '../types/clientExport'
import type { Master } from '../types/staff'

vi.mock('../auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../api/clients', () => ({
  exportClientData: vi.fn(),
  eraseClientData: vi.fn(),
  updateClient: vi.fn(),
}))
vi.mock('../api/staff', () => ({ listStaff: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)
const mockedExportClientData = vi.mocked(exportClientData)
const mockedEraseClientData = vi.mocked(eraseClientData)
const mockedUpdateClient = vi.mocked(updateClient)
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

const master: Master = {
  id: 'master-1',
  salonId: 'salon-1',
  name: 'Master One',
  specialization: 'SPA',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

function makeExport(overrides: Partial<ClientExport> = {}): ClientExport {
  return {
    client: {
      id: 'client-1',
      salonId: 'salon-1',
      name: 'Anna Kowalska',
      phone: '+48111111111',
      email: null,
      notes: 'VIP',
      tags: ['vip'],
      consentGivenAt: '2026-01-01T00:00:00.000Z',
      consentWithdrawnAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    bookings: [
      {
        id: 'booking-1',
        masterId: 'master-1',
        serviceId: 'service-1',
        serviceName: 'Massage',
        startTime: '2026-03-10T10:00:00.000Z',
        endTime: '2026-03-10T11:00:00.000Z',
        status: 'COMPLETED',
        source: 'ADMIN',
        payment: {
          id: 'payment-1',
          bookingId: 'booking-1',
          amount: 150,
          discount: 0,
          method: 'cash',
          status: 'paid',
          paidAt: '2026-03-10T11:05:00.000Z',
        },
      },
    ],
    exportedAt: '2026-03-15T00:00:00.000Z',
    ...overrides,
  }
}

function mockAxiosError(status: number, message: string) {
  return { isAxiosError: true, response: { status, data: { message } } }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/clients/client-1']}>
      <Routes>
        <Route path="/clients" element={<p>Client list</p>} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ClientDetailPage', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads the client card and their visit history (ADMIN sees full payment detail)', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedExportClientData.mockResolvedValue(makeExport())
    mockedListStaff.mockResolvedValue([master])

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Anna Kowalska' })).toBeInTheDocument()
    expect(screen.getByText('+48111111111')).toBeInTheDocument()
    expect(screen.getByText('VIP')).toBeInTheDocument()

    const row = screen.getByText('Massage').closest('li')!
    expect(within(row).getByText('Master One')).toBeInTheDocument()
    expect(within(row).getByText(/150/)).toBeInTheDocument()
  })

  it('shows Edit/Export/Delete actions for ADMIN', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedExportClientData.mockResolvedValue(makeExport())
    mockedListStaff.mockResolvedValue([master])

    renderPage()

    expect(await screen.findByRole('button', { name: /редактировать/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /скачать json/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /удалить данные клиента/i })).toBeInTheDocument()
  })

  it('hides GDPR actions and shows only redacted payment fact for MASTER (read-only)', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: masterUser, login: vi.fn(), logout: vi.fn() })
    mockedExportClientData.mockResolvedValue(
      makeExport({
        bookings: [
          {
            id: 'booking-1',
            masterId: 'master-1',
            serviceId: 'service-1',
            serviceName: 'Massage',
            startTime: '2026-03-10T10:00:00.000Z',
            endTime: '2026-03-10T11:00:00.000Z',
            status: 'COMPLETED',
            source: 'ADMIN',
            payment: { id: 'payment-1', bookingId: 'booking-1', paidAt: '2026-03-10T11:05:00.000Z' },
          },
        ],
      }),
    )

    renderPage()

    await screen.findByRole('heading', { name: 'Anna Kowalska' })
    expect(screen.queryByRole('button', { name: /редактировать/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /скачать json/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /удалить данные клиента/i })).not.toBeInTheDocument()
    expect(mockedListStaff).not.toHaveBeenCalled()

    const row = screen.getByText('Massage').closest('li')!
    expect(within(row).getByText('Вы')).toBeInTheDocument()
    expect(within(row).queryByText(/150/)).not.toBeInTheDocument()
  })

  it('shows a not-found message when the client cannot be loaded (out of scope / 404)', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedExportClientData.mockRejectedValue(mockAxiosError(404, 'Client not found'))

    renderPage()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /к списку клиентов/i })).toBeInTheDocument()
  })

  it('saves edits through the edit modal and reloads the card', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedExportClientData.mockResolvedValue(makeExport())
    mockedListStaff.mockResolvedValue([master])
    mockedUpdateClient.mockResolvedValue(makeExport().client)

    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Anna Kowalska' })

    await user.click(screen.getByRole('button', { name: /редактировать/i }))
    await user.clear(screen.getByLabelText(/^имя$/i))
    await user.type(screen.getByLabelText(/^имя$/i), 'Anna Nowak')
    await user.click(screen.getByRole('button', { name: /сохранить/i }))

    expect(mockedUpdateClient).toHaveBeenCalledWith(
      'client-1',
      expect.objectContaining({ name: 'Anna Nowak' }),
    )
    // Modal closes and the (mocked) reload fires again
    expect(mockedExportClientData).toHaveBeenCalledTimes(2)
  })

  it('downloads the export payload as JSON when "Скачать JSON" is clicked', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    const exportData = makeExport()
    mockedExportClientData.mockResolvedValue(exportData)
    mockedListStaff.mockResolvedValue([master])

    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    const revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Anna Kowalska' })

    await user.click(screen.getByRole('button', { name: /скачать json/i }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

    clickSpy.mockRestore()
  })

  it('erases the client after confirmation and navigates back to the list', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedExportClientData.mockResolvedValue(makeExport())
    mockedListStaff.mockResolvedValue([master])
    mockedEraseClientData.mockResolvedValue({
      clientId: 'client-1',
      status: 'processed',
      processedAt: '2026-03-20T00:00:00.000Z',
    })

    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Anna Kowalska' })

    await user.click(screen.getByRole('button', { name: /удалить данные клиента/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^удалить$/i }))

    expect(mockedEraseClientData).toHaveBeenCalledWith('client-1')
    expect(await screen.findByText('Client list')).toBeInTheDocument()
  })

  it('shows a friendly error and keeps the card when erasure is rejected (already erased)', async () => {
    mockedUseAuth.mockReturnValue({ status: 'authenticated', user: adminUser, login: vi.fn(), logout: vi.fn() })
    mockedExportClientData.mockResolvedValue(makeExport())
    mockedListStaff.mockResolvedValue([master])
    mockedEraseClientData.mockRejectedValue(mockAxiosError(409, 'Client data has already been erased'))

    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Anna Kowalska' })

    await user.click(screen.getByRole('button', { name: /удалить данные клиента/i }))
    await user.click(screen.getByRole('button', { name: /^удалить$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/уже были удалены/i)
    expect(screen.getByRole('heading', { name: 'Anna Kowalska' })).toBeInTheDocument()
  })
})
