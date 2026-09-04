import type { Booking, BookingStatus } from '../../types/booking'
import type { Master } from '../../types/staff'
import type { MasterBlock } from '../../types/masterBlock'
import type { MasterScheduleRecord } from '../../types/masterSchedule'

// "Активные" в терминах таймлайна дашборда — CANCELLED осознанно исключены: отменённые записи
// не требуют внимания сегодня и только загромождали бы компактный виджет (см. backlog п.3).
export const ACTIVE_TIMELINE_STATUSES: BookingStatus[] = ['CREATED', 'CONFIRMED', 'COMPLETED']

export function filterActiveTimelineBookings(bookings: Booking[]): Booking[] {
  return bookings.filter((booking) => ACTIVE_TIMELINE_STATUSES.includes(booking.status))
}

// Единая шкала рабочего дня салона — 09:00–19:00 UTC (см. комментарий в dateUtils.ts:
// backend MVP-упрощение, единые часы работы без per-salon таймзоны).
export const TIMELINE_START_HOUR = 9
export const TIMELINE_END_HOUR = 19

// Минимальная ширина блока в процентах — иначе очень короткая запись (например, 5 минут)
// выродилась бы в невидимую линию.
const MIN_BLOCK_WIDTH_PERCENT = 1.5

export interface TimelineBlock {
  booking: Booking
  leftPercent: number
  widthPercent: number
}

