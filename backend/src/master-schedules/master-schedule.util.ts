// Границы месяца/дня для запросов к date-only полю MasterSchedule.date (@db.Date) и к
// DateTime-полям Booking.startTime — всегда в UTC, т.к. date-only колонка Prisma хранит
// полночь UTC для переданной календарной даты (см. тот же приём в booking-overlap.util.ts).
export function monthRange(
  year: number,
  month: number,
): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

export function dayRange(dateIso: string): { start: Date; end: Date } {
  const start = new Date(`${dateIso}T00:00:00.000Z`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function isDateInMonth(
  dateIso: string,
  year: number,
  month: number,
): boolean {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month;
}
