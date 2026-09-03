import { Module } from '@nestjs/common';
import { DashboardSettingsController } from './dashboard-settings.controller';
import { DashboardSettingsService } from './dashboard-settings.service';

@Module({
  controllers: [DashboardSettingsController],
  providers: [DashboardSettingsService],
})
export class DashboardSettingsModule {}
