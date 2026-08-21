export interface DateRange {
  from: string
  to: string
}

export type PresetKey = 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth'

export const PRESET_LABELS: Record<PresetKey, string> = {
  today: 'Сегодня',
  thisWeek: 'Эта неделя',
  thisMonth: 'Этот месяц',
  lastMonth: 'Прошлый месяц',
}

function parseDateOnly(dateOnly: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateOnly.split('-').map(Number)
  return { year, month, day }
}

function addDaysToDateOnly(dateOnly: string, days: number): string {
  const { year, month, day } = parseDateOnly(dateOnly)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function startOfWeek(dateOnly: string): string {
  const { year, month, day } = parseDateOnly(dateOnly)
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay() // 0=вс..6=сб
  const daysSinceMonday = (dayOfWeek + 6) % 7
  return addDaysToDateOnly(dateOnly, -daysSinceMonday)
}

function startOfMonth(dateOnly: string): string {
  return `${dateOnly.slice(0, 7)}-01`
}

function endOfMonth(dateOnly: string): string {
  const { year, month } = parseDateOnly(dateOnly)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${dateOnly.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`
}

function shiftMonthStart(dateOnly: string, deltaMonths: number): string {
  const { year, month } = parseDateOnly(dateOnly)
  const total = year * 12 + (month - 1) + deltaMonths
  const newYear = Math.floor(total / 12)
  const newMonth = (total % 12) + 1
  return `${newYear}-${String(newMonth).padStart(2, '0')}-01`
}

// Пресеты считаются от "сегодня" (date-only, UTC — как и весь остальной день/время в проекте,
// см. calendar/dateUtils.ts): "эта неделя"/"этот месяц" заканчиваются сегодня, а не в будущем.
export function presetRange(preset: PresetKey, todayDateOnly: string): DateRange {
  switch (preset) {
    case 'today':
      return { from: todayDateOnly, to: todayDateOnly }
    case 'thisWeek':
      return { from: startOfWeek(todayDateOnly), to: todayDateOnly }
    case 'thisMonth':
      return { from: startOfMonth(todayDateOnly), to: todayDateOnly }
    case 'lastMonth': {
      const lastMonthStart = shiftMonthStart(startOfMonth(todayDateOnly), -1)
      return { from: lastMonthStart, to: endOfMonth(lastMonthStart) }
    }
  }
}

// GET /payments/report/revenue валидирует from/to как @IsDateString и требует from <= to
// (см. RevenueReportQueryDto/PaymentsService на бэкенде) — здесь та же проверка плюс
// "не в будущем", которую бэкенд не делает (там просто не найдётся оплат).
export function validateRange(range: DateRange, todayDateOnly: string): string | null {
  if (!range.from || !range.to) {
    return 'Укажите обе даты периода.'
  }
  if (range.from > range.to) {
    return 'Дата «с» не может быть позже даты «по».'
  }
  if (range.to > todayDateOnly) {
    return 'Период не может уходить в будущее.'
  }
  return null
}

// "to" в запросе к API должен покрывать весь последний день диапазона, а не только полночь
// (бэкенд сравнивает paidAt через lte(new Date(to)) — без времени это отрезало бы почти весь день).
export function toInclusiveEndOfDayIso(dateOnly: string): string {
  return `${dateOnly}T23:59:59.999Z`
}
