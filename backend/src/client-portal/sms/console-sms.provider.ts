import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms-provider.interface';

// Мок-реализация для MVP — пишет SMS в лог вместо отправки (включая код входа: в dev это
// единственный способ его узнать). Заменяется на настоящего провайдера через DI-токен
// SMS_PROVIDER, без изменений в ClientAuthService.
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  send(to: string, text: string): Promise<void> {
    this.logger.log(`[mock sms] to=${to} text="${text}"`);
    return Promise.resolve();
  }
}
