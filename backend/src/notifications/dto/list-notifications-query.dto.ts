import { NotificationStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListNotificationsQueryDto {
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;
}
