import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { ClientPortalModule } from './client-portal/client-portal.module';
import { ClientsModule } from './clients/clients.module';
import { ClientApiGuard } from './common/client-api/client-api.guard';
import { winstonOptions } from './common/logger/logger.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { DashboardSettingsModule } from './dashboard-settings/dashboard-settings.module';
import { InventoryModule } from './inventory/inventory.module';
import { MasterBlocksModule } from './master-blocks/master-blocks.module';
import { MasterSchedulesModule } from './master-schedules/master-schedules.module';
import { NewsModule } from './news/news.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicBookingModule } from './public-booking/public-booking.module';
import { ServiceCategoriesModule } from './service-categories/service-categories.module';
import { ServicesModule } from './services/services.module';
import { StaffModule } from './staff/staff.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    WinstonModule.forRoot(winstonOptions),
    MetricsModule, // HTTP-метрики: MetricsMiddleware зареєстрований всередині MetricsModule
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
    DashboardSettingsModule,
    UsersModule,
    ClientPortalModule,
    NewsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ClientApiGuard }],
})
export class AppModule {}
