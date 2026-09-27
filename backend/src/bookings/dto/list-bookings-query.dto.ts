import { BookingSource, BookingStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

// Необязательные фильтры GET /bookings (item61) — без параметров ответ прежний (все записи
// в скоупе роли), так что веб-CRM и приложение мастера продолжают работать без изменений.
export class ListBookingsQueryDto {
  @IsOptional()
  @IsEnum(BookingSource)
  source?: BookingSource;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  // Нижняя граница по startTime (включительно)
  @IsOptional()
  @IsDateString()
  from?: string;
}
