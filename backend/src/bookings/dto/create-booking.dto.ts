import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  clientId!: string;

  // Обязателен для ADMIN (выбирает мастера); MASTER бронирует только на себя —
  // если указан и не совпадает с собственным профилем, запрос отклоняется (см. BookingsService)
  @IsOptional()
  @IsUUID()
  masterId?: string;

  @IsUUID()
  serviceId!: string;

  @IsDateString()
  startTime!: string;
}
