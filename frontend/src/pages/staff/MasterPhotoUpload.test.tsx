import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MasterPhotoUpload } from './MasterPhotoUpload'
import { removeMasterPhoto, uploadMasterPhoto } from '../../api/staff'
import { resizeImageFile } from './masterPhoto'
import type { MasterDetail } from '../../types/staff'

vi.mock('../../api/staff', () => ({
  uploadMasterPhoto: vi.fn(),
  removeMasterPhoto: vi.fn(),
}))

// resizeImageFile draws through canvas/Image, which jsdom doesn't implement — mocked here so the
// component test stays focused on upload/remove wiring, not browser image decoding. Pure helpers
// (computeResizedDimensions, isAllowedMasterPhotoType) are covered directly in masterPhoto.test.ts.
vi.mock('./masterPhoto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./masterPhoto')>()
  return { ...actual, resizeImageFile: vi.fn() }
})

const mockedUploadMasterPhoto = vi.mocked(uploadMasterPhoto)
const mockedRemoveMasterPhoto = vi.mocked(removeMasterPhoto)
const mockedResizeImageFile = vi.mocked(resizeImageFile)

const masterWithoutPhoto: MasterDetail = {
  id: 'master-1',
  salonId: 'salon-1',
  name: 'Anna Kowalska',
  specializationCategoryIds: ['category-spa'],
  isActive: true,
  photo: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  services: [],
}

const masterWithPhoto: MasterDetail = {
  ...masterWithoutPhoto,
  photo: 'data:image/jpeg;base64,existing',
}

function makeFile(type: string): File {
  return new File(['content'], 'photo.png', { type })
}

describe('MasterPhotoUpload', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows a placeholder and "Загрузить фото" when there is no photo yet', () => {
    render(<MasterPhotoUpload master={masterWithoutPhoto} onChanged={vi.fn()} />)

    expect(screen.getByText('Нет фото')).toBeInTheDocument()
    expect(screen.getByLabelText('Загрузить фото')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Удалить фото' })).not.toBeInTheDocument()
  })

  it('shows the photo and "Заменить фото" plus a remove button when a photo exists', () => {
    render(<MasterPhotoUpload master={masterWithPhoto} onChanged={vi.fn()} />)

    expect(screen.getByRole('img', { name: masterWithPhoto.name })).toHaveAttribute(
      'src',
      masterWithPhoto.photo,
    )
    expect(screen.getByLabelText('Заменить фото')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Удалить фото' })).toBeInTheDocument()
  })

  it('rejects a disallowed file type without resizing or uploading', async () => {
    // applyAccept: false — the browser's own accept="image/jpeg,image/png,image/webp" filter
    // would otherwise silently swallow the file before it reaches our onChange handler, so this
    // bypasses it to exercise the component's own validation (a defense a real OS file picker
    // can still route around, e.g. via "All files").
    const user = userEvent.setup({ applyAccept: false })
    render(<MasterPhotoUpload master={masterWithoutPhoto} onChanged={vi.fn()} />)

    await user.upload(screen.getByLabelText('Загрузить фото'), makeFile('image/gif'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Поддерживаются форматы JPEG, PNG, WebP',
    )
    expect(mockedResizeImageFile).not.toHaveBeenCalled()
    expect(mockedUploadMasterPhoto).not.toHaveBeenCalled()
  })

  it('resizes and uploads a valid file, then notifies the parent', async () => {
    const onChanged = vi.fn()
    mockedResizeImageFile.mockResolvedValue('data:image/jpeg;base64,resized')
    mockedUploadMasterPhoto.mockResolvedValue(masterWithPhoto)
    const user = userEvent.setup()
    render(<MasterPhotoUpload master={masterWithoutPhoto} onChanged={onChanged} />)

    await user.upload(screen.getByLabelText('Загрузить фото'), makeFile('image/png'))

    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(mockedUploadMasterPhoto).toHaveBeenCalledWith(
      'master-1',
      'data:image/jpeg;base64,resized',
    )
  })

  it('shows an error and does not notify the parent when the upload fails', async () => {
    mockedResizeImageFile.mockResolvedValue('data:image/jpeg;base64,resized')
    mockedUploadMasterPhoto.mockRejectedValue(new Error('boom'))
    const onChanged = vi.fn()
    const user = userEvent.setup()
    render(<MasterPhotoUpload master={masterWithoutPhoto} onChanged={onChanged} />)

    await user.upload(screen.getByLabelText('Загрузить фото'), makeFile('image/png'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить фото')
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('removes the photo and notifies the parent', async () => {
    const onChanged = vi.fn()
    mockedRemoveMasterPhoto.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<MasterPhotoUpload master={masterWithPhoto} onChanged={onChanged} />)

    await user.click(screen.getByRole('button', { name: 'Удалить фото' }))

    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(mockedRemoveMasterPhoto).toHaveBeenCalledWith('master-1')
  })

  it('shows an error when removing the photo fails', async () => {
    mockedRemoveMasterPhoto.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    render(<MasterPhotoUpload master={masterWithPhoto} onChanged={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Удалить фото' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось удалить фото')
  })
})
