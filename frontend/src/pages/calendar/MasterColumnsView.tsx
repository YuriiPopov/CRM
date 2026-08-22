import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { groupBookingsByMaster } from './groupBookingsByMaster'
import type { Booking } from '../../types/booking'
import type { Master } from '../../types/staff'

interface MasterColumnsViewProps {
  masters: Master[]
  bookings: Booking[]
  renderBooking: (booking: Booking) => ReactNode
}

// Карточка записи не меняется между режимами "Список"/"По мастерам" — renderBooking
// приходит из CalendarPage уже полностью настроенной (та же BookingListItem с теми же
// пропсами), эта колонка лишь группирует и раскладывает их по мастерам.
export function MasterColumnsView({ masters, bookings, renderBooking }: MasterColumnsViewProps) {
  const columns = useMemo(() => groupBookingsByMaster(bookings, masters), [bookings, masters])

  return (
    <div className="master-columns">
      {columns.map(({ master, bookings: masterBookings }) => (
        <div key={master.id} className="master-column">
          <h2 className="master-column-header">{master.name}</h2>
          {masterBookings.length === 0 ? (
            <p className="master-column-empty">Нет записей</p>
          ) : (
            <ul className="booking-list">{masterBookings.map((booking) => renderBooking(booking))}</ul>
          )}
        </div>
      ))}
    </div>
  )
}
