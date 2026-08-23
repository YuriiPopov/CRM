import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateMasterBlockDto {
  // Обязателен для ADMIN (блокирует любого мастера салона); MASTER блокирует только себя —
  // если указан и не совпадает с собственным профилем, запрос отклоняется (см. MasterBlocksService,
  // тот же приём, что и masterId в CreateBookingDto).
  @IsOptional()
  @IsUUID()
  masterId?: string;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
