import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(3)
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  // GDPR: явное согласие на обработку данных фиксируется при создании карточки (см. архитектуру, п.6)
  @IsBoolean()
  consentGiven!: boolean;
}
