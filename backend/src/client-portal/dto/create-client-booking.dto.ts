import { IsDateString, IsUUID } from 'class-validator';

// Клиент берётся из токена — в теле только что и когда
export class CreateClientBookingDto {
  @IsUUID()
  masterId!: string;

  @IsUUID()
  serviceId!: string;

  @IsDateString()
  startTime!: string;
}
