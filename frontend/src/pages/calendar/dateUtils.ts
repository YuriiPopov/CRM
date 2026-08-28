// Слоты и время записей всегда в UTC (см. backend MVP-упрощение — единые часы работы 09:00–20:00 UTC,
// без per-salon таймзоны), поэтому и здесь время форматируется в UTC, а не в локальной таймзоне
// браузера — иначе "09:00" на экране не совпадало бы с тем, что реально хранится/проверяется на бэкенде.
export function toDateOnly(iso: string): string {
  return iso.slice(0, 10)
}

export function todayDateOnly(): string {
  return toDateOnly(new Date().toISOString())
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)}–${formatTime(endIso)}`
}

// Перенос записи в сетке недели/месяца двигает только день — время суток и длительность
// сохраняются как есть, меняются лишь год/месяц/день исходного момента (UTC, как и весь
// остальной таймлайн — см. комментарий выше про единые часы работы без per-salon таймзоны).
export function shiftIsoToDateOnly(iso: string, targetDateOnly: string): string {
  const [year, month, day] = targetDateOnly.split('-').map(Number)
  const date = new Date(iso)
  date.setUTCFullYear(year, month - 1, day)
  return date.toISOString()
}
