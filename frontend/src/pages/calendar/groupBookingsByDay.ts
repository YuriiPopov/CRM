import type { Booking } from '../../types/booking'
import { toDateOnly } from './dateUtils'

// Раскладывает записи (уже сузженные до диапазона дат, см. filterBookingsForRange) по дню —
// ключ создаётся для КАЖДОЙ даты из dates, даже без записей (та же логика "не пропускать
// пустые", что и у groupBookingsByMaster — ячейка сетки нужна в любом случае). В отличие от
// колонок "По мастерам" (одна карточка = один мастер), в ячейке дня смешиваются записи разных
// мастеров, поэтому сортировка внутри дня — только по времени начала.
export function groupBookingsByDay(bookings: Booking[], dates: string[]): Map<string, Booking[]> {
  const byDay = new Map<string, Booking[]>(dates.map((date) => [date, []]))

  for (const booking of bookings) {
    const date = toDateOnly(booking.startTime)
    const bucket = byDay.get(date)
    if (bucket) bucket.push(booking)
  }

  for (const bucket of byDay.values()) {
    bucket.sort((a, b) => a.startTime.localeCompare(b.startTime))
  }

  return byDay
}
