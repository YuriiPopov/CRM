import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { StaffModule } from './staff/staff.module';
import { ServicesModule } from './services/services.module';
import { ServiceCategoriesModule } from './service-categories/service-categories.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { InventoryModule } from './inventory/inventory.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PublicBookingModule } from './public-booking/public-booking.module';
import { MasterBlocksModule } from './master-blocks/master-blocks.module';
import { MasterSchedulesModule } from './master-schedules/master-schedules.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ClientsModule,
    StaffModule,
    ServicesModule,
    ServiceCategoriesModule,
    BookingsModule,
    PaymentsModule,
    InventoryModule,
    NotificationsModule,
    PublicBookingModule,
    MasterBlocksModule,
    MasterSchedulesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
