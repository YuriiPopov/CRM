import { ServiceCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateMasterDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(ServiceCategory)
  specialization!: ServiceCategory;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
