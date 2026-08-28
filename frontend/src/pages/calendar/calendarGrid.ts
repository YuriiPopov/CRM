import { getIsoWeekRange } from '../dashboard/weekTimeline'
import { toDateOnly } from './dateUtils'

const DAY_MS = 24 * 60 * 60 * 1000

export interface CalendarGridDay {
  date: string
  isToday: boolean
  isCurrentPeriod: boolean
}

// 7 дней ISO-недели (понедельник–воскресенье), содержащей anchorDate — переиспользует
// getIsoWeekRange из недельного таймлайна дашборда (даёт понедельник недели в UTC), см.
// комментарий там про единые часы работы без per-salon таймзоны. isCurrentPeriod всегда
// true — в недельной сетке нет понятия "чужой период", в отличие от месячной.
export function getWeekGridDays(anchorDate: string, todayIso: string = new Date().toISOString()): CalendarGridDay[] {
  const { start } = getIsoWeekRange(new Date(`${anchorDate}T00:00:00.000Z`))
  const today = toDateOnly(todayIso)

  return Array.from({ length: 7 }, (_, i) => {
    const date = toDateOnly(new Date(start.getTime() + i * DAY_MS).toISOString())
    return { date, isToday: date === today, isCurrentPeriod: true }
  })
}

// 42 дня (6 недель) начиная с понедельника, ближайшего к 1-му числу месяца anchorDate
// (включительно, если 1-е само попадает на понедельник) — фиксированная сетка 6×7, как в
// большинстве месячных календарей, даже если календарный месяц укладывается в 4-5 недель.
// isCurrentPeriod=false для дней соседних месяцев, попавших в сетку для заполнения углов.
export function getMonthGridDays(anchorDate: string, todayIso: string = new Date().toISOString()): CalendarGridDay[] {
  const [year, month] = anchorDate.split('-').map(Number)
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1))
  // getUTCDay(): Sunday=0..Saturday=6 → переводим в Monday=0..Sunday=6.
  const isoDayIndex = (firstOfMonth.getUTCDay() + 6) % 7
  const gridStart = new Date(firstOfMonth.getTime() - isoDayIndex * DAY_MS)

  const today = toDateOnly(todayIso)
  const currentYearMonth = anchorDate.slice(0, 7)

  return Array.from({ length: 42 }, (_, i) => {
    const date = toDateOnly(new Date(gridStart.getTime() + i * DAY_MS).toISOString())
    return {
      date,
      isToday: date === today,
      isCurrentPeriod: date.slice(0, 7) === currentYearMonth,
    }
  })
}

// По образцу addDaysToDateOnly в dashboard/dashboardUtils.ts (та функция не экспортирована,
// а копия в 3 строки не стоит того, чтобы ради неё что-то экспортировать из чужого модуля).
function addDaysToDateOnly(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

// Для недели — сдвиг anchor на ±7 дней. Для месяца — сразу 1-е число целевого месяца через
// setUTCMonth (а не "+1 месяц" к произвольному дню anchorDate) — иначе переполнение дня даёт
// неверный месяц (31 января + 1 месяц = 3 марта, а не 1 февраля).
export function navigateGridAnchor(anchorDate: string, layout: 'week' | 'month', direction: 1 | -1): string {
  if (layout === 'week') {
    return addDaysToDateOnly(anchorDate, 7 * direction)
  }

  const [year, month] = anchorDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 + direction, 1)).toISOString().slice(0, 10)
}
