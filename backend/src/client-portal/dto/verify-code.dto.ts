import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class VerifyCodeDto {
  @IsString()
  @MinLength(3)
  phone!: string;

  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;

  // Нужны только при первом входе, когда карточки клиента с этим телефоном ещё нет
  // (сервер отвечает 422 PROFILE_REQUIRED, приложение досылает тот же код вместе с ними).
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // GDPR: явное согласие на обработку данных при создании карточки клиента (см. архитектуру, п.6)
  @IsOptional()
  @IsBoolean()
  consentGiven?: boolean;
}
