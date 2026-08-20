import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePaymentDto {
  @IsUUID()
  bookingId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsString()
  @MinLength(1)
  method!: string;
}
