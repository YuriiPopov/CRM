import type { Booking, BookingSource } from '../../types/booking'

export const ALL_SOURCES = 'all'

export type BookingSourceFilter = typeof ALL_SOURCES | BookingSource

export const SOURCE_FILTER_OPTIONS: { value: BookingSourceFilter; label: string }[] = [
  { value: ALL_SOURCES, label: 'Все' },
  { value: 'ONLINE', label: 'Из приложения' },
  { value: 'ADMIN', label: 'Созданные в CRM' },
]

// Фильтр по источнику записи (item61) — как и фильтр статуса/оплаты, работает как "И" поверх них
export function filterBookingsBySource(bookings: Booking[], source: BookingSourceFilter): Booking[] {
  if (source === ALL_SOURCES) return bookings
  return bookings.filter((booking) => booking.source === source)
}
