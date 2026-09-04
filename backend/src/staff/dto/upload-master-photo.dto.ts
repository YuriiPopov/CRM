import { IsString, Matches } from 'class-validator';

// Разрешены только JPEG/PNG/WebP (см. ТЗ item41) — формат кодируется прямо в data URL,
// отдельного поля mimeType не заводим, чтобы не хранить и не синхронизировать его отдельно.
export const MASTER_PHOTO_DATA_URL_PATTERN =
  /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

export class UploadMasterPhotoDto {
  @IsString()
  @Matches(MASTER_PHOTO_DATA_URL_PATTERN, {
    message:
      'photo must be a base64 data URL with image/jpeg, image/png or image/webp mime type',
  })
  photo!: string;
}
