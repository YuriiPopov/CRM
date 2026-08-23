import type { MasterBlock } from '../../types/masterBlock'
import { isBlockOnDay } from './filterBlocksForDay'

// Блоки конкретного мастера на выбранный день, отсортированные по времени начала —
// аналог groupBookingsByMaster.ts, но для MasterColumnsView понадобилась ключ-по-masterId
// карта, а не массив колонок (сама колонка уже строится из masters в groupBookingsByMaster).
export function groupBlocksByMaster(blocks: MasterBlock[], date: string): Map<string, MasterBlock[]> {
  const byMaster = new Map<string, MasterBlock[]>()

  for (const block of blocks) {
    if (!isBlockOnDay(block, date)) continue
    const list = byMaster.get(block.masterId) ?? []
    list.push(block)
    byMaster.set(block.masterId, list)
  }

  for (const list of byMaster.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime))
  }

  return byMaster
}
