import { BookingSource, BookingStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

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

  // История визитов клиента (item73, карточка клиента в приложении администратора)
  @IsOptional()
  @IsUUID()
  clientId?: string;

  // ADMIN — записи одного мастера; у MASTER скоуп и так ограничен своим masterId, и этот
  // параметр его не расширяет (см. BookingsService.findAll)
  @IsOptional()
  @IsUUID()
  masterId?: string;
}
