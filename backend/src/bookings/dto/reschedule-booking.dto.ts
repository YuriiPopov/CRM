import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class RescheduleBookingDto {
  @IsDateString()
  startTime!: string;

  @IsOptional()
  @IsUUID()
  masterId?: string;
}
