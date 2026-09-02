import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class MasterScheduleDayDto {
  // YYYY-MM-DD, без времени/таймзоны — соответствует date-only колонке MasterSchedule.date
  @IsDateString()
  date!: string;

  @IsBoolean()
  isWorking!: boolean;

  // Обязательны по смыслу только когда isWorking=true; сервис игнорирует и обнуляет их для
  // нерабочих дней (см. MasterSchedulesService.upsertMonth), поэтому здесь остаются @IsOptional.
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime?: string;
}
