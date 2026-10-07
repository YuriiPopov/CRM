import { IsString, Matches, MaxLength } from 'class-validator';

// Чистый base64 либо data URL (`data:image/jpeg;base64,...`). Объявленный в data URL mime
// игнорируется — формат определяется по сигнатуре байтов (ServicePhotosService.detectImageType).
export const SERVICE_PHOTO_BASE64_PATTERN =
  /^(?:data:[\w.+/-]+;base64,)?[A-Za-z0-9+/\s]+=*\s*$/;

// Запас над 1 МБ декодированных байт (~1.4 МБ base64): отсекает заведомо огромные строки до декодирования
export const SERVICE_PHOTO_MAX_BASE64_CHARS = 2_000_000;

export class UploadServicePhotoDto {
  @IsString()
  @MaxLength(SERVICE_PHOTO_MAX_BASE64_CHARS, {
    message: 'image must not exceed 1MB',
  })
  @Matches(SERVICE_PHOTO_BASE64_PATTERN, {
    message: 'image must be a base64-encoded JPEG, PNG or WebP image',
  })
  image!: string;
}
