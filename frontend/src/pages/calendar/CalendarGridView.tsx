import { useState } from 'react'
import type { DragEvent } from 'react'
import { BookingGridCard } from './BookingGridCard'
import { formatTimeRange, toDateOnly } from './dateUtils'
import { masterBlockCreatedByLabel } from './masterBlockCreatedBy'
import type { CalendarGridDay } from './calendarGrid'
import type { Booking } from '../../types/booking'
import type { MasterBlock } from '../../types/masterBlock'
import type { Client } from '../../types/client'
import type { Master } from '../../types/staff'
import type { Service } from '../../types/service'
import type { Role } from '../../types/auth'

const WEEKDAY_HEADERS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
// В месячной ячейке место ограничено (6 строк на экран) — недельная не ограничивает,
// записей на человека в день ожидаемо немного (см. план).
const MAX_MONTH_CELL_BOOKINGS = 3

interface CalendarGridViewProps {
  days: CalendarGridDay[]
  layout: 'week' | 'month'
  bookingsByDay: Map<string, Booking[]>
  blocksByDay: Map<string, MasterBlock[]>
  clientsById: Map<string, Client>
  mastersById: Map<string, Master>
  servicesById: Map<string, Service>
  paidBookingIds: Set<string>
  role: Role
  // = isAdmin из CalendarPage — полностью выключает механизм переноса для MASTER: атрибуты
  // draggable и обработчики dragover/drop на ячейках вообще не навешиваются, а не просто
  // прячутся визуально (см. BookingGridCard — там та же логика на уровне карточки).
  canDragReschedule: boolean
  busyBookingId: string | null
  onReschedule: (booking: Booking) => void
  onDropBooking: (booking: Booking, newDate: string) => void
}

function formatCellDayNumber(dateOnly: string): string {
  return String(new Date(`${dateOnly}T00:00:00.000Z`).getUTCDate())
}

// Одна сетка на оба режима (неделя/месяц) — общая логика ячеек и drag-and-drop, отличаются
// только размерность (7 или 42 дня → repeat(7, 1fr), 1 или 6 строк) и приглушение чужого
// месяца, которое уже пришло флагом isCurrentPeriod в days.
export function CalendarGridView({
  days,
  layout,
  bookingsByDay,
  blocksByDay,
  clientsById,
  mastersById,
  servicesById,
  paidBookingIds,
  role,
  canDragReschedule,
  busyBookingId,
  onReschedule,
  onDropBooking,
}: CalendarGridViewProps) {
  // Не полагаемся на dataTransfer.getData в момент drop — в части браузеров оно ненадёжно
  // во время самого перетаскивания, поэтому источник истины — локальный React-state.
  const [draggingBooking, setDraggingBooking] = useState<Booking | null>(null)
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  const clearDragState = () => {
    setDraggingBooking(null)
    setHoveredDate(null)
  }

  const handleCellDragOver = (event: DragEvent<HTMLDivElement>, date: string) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setHoveredDate(date)
  }

  const handleCellDrop = (event: DragEvent<HTMLDivElement>, date: string) => {
    event.preventDefault()
    if (draggingBooking && toDateOnly(draggingBooking.startTime) !== date) {
      onDropBooking(draggingBooking, date)
    }
    clearDragState()
  }

  return (
    <div className={`calendar-grid calendar-grid--${layout}`}>
      <div className="calendar-grid-weekday-header">
        {WEEKDAY_HEADERS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="calendar-grid-cells">
        {days.map((day) => {
          const dayBookings = bookingsByDay.get(day.date) ?? []
          const dayBlocks = blocksByDay.get(day.date) ?? []
          const visibleBookings =
            layout === 'month' ? dayBookings.slice(0, MAX_MONTH_CELL_BOOKINGS) : dayBookings
          const hiddenCount = dayBookings.length - visibleBookings.length

          const cellClassNames = [
            'calendar-grid-cell',
            day.isToday && 'calendar-grid-cell--today',
            !day.isCurrentPeriod && 'calendar-grid-cell--other-period',
            hoveredDate === day.date && 'calendar-grid-cell--drag-over',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div
              key={day.date}
              className={cellClassNames}
              data-date={day.date}
              onDragOver={canDragReschedule ? (event) => handleCellDragOver(event, day.date) : undefined}
              onDrop={canDragReschedule ? (event) => handleCellDrop(event, day.date) : undefined}
            >
              <div className="calendar-grid-cell-date">{formatCellDayNumber(day.date)}</div>

              {dayBlocks.map((block) => {
                const createdByLabel = masterBlockCreatedByLabel(block)
                const title = [
                  formatTimeRange(block.startTime, block.endTime),
                  block.reason ?? 'Недоступен',
                  createdByLabel,
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <div key={block.id} className="calendar-grid-block-chip" title={title}>
                    {formatTimeRange(block.startTime, block.endTime)}
                  </div>
                )
              })}

              <ul className="calendar-grid-cell-bookings">
                {visibleBookings.map((booking) => (
                  <BookingGridCard
                    key={booking.id}
                    booking={booking}
                    client={clientsById.get(booking.clientId)}
                    master={mastersById.get(booking.masterId)}
                    service={servicesById.get(booking.serviceId)}
                    role={role}
                    isPaid={paidBookingIds.has(booking.id)}
                    canDragReschedule={canDragReschedule}
                    isDragging={draggingBooking?.id === booking.id}
                    busy={busyBookingId === booking.id}
                    onReschedule={() => onReschedule(booking)}
                    onDragStart={setDraggingBooking}
                    onDragEnd={clearDragState}
                  />
                ))}
              </ul>

              {hiddenCount > 0 && <div className="calendar-grid-cell-more">+{hiddenCount}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
