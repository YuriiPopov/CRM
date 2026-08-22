import type { Booking } from '../../types/booking'
import type { Master } from '../../types/staff'

export interface MasterBookingsColumn {
  master: Master
  bookings: Booking[]
}

// Один столбец на каждого активного мастера (порядок — как в переданном списке masters),
// даже если у мастера в этот день нет ни одной записи — колонка всё равно рендерится
// (пустое состояние "Нет записей" в UI). Записи внутри колонки сортируются по времени
// независимо от порядка/сортировки во входном массиве bookings.
export function groupBookingsByMaster(bookings: Booking[], masters: Master[]): MasterBookingsColumn[] {
  return masters
    .filter((master) => master.isActive)
    .map((master) => ({
      master,
      bookings: bookings
        .filter((booking) => booking.masterId === master.id)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }))
}