function minutesSinceUtcMidnight(iso: string): number {
  const date = new Date(iso)
  return date.getUTCHours() * 60 + date.getUTCMinutes()
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Раскладывает записи на шкале 09:00–19:00 UTC в процентах от ширины полосы. Время за
// пределами окна прижимается к его границе (а не "убегает" за пределы таймлайна) — запись,
// начавшаяся до открытия или закончившаяся после закрытия, всё равно видна целиком в пределах
// полосы. Порядок результата совпадает с порядком bookings на входе.
export function layoutBookingsOnTimeline(bookings: Booking[]): TimelineBlock[] {
  const windowStart = TIMELINE_START_HOUR * 60
  const windowEnd = TIMELINE_END_HOUR * 60
  const windowMinutes = windowEnd - windowStart

  return bookings.map((booking) => {
    const startMinutes = clamp(minutesSinceUtcMidnight(booking.startTime), windowStart, windowEnd)
    const endMinutes = clamp(minutesSinceUtcMidnight(booking.endTime), windowStart, windowEnd)

    const leftPercent = ((startMinutes - windowStart) / windowMinutes) * 100
    const widthPercent = Math.max(
      ((endMinutes - startMinutes) / windowMinutes) * 100,
      MIN_BLOCK_WIDTH_PERCENT,
    )

    return { booking, leftPercent, widthPercent }
  })
}

export interface TimelineUnavailableBlock {
  block: MasterBlock
  leftPercent: number
  widthPercent: number
}

// Та же раскладка на шкале 09:00–19:00 UTC, что и layoutBookingsOnTimeline, но для блокировок
// времени мастера (Backlog п.9/п.11) — отдельная функция, а не переиспользование той же сигнатуры,
// т.к. MasterBlock не является Booking (нет клиента/услуги/статуса).
export function layoutMasterBlocksOnTimeline(blocks: MasterBlock[]): TimelineUnavailableBlock[] {
  const windowStart = TIMELINE_START_HOUR * 60
  const windowEnd = TIMELINE_END_HOUR * 60
  const windowMinutes = windowEnd - windowStart

  return blocks.map((block) => {
    const startMinutes = clamp(minutesSinceUtcMidnight(block.startTime), windowStart, windowEnd)
    const endMinutes = clamp(minutesSinceUtcMidnight(block.endTime), windowStart, windowEnd)

    const leftPercent = ((startMinutes - windowStart) / windowMinutes) * 100
    const widthPercent = Math.max(
      ((endMinutes - startMinutes) / windowMinutes) * 100,
      MIN_BLOCK_WIDTH_PERCENT,
    )

    return { block, leftPercent, widthPercent }
  })
}

export interface TimelineScheduleSegment {
  leftPercent: number
  widthPercent: number
}

function minutesSinceMidnightFromTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// item50 — недоступность мастера по графику работ (MasterSchedule) на полосе дневного
// таймлайна. В отличие от unavailableFractions (masterScheduleAvailability.ts), который
// сравнивает с полными сутками для дневной ячейки календаря, здесь окно — те же 09:00–19:00,
// что и у layoutBookingsOnTimeline/layoutMasterBlocksOnTimeline, потому что сама полоса
// изображает только это окно, а не сутки целиком. Полный выходной (isWorking: false) —
// один сегмент на всю ширину полосы; частичная недоступность — сегмент до startTime и/или
// после endTime, обрезанный по границам окна (сегмента с той стороны нет, если рабочие часы
// мастера покрывают окно целиком с этой стороны). Запись без ограничения по startTime/endTime
// не бывает у рабочего дня (см. buildPartialAvailabilityByDate) — если они всё же не заданы,
// достаточно достоверных данных для штриховки нет, сегменты не строятся.
export function scheduleUnavailableSegments(
  record: MasterScheduleRecord | undefined,
): TimelineScheduleSegment[] {
  if (!record) return []

  const windowStart = TIMELINE_START_HOUR * 60
  const windowEnd = TIMELINE_END_HOUR * 60
  const windowMinutes = windowEnd - windowStart

  if (!record.isWorking) {
    return [{ leftPercent: 0, widthPercent: 100 }]
  }

  if (!record.startTime || !record.endTime) return []

  const segments: TimelineScheduleSegment[] = []
  const startMinutes = minutesSinceMidnightFromTime(record.startTime)
  const endMinutes = minutesSinceMidnightFromTime(record.endTime)

  if (startMinutes > windowStart) {
    const clampedStartMinutes = clamp(startMinutes, windowStart, windowEnd)
    segments.push({ leftPercent: 0, widthPercent: ((clampedStartMinutes - windowStart) / windowMinutes) * 100 })
  }

  if (endMinutes < windowEnd) {
    const clampedEndMinutes = clamp(endMinutes, windowStart, windowEnd)
    segments.push({
      leftPercent: ((clampedEndMinutes - windowStart) / windowMinutes) * 100,
      widthPercent: ((windowEnd - clampedEndMinutes) / windowMinutes) * 100,
    })
  }

  return segments
}

export interface TimelineRow {
  masterId: string
  masterName: string
  blocks: TimelineBlock[]
  unavailableBlocks: TimelineUnavailableBlock[]
  scheduleUnavailable: TimelineScheduleSegment[]
}

// Ширина подписи в строке таймлайна дашборда фиксирована (см. .dashboard-timeline-row-label
// в App.css), поэтому имя усекается по числу символов, а не через CSS text-overflow — так
// результат не зависит от фактической ширины конкретных глифов и все строки таймлайна
// начинаются с одного и того же места независимо от длины имени мастера (item45).
export const TIMELINE_MASTER_NAME_MAX_LENGTH = 12

export function truncateMasterName(name: string): string {
  return name.length > TIMELINE_MASTER_NAME_MAX_LENGTH
    ? `${name.slice(0, TIMELINE_MASTER_NAME_MAX_LENGTH)}…`
    : name
}

// Одна строка на каждого мастера, у которого сегодня есть хотя бы одна запись, блокировка
// времени (Backlog п.9/п.11), ИЛИ недоступность по графику работ (item50) — в отличие от
// groupBookingsByMaster (Календарь, режим "По мастерам"), НЕ создаёт пустых строк для мастеров
// без записей/блокировок/недоступности по графику: для компактного таймлайна дашборда нужны
// только реально занятые/недоступные сегодня (см. backlog п.3). Раскладка внутри строки — та же
// layoutBookingsOnTimeline/layoutMasterBlocksOnTimeline/scheduleUnavailableSegments, что и для
// одиночной полосы, применённая к подмножеству этого мастера. Строки отсортированы по имени
// мастера для стабильного порядка между рендерами. masterBlocks/todayScheduleByMasterId по
// умолчанию пусты — старые вызовы (без п.11/item50) не ломаются.
export function groupTimelineBlocksByMaster(
  bookings: Booking[],
  masters: Master[],
  masterBlocks: MasterBlock[] = [],
  todayScheduleByMasterId: Map<string, MasterScheduleRecord> = new Map(),
): TimelineRow[] {
  const mastersById = new Map(masters.map((master) => [master.id, master]))
  const bookingsByMasterId = new Map<string, Booking[]>()
  const blocksByMasterId = new Map<string, MasterBlock[]>()

  for (const booking of bookings) {
    const existing = bookingsByMasterId.get(booking.masterId)
    if (existing) {
      existing.push(booking)
    } else {
      bookingsByMasterId.set(booking.masterId, [booking])
    }
  }

  for (const block of masterBlocks) {
    const existing = blocksByMasterId.get(block.masterId)
    if (existing) {
      existing.push(block)
    } else {
      blocksByMasterId.set(block.masterId, [block])
    }
  }

  const scheduleUnavailableByMasterId = new Map<string, TimelineScheduleSegment[]>()
  for (const [masterId, record] of todayScheduleByMasterId) {
    const segments = scheduleUnavailableSegments(record)
    if (segments.length > 0) {
      scheduleUnavailableByMasterId.set(masterId, segments)
    }
  }

  const masterIds = new Set([
    ...bookingsByMasterId.keys(),
    ...blocksByMasterId.keys(),
    ...scheduleUnavailableByMasterId.keys(),
  ])

  return Array.from(masterIds)
    .map((masterId) => ({
      masterId,
      masterName: mastersById.get(masterId)?.name ?? 'Мастер не найден',
      blocks: layoutBookingsOnTimeline(bookingsByMasterId.get(masterId) ?? []),
      unavailableBlocks: layoutMasterBlocksOnTimeline(blocksByMasterId.get(masterId) ?? []),
      scheduleUnavailable: scheduleUnavailableByMasterId.get(masterId) ?? [],
    }))
    .sort((a, b) => a.masterName.localeCompare(b.masterName))
}
