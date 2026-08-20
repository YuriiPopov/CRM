import { Injectable, Logger } from '@nestjs/common';
import { EmailMessage, EmailProvider } from './email-provider.interface';

// Мок-реализация для MVP — просто логирует вместо реальной отправки.
// Заменяется на настоящего провайдера (SendGrid/SES/...) через DI-токен EMAIL_PROVIDER,
// без изменений в NotificationsService.
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  send(message: EmailMessage): Promise<void> {
    this.logger.log(
      `[mock email] to=${message.to} subject="${message.subject}"`,
    );
    return Promise.resolve();
  }
}
