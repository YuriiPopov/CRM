import type { DragEvent } from 'react'
import { canReschedule, getStatusBadgeClass, STATUS_LABELS } from './statusTransitions'
import { formatTime, formatTimeRange } from './dateUtils'
import { getMasterColor } from '../dashboard/masterColor'
import type { Booking } from '../../types/booking'
import type { Client } from '../../types/client'
import type { Master } from '../../types/staff'
import type { Service } from '../../types/service'
import type { Role } from '../../types/auth'

interface BookingGridCardProps {
  booking: Booking
  client: Client | undefined
  master: Master | undefined
  service: Service | undefined
  role: Role
  isPaid: boolean
  // = isAdmin из CalendarPage — полностью выключает draggable/кнопку "Перенести" для MASTER,
  // а не просто прячет их визуально (см. CalendarGridView: DnD-обработчики самих ячеек тоже
  // не навешиваются при этом флаге).
  canDragReschedule: boolean
  // Источник переноса, за который сейчас тащат — приглушается, пока сама запись летит над
  // сеткой (состояние живёт в CalendarGridView, эта карточка только его отражает).
  isDragging: boolean
  busy: boolean
  onReschedule: () => void
  onDragStart: (booking: Booking) => void
  onDragEnd: () => void
}

// Компактная карточка записи для ячейки недельной/месячной сетки — в отличие от
// BookingListItem, не показывает действия смены статуса/оплаты (только просмотр + перенос),
// эти действия остаются в списке/колонках "По мастерам" (см. BookingListItem).
export function BookingGridCard({
  booking,
  client,
  master,
  service,
  role,
  isPaid,
  canDragReschedule,
  isDragging,
  busy,
  onReschedule,
  onDragStart,
  onDragEnd,
}: BookingGridCardProps) {
  // canReschedule уже проверяет role === 'ADMIN' сама по себе — canDragReschedule здесь не
  // дублирует, а полностью выключает механизм переноса на уровне MASTER-страницы, независимо
  // от статуса конкретной записи (не переизобретаем правила статусной машины, см. её же).
  const canDrag = canDragReschedule && canReschedule(booking.status, role)

  const title = [
    formatTimeRange(booking.startTime, booking.endTime),
    client?.name ?? 'Клиент не найден',
    service?.name ?? 'Услуга не найдена',
    master?.name,
  ]
    .filter(Boolean)
    .join(' · ')

  const handleDragStart = (event: DragEvent<HTMLLIElement>) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', booking.id)
    onDragStart(booking)
  }

  return (
    <li
      className={`booking-grid-card${isDragging ? ' booking-grid-card--dragging' : ''}`}
      style={{ borderLeftColor: getMasterColor(booking.masterId) }}
      title={title}
      draggable={canDrag}
      onDragStart={canDrag ? handleDragStart : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
    >
      <div className="booking-grid-card-time">{formatTime(booking.startTime)}</div>
      <div className="booking-grid-card-details">
        <strong>{client?.name ?? 'Клиент не найден'}</strong>
        <span>{service?.name ?? 'Услуга не найдена'}</span>
      </div>
      <div className={`booking-grid-card-status ${getStatusBadgeClass(booking.status)}`}>
        {STATUS_LABELS[booking.status]}
        {isPaid && <span className="booking-item-paid-badge">Оплачено</span>}
      </div>
      {canDrag && (
        <button type="button" className="booking-grid-card-reschedule" disabled={busy} onClick={onReschedule}>
          Перенести
        </button>
      )}
    </li>
  )
}
