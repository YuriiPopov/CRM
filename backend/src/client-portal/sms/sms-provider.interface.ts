// За этим интерфейсом прячется реальный SMS-провайдер (SMSAPI/Twilio/...), который в MVP ещё не
// подключён — ConsoleSmsProvider лишь логирует. Тот же приём, что и EMAIL_PROVIDER в notifications.
export interface SmsProvider {
  send(to: string, text: string): Promise<void>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
