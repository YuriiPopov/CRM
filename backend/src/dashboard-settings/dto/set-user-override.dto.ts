import { IsBoolean, IsIn, IsUUID } from 'class-validator';
import { DASHBOARD_WIDGET_KEYS } from '../dashboard-widget-keys';

export class SetUserOverrideDto {
  @IsUUID()
  userId!: string;

  @IsIn(DASHBOARD_WIDGET_KEYS)
  widgetKey!: string;

  @IsBoolean()
  visible!: boolean;
}
