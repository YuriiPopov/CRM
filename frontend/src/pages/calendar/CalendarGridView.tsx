import { useState } from 'react'
import type { DragEvent } from 'react'
import { BookingGridCard } from './BookingGridCard'
import { formatTimeRange, toDateOnly } from './dateUtils'
import { masterBlockCreatedByLabel } from './masterBlockCreatedBy'
import { mergeScheduleItems } from './mergeScheduleItems'
import { unavailableFractions } from './masterScheduleAvailability'
import { MasterAvatar } from '../../components/MasterAvatar'
import type { CalendarGridDay } from './calendarGrid'
import type { PartialAvailability } from './masterScheduleAvailability'
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
  currentMasterId: string | null
  // = isAdmin из CalendarPage — полностью выключает механизм переноса для MASTER: атрибуты
  // draggable и обработчики dragover/drop на ячейках вообще не навешиваются, а не просто
  // прячутся визуально (см. BookingGridCard — там та же логика на уровне карточки).
  canDragReschedule: boolean
  // Дни, нерабочие (isWorking: false) для мастера, на которого сейчас скоуплена сетка — только
  // ADMIN с выбранным конкретным мастером в фильтре, либо MASTER на "Моё расписание" (когда
  // сетка однозначно про одного мастера); пустой Set при "Все мастера" — затемнение и запрет
  // переноса по графику не имеют смысла без единственного мастера на ячейку (см. CalendarPage,
  // scheduleMasterId). Дни без записи в графике ("не размечено") сюда не попадают.
  blockedDates: Set<string>
  // item49 — дни, рабочие (isWorking: true), но с часами дня, ограниченными startTime/endTime
  // (частичная недоступность) — та же область видимости, что у blockedDates выше (только для
  // сетки, скоупленной на одного мастера); полностью нерабочие дни сюда не попадают, они уже
  // покрыты blockedDates.
  partialAvailabilityByDate: Map<string, PartialAvailability>
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
  currentMasterId,
  canDragReschedule,
  blockedDates,
  partialAvailabilityByDate,
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
          const isScheduleBlocked = blockedDates.has(day.date)
          const canDropHere = canDragReschedule && !isScheduleBlocked
          // Полностью нерабочий день уже целиком заштрихован (isScheduleBlocked) — частичный
          // оверлей поверх него был бы избыточен, к тому же дата не может попасть в оба Set/Map
          // одновременно (см. buildBlockedDatesSet/buildPartialAvailabilityByDate).
          const partialAvailability = !isScheduleBlocked ? partialAvailabilityByDate.get(day.date) : undefined
          const unavailable = partialAvailability
            ? unavailableFractions(partialAvailability.startTime, partialAvailability.endTime)
            : null

          const cellClassNames = [
            'calendar-grid-cell',
            day.isToday && 'calendar-grid-cell--today',
            !day.isCurrentPeriod && 'calendar-grid-cell--other-period',
            isScheduleBlocked && 'calendar-grid-cell--schedule-blocked',
            hoveredDate === day.date && 'calendar-grid-cell--drag-over',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div
              key={day.date}
              className={cellClassNames}
              data-date={day.date}
              onDragOver={canDropHere ? (event) => handleCellDragOver(event, day.date) : undefined}
              onDrop={canDropHere ? (event) => handleCellDrop(event, day.date) : undefined}
            >
              {unavailable && unavailable.topPercent > 0 && (
                <div
                  className="calendar-grid-cell-unavailable calendar-grid-cell-unavailable--top"
                  style={{ height: `${unavailable.topPercent}%` }}
                />
              )}
              {unavailable && unavailable.bottomPercent > 0 && (
                <div
                  className="calendar-grid-cell-unavailable calendar-grid-cell-unavailable--bottom"
                  style={{ height: `${unavailable.bottomPercent}%` }}
                />
              )}

              <div className="calendar-grid-cell-date">{formatCellDayNumber(day.date)}</div>

              <ul className="calendar-grid-cell-bookings">
                {mergeScheduleItems(visibleBookings, dayBlocks).map((item) => {
                  if (item.kind === 'block') {
                    const block = item.block
                    const blockMaster = mastersById.get(block.masterId)
                    const createdByLabel = masterBlockCreatedByLabel(block)
                    const title = [
                      formatTimeRange(block.startTime, block.endTime),
                      block.reason ?? 'Недоступен',
                      createdByLabel,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                    return (
                      <li key={block.id} className="calendar-grid-block-chip" title={title}>
                        {blockMaster && (
                          <MasterAvatar master={blockMaster} className="calendar-grid-block-chip-avatar" />
                        )}
                        {formatTimeRange(block.startTime, block.endTime)}
                      </li>
                    )
                  }

                  const booking = item.booking
                  return (
                    <BookingGridCard
                      key={booking.id}
                      booking={booking}
                      client={clientsById.get(booking.clientId)}
                      master={mastersById.get(booking.masterId)}
                      service={servicesById.get(booking.serviceId)}
                      role={role}
                      currentMasterId={currentMasterId}
                      isPaid={paidBookingIds.has(booking.id)}
                      canDragReschedule={canDragReschedule}
                      isDragging={draggingBooking?.id === booking.id}
                      busy={busyBookingId === booking.id}
                      onReschedule={() => onReschedule(booking)}
                      onDragStart={setDraggingBooking}
                      onDragEnd={clearDragState}
                    />
                  )
                })}
              </ul>

              {hiddenCount > 0 && <div className="calendar-grid-cell-more">+{hiddenCount}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
