import { ServiceCategory } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(ServiceCategory)
  category!: ServiceCategory;

  @IsInt()
  @IsPositive()
  durationMin!: number;

  @IsNumber()
  @Min(0)
  price!: number;
}
