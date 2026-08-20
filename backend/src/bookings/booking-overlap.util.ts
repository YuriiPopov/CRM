import { Booking, BookingStatus, PrismaClient } from '@prisma/client';

// Отменённая запись не занимает время мастера; выполненная — занимала (реально была оказана), поэтому
// она по-прежнему учитывается при проверке пересечений (см. ТЗ: "проверка доступности мастера по времени").
// Используется и в BookingsService (перенос/создание), и в публичной онлайн-записи — единая логика.
export const NON_BLOCKING_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CANCELLED,
];

export function findOverlappingBooking(
  prisma: Pick<PrismaClient, 'booking'>,
  masterId: string,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string,
): Promise<Booking | null> {
  return prisma.booking.findFirst({
    where: {
      masterId,
      status: { notIn: NON_BLOCKING_BOOKING_STATUSES },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      ...(excludeBookingId && { id: { not: excludeBookingId } }),
    },
  });
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
