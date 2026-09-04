import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { groupBookingsByMaster } from './groupBookingsByMaster'
import { MasterAvatar } from '../../components/MasterAvatar'
import type { Booking } from '../../types/booking'
import type { Master } from '../../types/staff'
import type { MasterBlock } from '../../types/masterBlock'

interface MasterColumnsViewProps {
  masters: Master[]
  bookings: Booking[]
  // Записи дня ДО фильтров статуса/оплаты — только чтобы отличить "у мастера правда нет
  // записей в этот день" от "есть, но все отфильтрованы" и показать разное пустое состояние.
  unfilteredBookings: Booking[]
  renderBooking: (booking: Booking) => ReactNode
  // Блокировки расписания (Backlog п.9) — уже сгруппированы по мастеру и отфильтрованы на день
  // (см. groupBlocksByMaster в CalendarPage), рендерятся отдельным блоком поверх списка записей.
  blocksByMasterId: Map<string, MasterBlock[]>
  renderBlock: (block: MasterBlock) => ReactNode
}

// Карточка записи не меняется между режимами "Список"/"По мастерам" — renderBooking
// приходит из CalendarPage уже полностью настроенной (та же BookingListItem с теми же
// пропсами), эта колонка лишь группирует и раскладывает их по мастерам.
export function MasterColumnsView({
  masters,
  bookings,
  unfilteredBookings,
  renderBooking,
  blocksByMasterId,
  renderBlock,
}: MasterColumnsViewProps) {
  const columns = useMemo(() => groupBookingsByMaster(bookings, masters), [bookings, masters])

  const totalCountByMasterId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const booking of unfilteredBookings) {
      counts.set(booking.masterId, (counts.get(booking.masterId) ?? 0) + 1)
    }
    return counts
  }, [unfilteredBookings])

  return (
    <div className="master-columns">
      {columns.map(({ master, bookings: masterBookings }) => {
        const masterBlocks = blocksByMasterId.get(master.id) ?? []
        return (
          <div key={master.id} className="master-column">
            <h2 className="master-column-header">
              <MasterAvatar master={master} className="master-column-avatar" />
              {master.name}
            </h2>
            {masterBookings.length === 0 && masterBlocks.length === 0 ? (
              <p className="master-column-empty">
                {(totalCountByMasterId.get(master.id) ?? 0) === 0
                  ? 'Нет записей'
                  : 'Нет записей по выбранным фильтрам'}
              </p>
            ) : (
              <ul className="booking-list">
                {masterBlocks.map((block) => renderBlock(block))}
                {masterBookings.map((booking) => renderBooking(booking))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
