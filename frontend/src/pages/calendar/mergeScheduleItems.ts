import type { Booking } from '../../types/booking'
import type { MasterBlock } from '../../types/masterBlock'

export type ScheduleItem = { kind: 'booking'; booking: Booking } | { kind: 'block'; block: MasterBlock }

function startTimeOf(item: ScheduleItem): string {
  return item.kind === 'booking' ? item.booking.startTime : item.block.startTime
}

// Записи и блокировки времени мастера раньше рендерились двумя отдельными списками (все
// блокировки, потом все записи), так что блокировка на 15:00 оказывалась выше записи на
// 10:00 — здесь оба типа сливаются в один список и сортируются по startTime, чтобы порядок
// на экране совпадал с хронологией дня (Backlog item48). Используется во всех местах,
// показывающих записи и блокировки вперемешку: CalendarPage ("Список"), CalendarGridView
// ("Неделя"/"Месяц"), MasterColumnsView ("По мастерам").
export function mergeScheduleItems(bookings: Booking[], blocks: MasterBlock[]): ScheduleItem[] {
  const items: ScheduleItem[] = [
    ...bookings.map((booking): ScheduleItem => ({ kind: 'booking', booking })),
    ...blocks.map((block): ScheduleItem => ({ kind: 'block', block })),
  ]
  return items.sort((a, b) => startTimeOf(a).localeCompare(startTimeOf(b)))
}
