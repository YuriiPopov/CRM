import { NewsCategory, NewsStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { NEWS_BODY_MAX, NEWS_TITLE_MAX, trim } from './create-news.dto';

export class UpdateNewsDto {
  @IsOptional()
  @IsEnum(NewsCategory)
  category?: NewsCategory;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, NEWS_TITLE_MAX)
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, NEWS_BODY_MAX)
  body?: string;

  @IsOptional()
  @IsEnum(NewsStatus)
  status?: NewsStatus;

  // Страница статьи (item89): HTML-файл целиком. Санитизируется и пережимается в NewsService.
  // Отсутствует — не менять; null или пустая строка — удалить статью.
  @IsOptional()
  @IsString()
  contentHtml?: string | null;
}
