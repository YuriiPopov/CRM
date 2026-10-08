import sharp from 'sharp';
import { ArticleException } from './article-errors';

// Длинная сторона после пережатия и качество JPEG (item89)
export const ARTICLE_IMAGE_MAX_SIDE = 1200;
export const ARTICLE_IMAGE_JPEG_QUALITY = 80;
// Защита от «бомб»: картинка 20000×20000 в сжатом PNG весит килобайты, а в памяти — гигабайт
const MAX_INPUT_PIXELS = 60_000_000;

// Растровые форматы, которые умеет читать sharp. SVG намеренно нет: это XML со скриптами и внешними ссылками.
const DATA_IMAGE_RE =
  /^data:image\/(png|jpe?g|webp|gif|avif|tiff?|bmp);base64,([a-z0-9+/=\s]+)$/i;

export function isRasterDataImage(value: string): boolean {
  return DATA_IMAGE_RE.test(value.trim());
}

// Любой data:image/* — в том числе svg/heic, которые мы не принимаем
export function isDataImage(value: string): boolean {
  return /^data:image\//i.test(value.trim());
}

// data:image/*;base64,… → JPEG q80, длинная сторона ≤ 1200 px. PNG/WebP/GIF/TIFF конвертируются;
// прозрачность заливается белым (JPEG её не умеет), EXIF-поворот применяется.
export async function recompressDataImage(dataUri: string): Promise<string> {
  const match = DATA_IMAGE_RE.exec(dataUri.trim());
  if (!match) {
    throw new ArticleException(
      'ARTICLE_IMAGE_INVALID',
      'Article contains an unsupported inline image (only PNG, JPEG, WebP, GIF, AVIF, TIFF are allowed)',
    );
  }
  try {
    const input = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
    const output = await sharp(input, {
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: 'error',
    })
      .rotate()
      .resize({
        width: ARTICLE_IMAGE_MAX_SIDE,
        height: ARTICLE_IMAGE_MAX_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: ARTICLE_IMAGE_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${output.toString('base64')}`;
  } catch {
    throw new ArticleException(
      'ARTICLE_IMAGE_INVALID',
      'Article contains an inline image that could not be decoded or is too large',
    );
  }
}
