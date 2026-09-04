import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditMasterModal } from './EditMasterModal'
import { updateMaster } from '../../api/staff'
import { listServiceCategories } from '../../api/serviceCategories'
import type { Master } from '../../types/staff'
import type { ServiceCategoryRef } from '../../types/service'

vi.mock('../../api/staff', () => ({ updateMaster: vi.fn() }))
vi.mock('../../api/serviceCategories', () => ({ listServiceCategories: vi.fn() }))

const mockedUpdateMaster = vi.mocked(updateMaster)
const mockedListServiceCategories = vi.mocked(listServiceCategories)

const categories: ServiceCategoryRef[] = [
  {
    id: 'category-spa',
    salonId: 'salon-1',
    name: 'СПА',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'category-massage',
    salonId: 'salon-1',
    name: 'Массаж',
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

const master: Master = {
  id: 'master-1',
  salonId: 'salon-1',
  name: 'Anna Kowalska',
  specializationCategoryIds: ['category-spa'],
  isActive: true,
  photo: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('EditMasterModal', () => {
  beforeEach(() => {
    mockedListServiceCategories.mockResolvedValue(categories)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('seeds checkboxes from the master current specializations', async () => {
    render(<EditMasterModal master={master} onClose={vi.fn()} onUpdated={vi.fn()} />)

    expect(await screen.findByLabelText('СПА')).toBeChecked()
    expect(screen.getByLabelText('Массаж')).not.toBeChecked()
  })

  it('toggling and submitting sends the updated specialization array', async () => {
    mockedUpdateMaster.mockResolvedValue({
      ...master,
      specializationCategoryIds: ['category-spa', 'category-massage'],
    })

    const onUpdated = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<EditMasterModal master={master} onClose={onClose} onUpdated={onUpdated} />)

    await user.click(await screen.findByLabelText('Массаж'))
    await user.click(screen.getByRole('button', { name: /сохранить/i }))

    expect(mockedUpdateMaster).toHaveBeenCalledWith('master-1', {
      name: 'Anna Kowalska',
      specializationCategoryIds: ['category-spa', 'category-massage'],
      isActive: true,
    })
    expect(onUpdated).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('disables submit when every specialization is unchecked', async () => {
    const user = userEvent.setup()
    render(<EditMasterModal master={master} onClose={vi.fn()} onUpdated={vi.fn()} />)

    await user.click(await screen.findByLabelText('СПА'))

    expect(screen.getByRole('button', { name: /сохранить/i })).toBeDisabled()
  })
})
