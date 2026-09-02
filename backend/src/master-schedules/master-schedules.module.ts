import { Module } from '@nestjs/common';
import { MasterSchedulesController } from './master-schedules.controller';
import { MasterSchedulesService } from './master-schedules.service';

@Module({
  controllers: [MasterSchedulesController],
  providers: [MasterSchedulesService],
})
export class MasterSchedulesModule {}
