// Соглашение о времени (см. README, раздел «Время салона»): Booking.startTime/endTime,
// MasterBlock, часы графика и слоты хранят НАСТЕННОЕ время салона с меткой UTC — визит в 10:00
// по Варшаве лежит в БД как 10:00Z. Поэтому «сейчас» для сравнения с ними тоже должно быть
// настенным временем салона с меткой UTC, а не настоящим UTC (иначе в Польше проверки
// «уже наступило / в прошлом» отстают на 1–2 часа, item77).
//
// Служебные метки (consentGivenAt, paidAt, срок OTP, rescheduledAt, sentAt …) — это настоящий
// UTC, их сравнивают и пишут через обычный new Date(); salonNow() для них не используется.

export const DEFAULT_SALON_TIMEZONE = 'Europe/Warsaw';

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    // Бросает RangeError на неизвестный часовой пояс — на этом построена проверка при старте
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export function salonTimezone(env: NodeJS.ProcessEnv = process.env): string {
  return env.SALON_TIMEZONE || DEFAULT_SALON_TIMEZONE;
}

/**
 * Отказывается запускать приложение с неизвестным SALON_TIMEZONE — иначе первая же проверка
 * времени записи упала бы с RangeError посреди запроса.
 */
export function assertSalonTimezone(env: NodeJS.ProcessEnv): void {
  const timeZone = salonTimezone(env);
  try {
    formatterFor(timeZone);
  } catch {
    throw new Error(
      `Invalid SALON_TIMEZONE "${timeZone}": expected an IANA time zone such as ${DEFAULT_SALON_TIMEZONE}`,
    );
  }
}

/**
 * Настенное время салона в момент `instant`, выраженное как Date с меткой UTC — та же
 * конвенция, что у Booking.startTime. Летнее/зимнее время считает Intl (база IANA), не код.
 */
export function toSalonTime(
  instant: Date,
  timeZone: string = salonTimezone(),
): Date {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      instant.getUTCMilliseconds(),
    ),
  );
}

/**
 * «Сейчас» по времени салона в конвенции хранения записей. Часы берутся из Date.now(), поэтому
 * в тестах подменяются через jest.useFakeTimers().setSystemTime(...).
 */
export function salonNow(timeZone: string = salonTimezone()): Date {
  return toSalonTime(new Date(Date.now()), timeZone);
}
