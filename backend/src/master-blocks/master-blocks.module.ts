import { Module } from '@nestjs/common';
import { MasterBlocksController } from './master-blocks.controller';
import { MasterBlocksService } from './master-blocks.service';

@Module({
  controllers: [MasterBlocksController],
  providers: [MasterBlocksService],
})
export class MasterBlocksModule {}
