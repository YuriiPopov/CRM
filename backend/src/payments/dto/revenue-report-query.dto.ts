import { IsDateString, IsOptional } from 'class-validator';

export class RevenueReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
