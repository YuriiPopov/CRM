import type { Booking } from '../../types/booking'
import type { Master } from '../../types/staff'
import type { MasterBlock } from '../../types/masterBlock'
import { toDateOnly } from '../calendar/dateUtils'
import { filterActiveTimelineBookings } from './timeline'

const DAY_MS = 24 * 60 * 60 * 1000

// ISO-неделя (понедельник–воскресенье), содержащая date — в отличие от "7 дней от сегодня".
// Всё в UTC, как и остальной таймлайн дашборда (см. комментарий в timeline.ts про единые часы
// работы без per-salon таймзоны) — иначе граница недели "плавала" бы в зависимости от таймзоны
// браузера. start — понедельник 00:00:00.000, end — воскресенье 23:59:59.999.
export function getIsoWeekRange(date: Date): { start: Date; end: Date } {
  const utcMidnight = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  // getUTCDay(): Sunday=0..Saturday=6 → переводим в Monday=0..Sunday=6.
  const isoDayIndex = (utcMidnight.getUTCDay() + 6) % 7
  const start = new Date(utcMidnight.getTime() - isoDayIndex * DAY_MS)
  const end = new Date(start.getTime() + 7 * DAY_MS - 1)
  return { start, end }
}

export interface WeekTimelineBar {
  booking: Booking
  masterId: string
  masterName: string
}

// Блокировка времени мастера (Backlog п.9/п.11), приходящаяся на конкретный день недели —
// параллельная WeekTimelineBar структура, как TimelineUnavailableBlock рядом с TimelineBlock
// в timeline.ts: MasterBlock не является Booking (нет клиента/услуги/статуса).
export interface WeekTimelineUnavailableBar {
  block: MasterBlock
  masterId: string
  masterName: string
}

export interface WeekDayColumn {
  date: string
  isToday: boolean
  bars: WeekTimelineBar[]
  unavailableBars: WeekTimelineUnavailableBar[]
}

// Раскладывает записи недели по 7 дням (weekStart — понедельник 00:00, см. getIsoWeekRange) —
// в отличие от groupTimelineBlocksByMaster (строка на каждого мастера дня), здесь ровно 7 колонок
// всегда, включая пустые дни: колонка нужна для рамки "сегодня" и как якорь недели, даже без
// записей. Внутри дня полосочки сгруппированы по мастеру (сортировка по имени, как в
// groupTimelineBlocksByMaster) — без вычисления left/width, все полосочки одного фиксированного
// размера (счётчик загрузки, а не шкала времени). masterBlocks по умолчанию пуст — старые вызовы
// не ломаются, тот же приём, что и у groupTimelineBlocksByMaster.
export function groupBookingsByDayAndMaster(
  bookings: Booking[],
  masters: Master[],
  weekStart: Date,
  masterBlocks: MasterBlock[] = [],
  todayIso: string = new Date().toISOString(),
): WeekDayColumn[] {
  const mastersById = new Map(masters.map((master) => [master.id, master]))
  const masterName = (masterId: string) => mastersById.get(masterId)?.name ?? 'Мастер не найден'
  const byMasterThenStart = <T extends { masterId: string; startTime: string }>(a: T, b: T) => {
    const byName = masterName(a.masterId).localeCompare(masterName(b.masterId))
    return byName !== 0 ? byName : a.startTime.localeCompare(b.startTime)
  }

  const bookingsByDate = new Map<string, Booking[]>()
  for (const booking of filterActiveTimelineBookings(bookings)) {
    const date = toDateOnly(booking.startTime)
    const existing = bookingsByDate.get(date)
    if (existing) {
      existing.push(booking)
    } else {
      bookingsByDate.set(date, [booking])
    }
  }

  const today = toDateOnly(todayIso)

  return Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(weekStart.getTime() + i * DAY_MS)
    const dayEnd = new Date(dayStart.getTime() + DAY_MS - 1)
    const date = toDateOnly(dayStart.toISOString())

    const bars = (bookingsByDate.get(date) ?? [])
      .slice()
      .sort(byMasterThenStart)
      .map((booking) => ({
        booking,
        masterId: booking.masterId,
        masterName: masterName(booking.masterId),
      }))

    // Многодневная блокировка (например, отпуск) попадает в колонку каждого дня, который она
    // пересекает, — то же пересечение по обеим границам, что и todayMasterBlocks в DashboardPage,
    // но применённое к каждому из 7 дней недели, а не только к сегодняшним суткам.
    const unavailableBars = masterBlocks
      .filter((block) => new Date(block.startTime) <= dayEnd && new Date(block.endTime) >= dayStart)
      .slice()
      .sort(byMasterThenStart)
      .map((block) => ({
        block,
        masterId: block.masterId,
        masterName: masterName(block.masterId),
      }))

    return { date, isToday: date === today, bars, unavailableBars }
  })
}
