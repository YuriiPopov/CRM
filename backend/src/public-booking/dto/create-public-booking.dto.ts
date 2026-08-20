import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreatePublicBookingDto {
  @IsUUID()
  masterId!: string;

  @IsUUID()
  serviceId!: string;

  @IsDateString()
  startTime!: string;

  @IsString()
  @MinLength(1)
  clientName!: string;

  @IsString()
  @MinLength(3)
  clientPhone!: string;

  @IsOptional()
  @IsEmail()
  clientEmail?: string;

  // GDPR: явное согласие на обработку данных при создании карточки клиента (см. архитектуру, п.6)
  @IsBoolean()
  consentGiven!: boolean;
}
