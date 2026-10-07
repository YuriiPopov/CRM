import { computeResizedDimensions, isAllowedMasterPhotoType } from '../staff/masterPhoto'

export const MAX_SERVICE_PHOTOS = 5
export const SERVICE_PHOTO_MAX_DIMENSION = 1600
export const SERVICE_PHOTO_JPEG_QUALITY = 0.85
// Серверный лимит на декодированные байты (backend ServicePhotosService)
export const SERVICE_PHOTO_MAX_BYTES = 1024 * 1024

export const isAllowedServicePhotoType = isAllowedMasterPhotoType

// Размер картинки после декодирования base64 — по длине data URL, без самого декодирования
export function dataUrlByteLength(dataUrl: string): number {
  const payload = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
  return Math.floor((payload.length * 3) / 4) - padding
}

// Новый порядок id после переноса элемента с позиции from на to (стрелки ←/→ и drag&drop)
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items]
  }
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

// Сжимает фото на canvas до 1600 px по длинной стороне и всегда перекодирует в JPEG (~0.85),
// чтобы уложиться в серверный лимит 1 МБ независимо от формата исходника. Зависит от Image/canvas,
// которых нет в jsdom, — чистые части (размеры, лимиты) вынесены в функции выше и тестируются отдельно.
export async function compressServicePhoto(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const { width, height } = computeResizedDimensions(
      image.naturalWidth,
      image.naturalHeight,
      SERVICE_PHOTO_MAX_DIMENSION,
    )

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context is not available')
    }
    // Прозрачность PNG/WebP в JPEG стала бы чёрной — подкладываем белый фон
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)

    return canvas.toDataURL('image/jpeg', SERVICE_PHOTO_JPEG_QUALITY)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load image'))
    image.src = src
  })
}
