import type { Booking } from '../../types/booking'

// Онлайн-запись из клиентского приложения, ждущая решения салона (item61): ещё не подтверждена
// и не началась. Прошедшие неподтверждённые сюда не попадают — их видно в Календаре по бейджу.
export function isPendingOnlineBooking(booking: Booking, nowIso: string): boolean {
  return booking.source === 'ONLINE' && booking.status === 'CREATED' && booking.startTime >= nowIso
}

export function pendingOnlineBookings(bookings: Booking[], nowIso: string): Booking[] {
  return bookings
    .filter((booking) => isPendingOnlineBooking(booking, nowIso))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}
