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
