import type { MasterBlock } from '../../types/masterBlock'
import { isBlockOnDay } from './filterBlocksForDay'

// Аналог groupBookingsByDay для блокировок времени мастера. Блок может пересекать полночь
// (см. isBlockOnDay), поэтому пересечение проверяется отдельно для каждой даты сетки — один
// и тот же многодневный блок попадает в бакет каждого дня, который он занимает, а не только
// дня своего toDateOnly(startTime).
export function groupBlocksByDay(blocks: MasterBlock[], dates: string[]): Map<string, MasterBlock[]> {
  const byDay = new Map<string, MasterBlock[]>(
    dates.map((date) => [date, blocks.filter((block) => isBlockOnDay(block, date))]),
  )

  for (const bucket of byDay.values()) {
    bucket.sort((a, b) => a.startTime.localeCompare(b.startTime))
  }

  return byDay
}
