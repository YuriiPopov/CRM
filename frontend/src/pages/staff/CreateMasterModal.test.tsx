import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateMasterModal } from './CreateMasterModal'
import { createMaster } from '../../api/staff'
import { registerUser } from '../../api/auth'
import { listServiceCategories } from '../../api/serviceCategories'
import type { Master } from '../../types/staff'
import type { ServiceCategoryRef } from '../../types/service'

vi.mock('../../api/staff', () => ({ createMaster: vi.fn() }))
vi.mock('../../api/auth', () => ({ registerUser: vi.fn() }))
vi.mock('../../api/serviceCategories', () => ({ listServiceCategories: vi.fn() }))

const mockedCreateMaster = vi.mocked(createMaster)
const mockedRegisterUser = vi.mocked(registerUser)
const mockedListServiceCategories = vi.mocked(listServiceCategories)

const categories: ServiceCategoryRef[] = [
  {
    id: 'category-spa',
    salonId: 'salon-1',
    name: 'СПА',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

const createdMaster: Master = {
  id: 'master-new',
  salonId: 'salon-1',
  name: 'Anna Kowalska',
  specializationCategoryIds: ['category-spa'],
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

function mockAxiosError(status: number, message: string) {
  return { isAxiosError: true, response: { status, data: { message } } }
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^имя$/i), 'Anna Kowalska')
  await user.click(await screen.findByLabelText('СПА'))
  await user.type(screen.getByLabelText(/email/i), 'anna@b4u.local')
  await user.type(screen.getByLabelText(/пароль/i), 'SecurePass123')
}

describe('CreateMasterModal', () => {
  beforeEach(() => {
    mockedListServiceCategories.mockResolvedValue(categories)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('creates the master, then registers a MASTER login for them, in that order', async () => {
    mockedCreateMaster.mockResolvedValue(createdMaster)
    mockedRegisterUser.mockResolvedValue({
      id: 'user-1',
      email: 'anna@b4u.local',
      role: 'MASTER',
      salonId: 'salon-1',
      masterId: 'master-new',
    })

    const onCreated = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<CreateMasterModal onClose={onClose} onCreated={onCreated} />)

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /создать мастера/i }))

    expect(mockedCreateMaster).toHaveBeenCalledWith({
      name: 'Anna Kowalska',
      specializationCategoryIds: ['category-spa'],
    })
    expect(mockedRegisterUser).toHaveBeenCalledWith({
      email: 'anna@b4u.local',
      password: 'SecurePass123',
      role: 'MASTER',
      masterId: 'master-new',
    })
    // Master creation must resolve before the login is requested, not fired in parallel
    expect(mockedCreateMaster.mock.invocationCallOrder[0]).toBeLessThan(
      mockedRegisterUser.mock.invocationCallOrder[0],
    )

    expect(onCreated).toHaveBeenCalledWith(createdMaster)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not call POST /staff a second time when only the login step failed and is retried', async () => {
    mockedCreateMaster.mockResolvedValue(createdMaster)
    mockedRegisterUser.mockRejectedValueOnce(mockAxiosError(409, 'User with this email already exists'))
    mockedRegisterUser.mockResolvedValueOnce({
      id: 'user-1',
      email: 'anna2@b4u.local',
      role: 'MASTER',
      salonId: 'salon-1',
      masterId: 'master-new',
    })

    const onCreated = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<CreateMasterModal onClose={onClose} onCreated={onCreated} />)

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /создать мастера/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/уже существует/i)
    // The master was already created — the modal must say so and keep it open, not the form
    expect(screen.getByText(/мастер «anna kowalska» уже создан/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^имя$/i)).toBeDisabled()
    expect(screen.getByLabelText('СПА')).toBeDisabled()
    expect(onClose).not.toHaveBeenCalled()

    // Fix the email and retry — only the login step should be re-sent
    const emailInput = screen.getByLabelText(/email/i)
    await user.clear(emailInput)
    await user.type(emailInput, 'anna2@b4u.local')
    await user.click(screen.getByRole('button', { name: /создать логин/i }))

    expect(mockedCreateMaster).toHaveBeenCalledTimes(1)
    expect(mockedRegisterUser).toHaveBeenCalledTimes(2)
    expect(mockedRegisterUser).toHaveBeenNthCalledWith(2, {
      email: 'anna2@b4u.local',
      password: 'SecurePass123',
      role: 'MASTER',
      masterId: 'master-new',
    })
    expect(onCreated).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows an error and never attempts to register a login when creating the master itself fails', async () => {
    mockedCreateMaster.mockRejectedValue(new Error('network error'))

    const onCreated = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<CreateMasterModal onClose={onClose} onCreated={onCreated} />)

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /создать мастера/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/не удалось создать мастера/i)
    expect(mockedRegisterUser).not.toHaveBeenCalled()
    expect(onCreated).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^имя$/i)).not.toBeDisabled()
  })

  it('disables submit until name, a specialization, email, and an 8+ character password are all filled in', async () => {
    const user = userEvent.setup()
    render(<CreateMasterModal onClose={vi.fn()} onCreated={vi.fn()} />)

    const submitButton = screen.getByRole('button', { name: /создать мастера/i })
    expect(submitButton).toBeDisabled()

    await user.type(screen.getByLabelText(/^имя$/i), 'Anna')
    await user.type(screen.getByLabelText(/email/i), 'anna@b4u.local')
    await user.type(screen.getByLabelText(/пароль/i), 'short')
    expect(submitButton).toBeDisabled()

    await user.type(screen.getByLabelText(/пароль/i), '1234')
    expect(submitButton).toBeDisabled()

    await user.click(await screen.findByLabelText('СПА'))
    expect(submitButton).toBeEnabled()
  })
})
