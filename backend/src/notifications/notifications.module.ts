import { Module } from '@nestjs/common';
import { ConsoleEmailProvider } from './email/console-email.provider';
import { EMAIL_PROVIDER } from './email/email-provider.interface';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: EMAIL_PROVIDER, useClass: ConsoleEmailProvider },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
