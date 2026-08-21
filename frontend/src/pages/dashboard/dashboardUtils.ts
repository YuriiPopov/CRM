import type { Booking, BookingStatus } from '../../types/booking'
import { toDateOnly } from '../calendar/dateUtils'

const ALL_STATUSES: BookingStatus[] = ['CREATED', 'CONFIRMED', 'COMPLETED', 'CANCELLED']

export function countByStatus(bookings: Booking[]): Record<BookingStatus, number> {
  const counts = Object.fromEntries(ALL_STATUSES.map((status) => [status, 0])) as Record<
    BookingStatus,
    number
  >
  for (const booking of bookings) {
    counts[booking.status] += 1
  }
  return counts
}

function addDaysToDateOnly(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

// "Ближайшие" записи для виджета дашборда: сегодня/завтра, ещё не начавшиеся и не в терминальном
// статусе — CANCELLED/COMPLETED больше не требуют внимания и не показываются как "предстоящие".
export function upcomingBookings(bookings: Booking[], nowIso: string, limit = 5): Booking[] {
  const today = toDateOnly(nowIso)
  const tomorrow = addDaysToDateOnly(today, 1)

  return bookings
    .filter((booking) => booking.startTime >= nowIso)
    .filter((booking) => {
      const date = toDateOnly(booking.startTime)
      return date === today || date === tomorrow
    })
    .filter((booking) => booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED')
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .slice(0, limit)
}

// Диапазон текущего месяца для GET /payments/report/revenue (from/to — @IsDateString на бэкенде,
// принимает и просто дату, и полный ISO с временем — "to" берём концом дня, чтобы не терять
// оплаты, сделанные в последний день месяца после полуночи).
export function currentMonthRange(referenceIso: string = new Date().toISOString()): {
  from: string
  to: string
} {
  const yearMonth = referenceIso.slice(0, 7)
  const [year, month] = yearMonth.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()

  return {
    from: `${yearMonth}-01`,
    to: `${yearMonth}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`,
  }
}
