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
