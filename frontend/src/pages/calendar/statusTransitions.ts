import type { BookingStatus } from '../../types/booking'
import type { Role } from '../../types/auth'

// Зеркалит src/bookings/bookings.service.ts (backend) — конечный автомат статусов записи.
// COMPLETED/CANCELLED/NO_SHOW терминальны, дальнейших переходов нет.
const STATE_MACHINE: Record<BookingStatus, BookingStatus[]> = {
  CREATED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
}

const TERMINAL_STATUSES: BookingStatus[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW']

// MASTER отмечает выполнение/отмену своих записей; подтверждение (CONFIRMED) — действие ADMIN
// (зеркалит backend: updateStatus в bookings.service.ts). Итог — пересечение машины состояний
// и того, что разрешено роли: backend всё равно остаётся источником истины, это только для UI.
// «Не пришёл» (NO_SHOW, item74) — только ADMIN и только когда время начала уже наступило;
// без startTime действие не предлагается.
export function getAvailableStatusActions(
  status: BookingStatus,
  role: Role,
  startTime?: string,
  now: number = Date.now(),
): BookingStatus[] {
  const hasStarted = startTime !== undefined && new Date(startTime).getTime() <= now
  const allowedByStateMachine = STATE_MACHINE[status].filter(
    (next) => next !== 'NO_SHOW' || hasStarted,
  )

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
  return role === 'ADMIN' && !TERMINAL_STATUSES.includes(status)
}

export const STATUS_LABELS: Record<BookingStatus, string> = {
  CREATED: 'Создана',
  CONFIRMED: 'Подтверждена',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
  NO_SHOW: 'Не пришёл',
}

export const STATUS_ACTION_LABELS: Record<BookingStatus, string> = {
  CREATED: 'Вернуть в «Создана»',
  CONFIRMED: 'Подтвердить',
  COMPLETED: 'Завершить',
  CANCELLED: 'Отменить',
  NO_SHOW: 'Не пришёл',
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
  NO_SHOW: 'status-badge-no-show',
}

export function getStatusBadgeClass(status: BookingStatus): string {
  return STATUS_BADGE_CLASS[status]
}
