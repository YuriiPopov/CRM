import {
  Booking,
  BookingStatus,
  MasterBlock,
  PrismaClient,
} from '@prisma/client';

// Отменённая запись не занимает время мастера; выполненная — занимала (реально была оказана), поэтому
// она по-прежнему учитывается при проверке пересечений (см. ТЗ: "проверка доступности мастера по времени").
// Используется и в BookingsService (перенос/создание), и в публичной онлайн-записи — единая логика.
export const NON_BLOCKING_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CANCELLED,
];

// Буферное время между записями (Backlog п.10) — фиксированное значение на весь салон
// (уточнено с владельцем продукта: без per-услуга/per-мастер настройки на MVP). Мастеру
// нужен минимальный зазор после визита клиента на уборку/подготовку — следующая запись
// не должна вставать впритык сразу после окончания предыдущей.
export const BOOKING_BUFFER_MINUTES = 10;

export function findOverlappingBooking(
  prisma: Pick<PrismaClient, 'booking'>,
  masterId: string,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string,
  bufferMinutes = 0,
): Promise<Booking | null> {
  const paddedStart = addMinutes(startTime, -bufferMinutes);
  const paddedEnd = addMinutes(endTime, bufferMinutes);

  return prisma.booking.findFirst({
    where: {
      masterId,
      status: { notIn: NON_BLOCKING_BOOKING_STATUSES },
      startTime: { lt: paddedEnd },
      endTime: { gt: paddedStart },
      ...(excludeBookingId && { id: { not: excludeBookingId } }),
    },
  });
}

// Блокировка расписания мастера (Backlog п.9, MasterBlock) — учитывается наравне с записями:
// мастер недоступен для новой/перенесённой записи, пока действует блокировка на это время.
export function findOverlappingBlock(
  prisma: Pick<PrismaClient, 'masterBlock'>,
  masterId: string,
  startTime: Date,
  endTime: Date,
  excludeBlockId?: string,
): Promise<MasterBlock | null> {
  return prisma.masterBlock.findFirst({
    where: {
      masterId,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      ...(excludeBlockId && { id: { not: excludeBlockId } }),
    },
  });
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
