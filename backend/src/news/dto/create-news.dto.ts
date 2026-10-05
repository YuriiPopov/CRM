import { NewsCategory, NewsStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

// Пробелы по краям обрезаются до проверки длины — заголовок из одних пробелов не проходит (item75)
export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const NEWS_TITLE_MAX = 120;
export const NEWS_BODY_MAX = 2000;

export class CreateNewsDto {
  @IsEnum(NewsCategory)
  category!: NewsCategory;

  @Transform(trim)
  @IsString()
  @Length(1, NEWS_TITLE_MAX)
  title!: string;

  @Transform(trim)
  @IsString()
  @Length(1, NEWS_BODY_MAX)
  body!: string;

  // По умолчанию — черновик (default в схеме)
  @IsOptional()
  @IsEnum(NewsStatus)
  status?: NewsStatus;
}
