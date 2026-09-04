import type { Booking } from '../../types/booking'
import { toDateOnly } from './dateUtils'

export const ALL_MASTERS = 'all'
export const ALL_SERVICES = 'all'

// Ключевая логика отображения: сервер уже скоупит список записей по роли (ADMIN — весь салон,
// MASTER — только свои, см. GET /bookings), эта функция лишь сужает его до выбранного дня
// и, дополнительно, до выбранных в фильтрах мастера/услуги (логическое "И" между обоими).
export function filterBookingsForDay(
  bookings: Booking[],
  date: string,
  masterId: string = ALL_MASTERS,
  serviceId: string = ALL_SERVICES,
): Booking[] {
  return bookings
    .filter((booking) => toDateOnly(booking.startTime) === date)
    .filter((booking) => masterId === ALL_MASTERS || booking.masterId === masterId)
    .filter((booking) => serviceId === ALL_SERVICES || booking.serviceId === serviceId)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

// Тот же приём, что и filterBookingsForDay, но для набора дат сразу — недельная/месячная
// сетка календаря показывает несколько дней одновременно, а не один выбранный.
export function filterBookingsForRange(
  bookings: Booking[],
  dates: string[],
  masterId: string = ALL_MASTERS,
  serviceId: string = ALL_SERVICES,
): Booking[] {
  const dateSet = new Set(dates)
  return bookings
    .filter((booking) => dateSet.has(toDateOnly(booking.startTime)))
    .filter((booking) => masterId === ALL_MASTERS || booking.masterId === masterId)
    .filter((booking) => serviceId === ALL_SERVICES || booking.serviceId === serviceId)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}
