import {
  canReschedule,
  getAvailableStatusActions,
  getStatusBadgeClass,
  STATUS_ACTION_LABELS,
  STATUS_LABELS,
} from './statusTransitions'
import { formatRescheduledAt, formatTimeRange } from './dateUtils'
import type { Booking, BookingStatus } from '../../types/booking'
import type { Client } from '../../types/client'
import type { Master } from '../../types/staff'
import type { Service } from '../../types/service'
import type { Role } from '../../types/auth'

interface BookingListItemProps {
  booking: Booking
  client: Client | undefined
  master: Master | undefined
  service: Service | undefined
  role: Role
  // Собственный masterId текущего пользователя (useAuth().user.masterId) — только для роли
  // MASTER, чтобы показать "Это вы" вместо резолва через master (см. Backlog item17: на
  // /my-schedule роль MASTER не грузит полный список мастеров, master всегда undefined).
  currentMasterId: string | null
  isPaid: boolean
  canCreatePayment: boolean
  onStatusChange: (status: BookingStatus) => void
  onReschedule: () => void
  onCreatePayment: () => void
  busy: boolean
}

export function BookingListItem({
  booking,
  client,
  master,
  service,
  role,
  currentMasterId,
  isPaid,
  canCreatePayment,
  onStatusChange,
  onReschedule,
  onCreatePayment,
  busy,
}: BookingListItemProps) {
  const statusActions = getAvailableStatusActions(booking.status, role)
  const showReschedule = canReschedule(booking.status, role)
  const isOwnBooking = role === 'MASTER' && booking.masterId === currentMasterId
  const rescheduledLabel = formatRescheduledAt(booking.rescheduledAt)

  return (
    <li
      className={`booking-item booking-item-${booking.status.toLowerCase()}${isPaid ? ' booking-item-paid' : ''}`}
    >
      <div className="booking-item-time">{formatTimeRange(booking.startTime, booking.endTime)}</div>
      <div className="booking-item-details">
        <strong>{client?.name ?? 'Клиент не найден'}</strong>
        <span>{service?.name ?? 'Услуга не найдена'}</span>
        {isOwnBooking ? <span>Это вы</span> : master && <span>{master.name}</span>}
        {rescheduledLabel && <span className="booking-item-rescheduled">{rescheduledLabel}</span>}
      </div>
      <div className={`booking-item-status ${getStatusBadgeClass(booking.status)}`}>
        {STATUS_LABELS[booking.status]}
        {isPaid && <span className="booking-item-paid-badge">Оплачено</span>}
      </div>
      <div className="booking-item-actions">
        {statusActions.map((status) => (
          <button
            key={status}
            type="button"
            disabled={busy}
            onClick={() => onStatusChange(status)}
          >
            {STATUS_ACTION_LABELS[status]}
          </button>
        ))}
        {showReschedule && (
          <button type="button" disabled={busy} onClick={onReschedule}>
            Перенести
          </button>
        )}
        {canCreatePayment && (
          <button type="button" disabled={busy} onClick={onCreatePayment}>
            Создать оплату
          </button>
        )}
      </div>
    </li>
  )
}
