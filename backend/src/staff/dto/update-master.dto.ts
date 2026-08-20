import { ServiceCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateMasterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(ServiceCategory)
  specialization?: ServiceCategory;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
