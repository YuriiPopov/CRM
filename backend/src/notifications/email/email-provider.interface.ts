export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

// За этим интерфейсом прячется реальный провайдер (SendGrid/SES/...), который в MVP
// намеренно не подключаем (см. архитектуру, п.5) — ConsoleEmailProvider ниже лишь логирует.
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
