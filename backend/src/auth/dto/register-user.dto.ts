import { Role } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class RegisterUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(Role)
  role!: Role;

  // Учётная запись мастера, которую нужно связать с новым логином (опционально — не у каждого мастера есть логин на старте)
  @IsOptional()
  @IsUUID()
  masterId?: string;
}
