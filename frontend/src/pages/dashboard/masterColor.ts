// Фиксированная палитра для таймлайна дашборда — подобрана достаточно различимой и в светлой,
// и в тёмной теме (см. index.css). Если мастеров в салоне больше, чем цветов, несколько из них
// получат одинаковый цвет — с реальным числом мастеров в салоне маловероятно и не критично
// (легенда всё равно подписывает каждого по имени).
const MASTER_COLOR_PALETTE = [
  '#2563eb', // blue
  '#16a34a', // green
  '#d97706', // amber
  '#db2777', // pink
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#dc2626', // red
  '#65a30d', // lime
]

// Простая (не крипто-) детерминированная хэш-функция строки: сумма кодов символов с
// умножением на 31 на каждом шаге, приведение к unsigned 32-bit — то же самое сочетание,
// что и в Java String.hashCode(). Важно только одно свойство: один и тот же masterId
// ВСЕГДА даёт один и тот же индекс палитры, независимо от порядка загрузки/сессии.
function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

export function getMasterColor(masterId: string): string {
  return MASTER_COLOR_PALETTE[hashString(masterId) % MASTER_COLOR_PALETTE.length]
}
