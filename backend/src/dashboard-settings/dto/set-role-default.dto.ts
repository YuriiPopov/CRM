import { IsBoolean, IsEnum, IsIn } from 'class-validator';
import { Role } from '@prisma/client';
import { DASHBOARD_WIDGET_KEYS } from '../dashboard-widget-keys';

export class SetRoleDefaultDto {
  @IsEnum(Role)
  role!: Role;

  @IsIn(DASHBOARD_WIDGET_KEYS)
  widgetKey!: string;

  @IsBoolean()
  visible!: boolean;
}
