import {
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsUUID('4')
  categoryId!: string;

  @IsInt()
  @IsPositive()
  durationMin!: number;

  @IsNumber()
  @Min(0)
  price!: number;
}
