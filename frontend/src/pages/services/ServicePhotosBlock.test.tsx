import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { ServicePhotosBlock } from './ServicePhotosBlock'
import {
  addServicePhoto,
  deleteServicePhoto,
  listServicePhotos,
  reorderServicePhotos,
} from '../../api/services'
import { compressServicePhoto } from './servicePhotos'
import type { ServicePhoto } from '../../types/service'

vi.mock('../../api/services', () => ({
  listServicePhotos: vi.fn(),
  addServicePhoto: vi.fn(),
  reorderServicePhotos: vi.fn(),
  deleteServicePhoto: vi.fn(),
}))

// compressServicePhoto draws through canvas/Image, which jsdom doesn't implement — mocked; the pure
// helpers (moveItem, dataUrlByteLength, sizing) are covered in servicePhotos.test.ts.
vi.mock('./servicePhotos', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./servicePhotos')>()
  return { ...actual, compressServicePhoto: vi.fn() }
})

const mockedList = vi.mocked(listServicePhotos)
const mockedAdd = vi.mocked(addServicePhoto)
const mockedReorder = vi.mocked(reorderServicePhotos)
const mockedDelete = vi.mocked(deleteServicePhoto)
const mockedCompress = vi.mocked(compressServicePhoto)

function photo(n: number): ServicePhoto {
  return { id: `p${n}`, position: n - 1, image: `data:image/jpeg;base64,img${n}` }
}

function makeFile(type = 'image/png'): File {
  return new File(['content'], 'photo.png', { type })
}

function serverError(status: number, message: string): AxiosError {
  const error = new AxiosError('failed')
  error.response = {
    status,
    data: { message },
    statusText: '',
    headers: {},
    config: {} as never,
  }
  return error
}

