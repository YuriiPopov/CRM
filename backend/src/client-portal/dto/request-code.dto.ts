import { IsString, MinLength } from 'class-validator';

export class RequestCodeDto {
  // Формат проверяется после нормализации (см. normalizePhone) — здесь только наличие строки
  @IsString()
  @MinLength(3)
  phone!: string;
}
