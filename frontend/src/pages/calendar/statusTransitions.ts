import type { BookingStatus } from '../../types/booking'
import type { Role } from '../../types/auth'

// Зеркалит src/bookings/bookings.service.ts (backend) — конечный автомат статусов записи.
// COMPLETED/CANCELLED терминальны, дальнейших переходов нет.
const STATE_MACHINE: Record<BookingStatus, BookingStatus[]> = {
  CREATED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

// MASTER отмечает выполнение/отмену своих записей; подтверждение (CONFIRMED) — действие ADMIN
// (зеркалит backend: updateStatus в bookings.service.ts). Итог — пересечение машины состояний
// и того, что разрешено роли: backend всё равно остаётся источником истины, это только для UI.
export function getAvailableStatusActions(status: BookingStatus, role: Role): BookingStatus[] {
  const allowedByStateMachine = STATE_MACHINE[status]

  if (role === 'ADMIN') {
    return allowedByStateMachine
  }

  return allowedByStateMachine.filter(
    (next) => next === 'COMPLETED' || next === 'CANCELLED',
  )
}

// Перенос времени/мастера — только ADMIN и только для незавершённой/неотменённой записи
// (backend: PATCH /bookings/:id/reschedule защищён @Roles(ADMIN), плюс проверка статуса).
export function canReschedule(status: BookingStatus, role: Role): boolean {
  return role === 'ADMIN' && status !== 'COMPLETED' && status !== 'CANCELLED'
}

export const STATUS_LABELS: Record<BookingStatus, string> = {
  CREATED: 'Создана',
  CONFIRMED: 'Подтверждена',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
}

export const STATUS_ACTION_LABELS: Record<BookingStatus, string> = {
  CREATED: 'Вернуть в «Создана»',
  CONFIRMED: 'Подтвердить',
  COMPLETED: 'Завершить',
  CANCELLED: 'Отменить',
}

// Единственное место, где статус записи сопоставляется с цветом бейджа (см. .status-badge-*
// в App.css) — переиспользуется везде, где статус выводится текстом (BookingListItem в
// Календаре, история записей клиента, "Ближайшие записи" на Дашборде), чтобы не дублировать
// раскраску по компонентам.
const STATUS_BADGE_CLASS: Record<BookingStatus, string> = {
  CREATED: 'status-badge-created',
  CONFIRMED: 'status-badge-confirmed',
  COMPLETED: 'status-badge-completed',
  CANCELLED: 'status-badge-cancelled',
}

export function getStatusBadgeClass(status: BookingStatus): string {
  return STATUS_BADGE_CLASS[status]
}
