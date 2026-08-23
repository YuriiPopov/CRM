import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ListMasterBlocksQueryDto {
  // ADMIN может отфильтровать по конкретному мастеру; MASTER всегда скоупится на себя
  // независимо от этого параметра (см. MasterBlocksService.findAll).
  @IsOptional()
  @IsUUID()
  masterId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
