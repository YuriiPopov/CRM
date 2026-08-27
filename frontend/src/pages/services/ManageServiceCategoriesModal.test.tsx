import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ManageServiceCategoriesModal } from './ManageServiceCategoriesModal'
import {
  createServiceCategory,
  deleteServiceCategory,
  listServiceCategories,
  updateServiceCategory,
} from '../../api/serviceCategories'
import type { ServiceCategoryRef } from '../../types/service'

vi.mock('../../api/serviceCategories', () => ({
  listServiceCategories: vi.fn(),
  createServiceCategory: vi.fn(),
  updateServiceCategory: vi.fn(),
  deleteServiceCategory: vi.fn(),
}))

const mockedListServiceCategories = vi.mocked(listServiceCategories)
const mockedCreateServiceCategory = vi.mocked(createServiceCategory)
const mockedUpdateServiceCategory = vi.mocked(updateServiceCategory)
const mockedDeleteServiceCategory = vi.mocked(deleteServiceCategory)

const defaultCategory: ServiceCategoryRef = {
  id: 'category-manicure',
  salonId: 'salon-1',
  name: 'Маникюр/педикюр',
  isDefault: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const spaCategory: ServiceCategoryRef = {
  id: 'category-spa',
  salonId: 'salon-1',
  name: 'СПА',
  isDefault: false,
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('ManageServiceCategoriesModal', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the fetched category list', async () => {
    mockedListServiceCategories.mockResolvedValue([defaultCategory, spaCategory])

    render(<ManageServiceCategoriesModal onClose={vi.fn()} onChanged={vi.fn()} />)

    expect(await screen.findByText('Маникюр/педикюр')).toBeInTheDocument()
    expect(screen.getByText('СПА')).toBeInTheDocument()
    expect(screen.getByText('По умолчанию')).toBeInTheDocument()
  })

  it('creates a new category via the inline form', async () => {
    mockedListServiceCategories.mockResolvedValue([defaultCategory])
    mockedCreateServiceCategory.mockResolvedValue({
      id: 'category-new',
      salonId: 'salon-1',
      name: 'Брови',
      isDefault: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    const user = userEvent.setup()
    render(<ManageServiceCategoriesModal onClose={vi.fn()} onChanged={vi.fn()} />)
    await screen.findByText('Маникюр/педикюр')

    await user.type(screen.getByLabelText(/новая категория/i), 'Брови')
    await user.click(screen.getByRole('button', { name: /добавить/i }))

    expect(mockedCreateServiceCategory).toHaveBeenCalledWith({ name: 'Брови' })
  })

  it('renames a category', async () => {
    mockedListServiceCategories.mockResolvedValue([spaCategory])
    mockedUpdateServiceCategory.mockResolvedValue({ ...spaCategory, name: 'СПА-услуги' })

    const user = userEvent.setup()
    render(<ManageServiceCategoriesModal onClose={vi.fn()} onChanged={vi.fn()} />)
    const item = (await screen.findByText('СПА')).closest('li')!

    await user.click(within(item).getByRole('button', { name: /переименовать/i }))
    const input = within(item).getByLabelText(/название категории/i)
    await user.clear(input)
    await user.type(input, 'СПА-услуги')
    await user.click(within(item).getByRole('button', { name: /сохранить/i }))

    expect(mockedUpdateServiceCategory).toHaveBeenCalledWith('category-spa', { name: 'СПА-услуги' })
  })

  it('promotes a non-default category to default', async () => {
    mockedListServiceCategories.mockResolvedValue([defaultCategory, spaCategory])
    mockedUpdateServiceCategory.mockResolvedValue({ ...spaCategory, isDefault: true })

    const user = userEvent.setup()
    render(<ManageServiceCategoriesModal onClose={vi.fn()} onChanged={vi.fn()} />)
    const item = (await screen.findByText('СПА')).closest('li')!

    await user.click(within(item).getByRole('button', { name: /сделать дефолтной/i }))

    expect(mockedUpdateServiceCategory).toHaveBeenCalledWith('category-spa', { isDefault: true })
  })

  it('hides the default-promote and delete actions for the current default category', async () => {
    mockedListServiceCategories.mockResolvedValue([defaultCategory])

    render(<ManageServiceCategoriesModal onClose={vi.fn()} onChanged={vi.fn()} />)
    const item = (await screen.findByText('Маникюр/педикюр')).closest('li')!

    expect(within(item).queryByRole('button', { name: /сделать дефолтной/i })).not.toBeInTheDocument()
    expect(within(item).queryByRole('button', { name: /удалить/i })).not.toBeInTheDocument()
  })

  it('deletes a category after confirmation', async () => {
    mockedListServiceCategories.mockResolvedValue([defaultCategory, spaCategory])
    mockedDeleteServiceCategory.mockResolvedValue(undefined)

    const user = userEvent.setup()
    render(<ManageServiceCategoriesModal onClose={vi.fn()} onChanged={vi.fn()} />)
    const item = (await screen.findByText('СПА')).closest('li')!

    await user.click(within(item).getByRole('button', { name: /удалить/i }))
    const dialog = await screen.findByRole('dialog', { name: /удаление категории/i })
    await user.click(within(dialog).getByRole('button', { name: /^удалить$/i }))

    expect(mockedDeleteServiceCategory).toHaveBeenCalledWith('category-spa')
  })
})
