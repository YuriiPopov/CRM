export const ALLOWED_MASTER_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export const MASTER_PHOTO_MAX_DIMENSION = 400
const JPEG_QUALITY = 0.85

export function isAllowedMasterPhotoType(type: string): boolean {
  return (ALLOWED_MASTER_PHOTO_TYPES as readonly string[]).includes(type)
}

// Чистая функция без побочных эффектов — вычисляет размер картинки после ресайза с сохранением
// пропорций, не превышая maxDimension по большей стороне. Тестируется отдельно от
// resizeImageFile(), которая зависит от Image/canvas и не работает в jsdom без их эмуляции.
export function computeResizedDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height }
  }

  const scale = maxDimension / Math.max(width, height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

// Ресайзит фото мастера на canvas до MASTER_PHOTO_MAX_DIMENSION по большей стороне и всегда
// перекодирует в JPEG — так итоговый base64 укладывается в серверный лимит (см. MAX_PHOTO_BYTES
// в backend/src/staff/staff.service.ts) независимо от формата исходника: PNG/WebP без lossy-
// сжатия для фотографии часто крупнее эквивалентного JPEG (item41).
export async function resizeImageFile(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const { width, height } = computeResizedDimensions(
      image.naturalWidth,
      image.naturalHeight,
      MASTER_PHOTO_MAX_DIMENSION,
    )

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context is not available')
    }
    ctx.drawImage(image, 0, 0, width, height)

    return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
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
