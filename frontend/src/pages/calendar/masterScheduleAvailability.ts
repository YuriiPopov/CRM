import { toDateOnly } from './dateUtils'
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

const MINUTES_PER_DAY = 24 * 60

function minutesSinceMidnight(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// item49 — доля суток (в процентах) до startTime и после endTime, чтобы CalendarGridView мог
// отрисовать недоступную часть ячейки дня пропорционально её реальной продолжительности
// (сравнение всегда с полными сутками 00:00–24:00, а не с часами работы салона — см. задачу).
export function unavailableFractions(
  startTime: string,
  endTime: string,
): { topPercent: number; bottomPercent: number } {
  return {
    topPercent: (minutesSinceMidnight(startTime) / MINUTES_PER_DAY) * 100,
    bottomPercent: ((MINUTES_PER_DAY - minutesSinceMidnight(endTime)) / MINUTES_PER_DAY) * 100,
  }
}
