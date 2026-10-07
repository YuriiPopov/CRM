import { Module } from '@nestjs/common';
import { ServicePhotosService } from './service-photos.service';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  controllers: [ServicesController],
  providers: [ServicesService, ServicePhotosService],
  exports: [ServicePhotosService],
})
export class ServicesModule {}
