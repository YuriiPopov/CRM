import { toDateOnly } from '../calendar/dateUtils'
import { TIMELINE_END_HOUR, TIMELINE_START_HOUR } from '../dashboard/timeline'
import type { MasterScheduleDayInput } from '../../api/masterSchedules'
import type { MasterScheduleRecord } from '../../types/masterSchedule'

// Часы работы салона (см. TIMELINE_START_HOUR/TIMELINE_END_HOUR в dashboard/timeline.ts, те же
// часы, что и SALON_OPEN_TIME/SALON_CLOSE_TIME в MasterScheduleModal.tsx — item52) — дефолтное
// время для дня, отмеченного рабочим без явно указанных часов (item53).
export const DEFAULT_START_TIME = `${String(TIMELINE_START_HOUR).padStart(2, '0')}:00`
export const DEFAULT_END_TIME = `${String(TIMELINE_END_HOUR).padStart(2, '0')}:00`

// 'unset' = день ещё не размечен администратором (записи в MasterSchedule нет вовсе) — нейтральное
// состояние, отличное от 'off' (явно отмеченный выходной). См. MasterScheduleRecord.
export type ScheduleDayStatus = 'unset' | 'working' | 'off'

export interface ScheduleDayState {
  status: ScheduleDayStatus
  startTime: string
  endTime: string
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function buildMonthDates(year: number, month: number): string[] {
  const total = daysInMonth(year, month)
  const mm = String(month).padStart(2, '0')
  return Array.from({ length: total }, (_, index) => `${year}-${mm}-${String(index + 1).padStart(2, '0')}`)
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 }
}

export function formatMonthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// Строит начальное состояние сетки: по умолчанию каждый день месяца — 'unset', поверх
// накладываются загруженные записи графика (isWorking=true/false).
export function buildDayStates(
  dates: string[],
  records: MasterScheduleRecord[],
): Map<string, ScheduleDayState> {
  const recordsByDate = new Map(records.map((record) => [toDateOnly(record.date), record]))
  const result = new Map<string, ScheduleDayState>()

  for (const date of dates) {
    const record = recordsByDate.get(date)
    if (!record) {
      result.set(date, { status: 'unset', startTime: DEFAULT_START_TIME, endTime: DEFAULT_END_TIME })
    } else if (record.isWorking) {
      result.set(date, {
        status: 'working',
        startTime: record.startTime ?? DEFAULT_START_TIME,
        endTime: record.endTime ?? DEFAULT_END_TIME,
      })
    } else {
      result.set(date, { status: 'off', startTime: DEFAULT_START_TIME, endTime: DEFAULT_END_TIME })
    }
  }

  return result
}

// 'unset' дни не попадают в PUT — они "ещё не размечены", их и не нужно трогать
// (см. MasterSchedulesService.upsertMonth на бэкенде: не переданные дни не трогаются).
export function buildUpsertDays(dayStates: Map<string, ScheduleDayState>): MasterScheduleDayInput[] {
  const days: MasterScheduleDayInput[] = []

  for (const [date, state] of dayStates) {
    if (state.status === 'unset') continue

    days.push(
      state.status === 'working'
        ? { date, isWorking: true, startTime: state.startTime, endTime: state.endTime }
        : { date, isWorking: false },
    )
  }

  return days
}
