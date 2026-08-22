import type { Booking, BookingStatus } from '../../types/booking'

// Единый источник правды для набора статусов, доступных в фильтре — зеркалит BookingStatus.
export const ALL_BOOKING_STATUSES: BookingStatus[] = ['CREATED', 'CONFIRMED', 'COMPLETED', 'CANCELLED']

export interface PaymentVisibilityFilter {
  showPaid: boolean
  showUnpaid: boolean
}

// Оба фильтра действуют как "И": запись должна пройти И по статусу, И по признаку оплаты.
// Пустой selectedStatuses или showPaid === showUnpaid === false — легитимный результат
// "ничего не проходит" (все чекбоксы сняты), а не ошибка — вызывающая сторона отвечает
// за адекватное пустое состояние в UI.
export function filterBookingsByVisibility(
  bookings: Booking[],
  selectedStatuses: Set<BookingStatus>,
  paidBookingIds: Set<string>,
  paymentFilter: PaymentVisibilityFilter,
): Booking[] {
  return bookings.filter((booking) => {
    if (!selectedStatuses.has(booking.status)) return false

    const isPaid = paidBookingIds.has(booking.id)
    return isPaid ? paymentFilter.showPaid : paymentFilter.showUnpaid
  })
}
