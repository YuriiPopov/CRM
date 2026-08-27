import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateMasterDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  specializationCategoryIds!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
