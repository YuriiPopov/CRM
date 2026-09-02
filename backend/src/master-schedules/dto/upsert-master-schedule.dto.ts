import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MasterScheduleDayDto } from './master-schedule-day.dto';

// Тело и для PUT /master-schedules (сохранить график), и для POST /master-schedules/conflicts
// (спросить, какие Booking конфликтуют с ЭТИМ графиком без сохранения) — форма данных одинаковая:
// "предлагаемый график месяца".
export class UpsertMasterScheduleDto {
  @IsUUID()
  masterId!: string;

  @IsInt()
  @Min(2000)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MasterScheduleDayDto)
  days!: MasterScheduleDayDto[];
}
