import type { MasterBlock } from '../../types/masterBlock'
import { ALL_MASTERS } from './filterBookings'

// Блокировка может пересекать полночь (например, "с вечера пятницы до утра понедельника"),
// поэтому день сравнивается по пересечению интервалов, а не по toDateOnly(startTime) —
// иначе блок, начавшийся накануне, не показался бы на дне, который он всё ещё занимает.
export function filterBlocksForDay(
  blocks: MasterBlock[],
  date: string,
  masterId: string = ALL_MASTERS,
): MasterBlock[] {
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd = `${date}T23:59:59.999Z`

  return blocks
    .filter((block) => block.startTime <= dayEnd && block.endTime >= dayStart)
    .filter((block) => masterId === ALL_MASTERS || block.masterId === masterId)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

// Для колонок "По мастерам" — та же логика пересечения дня, без фильтра по мастеру
// (сама группировка по мастеру делается снаружи через groupBlocksByMaster).
export function isBlockOnDay(block: MasterBlock, date: string): boolean {
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd = `${date}T23:59:59.999Z`
  return block.startTime <= dayEnd && block.endTime >= dayStart
}
