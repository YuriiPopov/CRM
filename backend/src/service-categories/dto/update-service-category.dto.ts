import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateServiceCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
