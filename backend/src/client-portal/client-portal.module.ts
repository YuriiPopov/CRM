import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { BookingsModule } from '../bookings/bookings.module';
import { NewsModule } from '../news/news.module';
import { ServicesModule } from '../services/services.module';
import { PublicBookingModule } from '../public-booking/public-booking.module';
import { ClientAuthService } from './auth/client-auth.service';
import { ClientJwtStrategy } from './auth/client-jwt.strategy';
import {
  ClientAuthController,
  ClientPortalController,
} from './client-portal.controller';
import { ClientPortalService } from './client-portal.service';
import { ConsoleSmsProvider } from './sms/console-sms.provider';
import { SMS_PROVIDER } from './sms/sms-provider.interface';
import { DEFAULT_JWT_SECRET } from '../common/config/assert-production-config';

// API клиентского мобильного приложения (/client/*): вход по телефону + SMS-коду, каталог
// салона, свободные слоты, собственные записи клиента и новости салона (item75). Отдельно от /auth сотрудников — свой
// тип токена (см. client-jwt.ts) и своя стратегия passport.
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', DEFAULT_JWT_SECRET),
      }),
    }),
    BookingsModule,
    PublicBookingModule,
    NewsModule,
    ServicesModule,
  ],
  controllers: [ClientAuthController, ClientPortalController],
  providers: [
    ClientAuthService,
    ClientPortalService,
    ClientJwtStrategy,
    { provide: SMS_PROVIDER, useClass: ConsoleSmsProvider },
  ],
})
export class ClientPortalModule {}
