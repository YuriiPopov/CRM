import { toDateOnly } from './dateUtils'
import { TIMELINE_END_HOUR, TIMELINE_START_HOUR } from '../dashboard/timeline'
import type { MasterScheduleRecord } from '../../types/masterSchedule'

// GET /master-schedules принимает один месяц за раз — при недельной/месячной сетке,
// пересекающей границу месяца (или сетке "42 дня" с хвостами соседних месяцев), нужно
// запросить график ровно по разу на каждый затронутый месяц, без дублей.
export function distinctYearMonths(dates: string[]): { year: number; month: number }[] {
  const seen = new Set<string>()
  const result: { year: number; month: number }[] = []

  for (const date of dates) {
    const [year, month] = date.split('-').map(Number)
    const key = `${year}-${month}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push({ year, month })
    }
  }

  return result
}

// Только явно нерабочие дни (isWorking: false) блокируют — "не размечено" (записи вовсе нет)
// в этот набор не попадает и блокировкой не считается (см. MasterSchedulesService, item28 №33).
export function buildBlockedDatesSet(records: MasterScheduleRecord[]): Set<string> {
  return new Set(records.filter((record) => !record.isWorking).map((record) => toDateOnly(record.date)))
}

// Для режима "По мастерам" (один день, несколько мастеров) — какие из мастеров нерабочие
// именно на этот день, и должны быть скрыты из колонок целиком (см. MasterColumnsView).
export function findMastersBlockedOnDate(
  scheduleByMasterId: Map<string, MasterScheduleRecord[]>,
  date: string,
): Set<string> {
  const blocked = new Set<string>()

  for (const [masterId, records] of scheduleByMasterId) {
    const dayRecord = records.find((record) => toDateOnly(record.date) === date)
    if (dayRecord && !dayRecord.isWorking) {
      blocked.add(masterId)
    }
  }

  return blocked
}

export interface PartialAvailability {
  startTime: string
  endTime: string
}

// item49 — дни, рабочие (isWorking: true), но с часами, ограниченными startTime/endTime
// (buildUpsertDays в masterScheduleGrid.ts всегда пишет их вместе для 'working', так что null
// у одного из двух практически не встречается — проверка обоих лишь отражает то, что тип
// MasterScheduleRecord их всё же допускает). Дни без ограничения часов сюда не нужны — их
// в MasterSchedule не бывает (см. DEFAULT_START_TIME/DEFAULT_END_TIME), полностью нерабочие
// дни уже покрыты buildBlockedDatesSet.
export function buildPartialAvailabilityByDate(
  records: MasterScheduleRecord[],
): Map<string, PartialAvailability> {
  const result = new Map<string, PartialAvailability>()

  for (const record of records) {
    if (record.isWorking && record.startTime && record.endTime) {
      result.set(toDateOnly(record.date), { startTime: record.startTime, endTime: record.endTime })
    }
  }

  return result
}

function minutesSinceMidnight(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// item52 — исправляет item49: доля недоступности считалась от полных суток (00:00–24:00), из-за
// чего частично рабочий день (напр. 09:00–15:00) выглядел заштрихованным почти как выходной.
// Окно сравнения теперь то же самое рабочее окно салона (09:00–19:00), что и у
// scheduleUnavailableSegments (item50, dashboard/timeline.ts) — единый источник правды на оба
// экрана. startTime/endTime вне окна (в т.ч. старые записи до ограничения min/max в
// MasterScheduleModal) обрезаются по границам окна, поэтому результат всегда в [0, 100].
export function unavailableFractions(
  startTime: string,
  endTime: string,
): { topPercent: number; bottomPercent: number } {
  const windowStart = TIMELINE_START_HOUR * 60
  const windowEnd = TIMELINE_END_HOUR * 60
  const windowMinutes = windowEnd - windowStart

  const clampedStart = clamp(minutesSinceMidnight(startTime), windowStart, windowEnd)
  const clampedEnd = clamp(minutesSinceMidnight(endTime), windowStart, windowEnd)

  return {
    topPercent: ((clampedStart - windowStart) / windowMinutes) * 100,
    bottomPercent: ((windowEnd - clampedEnd) / windowMinutes) * 100,
  }
}