describe('ServicePhotosBlock', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows thumbnails, marks the first one as cover and shows the counter', async () => {
    mockedList.mockResolvedValue([photo(1), photo(2)])
    render(<ServicePhotosBlock serviceId="s1" />)

    expect(await screen.findByRole('img', { name: 'Фото 1' })).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,img1',
    )
    expect(screen.getByRole('img', { name: 'Фото 2' })).toBeInTheDocument()
    expect(screen.getAllByText('Обложка')).toHaveLength(1)
    expect(screen.getByText('Фото (2/5)')).toBeInTheDocument()
    expect(mockedList).toHaveBeenCalledWith('s1')
  })

  it('compresses and uploads a chosen file, then shows it', async () => {
    mockedList.mockResolvedValue([])
    mockedCompress.mockResolvedValue('data:image/jpeg;base64,small')
    mockedAdd.mockResolvedValue(photo(1))
    const user = userEvent.setup()
    render(<ServicePhotosBlock serviceId="s1" />)

    await user.upload(await screen.findByLabelText('+ Добавить'), makeFile())

    await waitFor(() => expect(screen.getByRole('img', { name: 'Фото 1' })).toBeInTheDocument())
    expect(mockedAdd).toHaveBeenCalledWith('s1', 'data:image/jpeg;base64,small')
  })

  it('hides "+ Добавить" at five photos, so a sixth cannot be added', async () => {
    mockedList.mockResolvedValue([1, 2, 3, 4, 5].map(photo))
    render(<ServicePhotosBlock serviceId="s1" />)

    expect(await screen.findByText('Максимум 5 фото')).toBeInTheDocument()
    expect(screen.queryByLabelText('+ Добавить')).not.toBeInTheDocument()
  })

  it('rejects an unsupported file type without compressing or uploading', async () => {
    mockedList.mockResolvedValue([])
    const user = userEvent.setup({ applyAccept: false })
    render(<ServicePhotosBlock serviceId="s1" />)

    await user.upload(await screen.findByLabelText('+ Добавить'), makeFile('image/gif'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Поддерживаются форматы JPEG, PNG, WebP',
    )
    expect(mockedCompress).not.toHaveBeenCalled()
    expect(mockedAdd).not.toHaveBeenCalled()
  })

  it('rejects a file that is still above 1 MB after compression', async () => {
    mockedList.mockResolvedValue([])
    // ~1.5 MB decoded
    mockedCompress.mockResolvedValue(`data:image/jpeg;base64,${'A'.repeat(2_100_000)}`)
    const user = userEvent.setup()
    render(<ServicePhotosBlock serviceId="s1" />)

    await user.upload(await screen.findByLabelText('+ Добавить'), makeFile())

    expect(await screen.findByRole('alert')).toHaveTextContent('Фото больше 1 МБ')
    expect(mockedAdd).not.toHaveBeenCalled()
  })

  it('shows the server error message on a failed upload', async () => {
    mockedList.mockResolvedValue([])
    mockedCompress.mockResolvedValue('data:image/jpeg;base64,small')
    mockedAdd.mockRejectedValue(
      serverError(400, 'Unsupported image format: only JPEG, PNG and WebP are allowed'),
    )
    const user = userEvent.setup()
    render(<ServicePhotosBlock serviceId="s1" />)

    await user.upload(await screen.findByLabelText('+ Добавить'), makeFile())

    expect(await screen.findByRole('alert')).toHaveTextContent('Unsupported image format')
  })

  it('moves a photo with the arrows and sends the new order', async () => {
    mockedList.mockResolvedValue([photo(1), photo(2), photo(3)])
    mockedReorder.mockResolvedValue([
      { ...photo(2), position: 0 },
      { ...photo(1), position: 1 },
      photo(3),
    ])
    const user = userEvent.setup()
    render(<ServicePhotosBlock serviceId="s1" />)

    await user.click(await screen.findByRole('button', { name: 'Сдвинуть фото 1 вправо' }))

    await waitFor(() => expect(mockedReorder).toHaveBeenCalledWith('s1', ['p2', 'p1', 'p3']))
    // «Обложкой» стало бывшее второе фото
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'Фото 1' })).toHaveAttribute(
        'src',
        'data:image/jpeg;base64,img2',
      ),
    )
  })

  it('disables ← on the first photo and → on the last one', async () => {
    mockedList.mockResolvedValue([photo(1), photo(2)])
    render(<ServicePhotosBlock serviceId="s1" />)

    expect(await screen.findByRole('button', { name: 'Сдвинуть фото 1 влево' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Сдвинуть фото 2 вправо' })).toBeDisabled()
  })

  it('reorders by drag and drop', async () => {
    mockedList.mockResolvedValue([photo(1), photo(2), photo(3)])
    mockedReorder.mockResolvedValue([photo(2), photo(3), photo(1)])
    render(<ServicePhotosBlock serviceId="s1" />)

    const first = (await screen.findByRole('img', { name: 'Фото 1' })).closest('li')!
    const third = screen.getByRole('img', { name: 'Фото 3' }).closest('li')!
    fireEvent.dragStart(first)
    fireEvent.drop(third)

    await waitFor(() => expect(mockedReorder).toHaveBeenCalledWith('s1', ['p2', 'p3', 'p1']))
  })

  it('rolls the order back and shows the error when reordering fails', async () => {
    mockedList.mockResolvedValue([photo(1), photo(2)])
    mockedReorder.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    render(<ServicePhotosBlock serviceId="s1" />)

    await user.click(await screen.findByRole('button', { name: 'Сдвинуть фото 1 вправо' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось изменить порядок фото')
    expect(screen.getByRole('img', { name: 'Фото 1' })).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,img1',
    )
  })

  it('asks for confirmation before deleting, and does not delete on cancel', async () => {
    mockedList.mockResolvedValue([photo(1), photo(2)])
    const user = userEvent.setup()
    render(<ServicePhotosBlock serviceId="s1" />)

    await user.click(await screen.findByRole('button', { name: 'Удалить фото 2' }))
    const dialog = screen.getByRole('dialog', { name: 'Удалить фото' })
    await user.click(within(dialog).getByRole('button', { name: 'Отмена' }))

    expect(mockedDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Фото 2' })).toBeInTheDocument()
  })

  it('deletes a photo after confirmation', async () => {
    mockedList.mockResolvedValue([photo(1), photo(2)])
    mockedDelete.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<ServicePhotosBlock serviceId="s1" />)

    await user.click(await screen.findByRole('button', { name: 'Удалить фото 2' }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Удалить фото' })).getByRole('button', {
        name: 'Удалить',
      }),
    )

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('s1', 'p2'))
    await waitFor(() =>
      expect(screen.queryByRole('img', { name: 'Фото 2' })).not.toBeInTheDocument(),
    )
  })

  it('shows an error when the photo list cannot be loaded', async () => {
    mockedList.mockRejectedValue(new Error('boom'))
    render(<ServicePhotosBlock serviceId="s1" />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить фото')
  })
})
