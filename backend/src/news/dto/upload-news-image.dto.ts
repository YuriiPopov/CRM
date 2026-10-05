import { IsString, Matches } from 'class-validator';
import { MASTER_PHOTO_DATA_URL_PATTERN } from '../../staff/dto/upload-master-photo.dto';

// Тот же формат, что у фото мастера (item41): base64 data URL, только JPEG/PNG/WebP
export class UploadNewsImageDto {
  @IsString()
  @Matches(MASTER_PHOTO_DATA_URL_PATTERN, {
    message:
      'image must be a base64 data URL with image/jpeg, image/png or image/webp mime type',
  })
  image!: string;
}
