import type { MasterBlock } from '../../types/masterBlock'

// "Кем создана" подпись для карточки блокировки — заменяет попытку показать имя мастера
// через mastersById (недоступно роли MASTER, см. диагностику fallback 'Мастер не найден'
// в ScheduleBlockItem/timeline.ts). null для блокировок без createdByRole — записи до
// миграции, добавившей createdById в MasterBlock: подписи просто не показываем, без
// слова "не найден" (Backlog).
export function masterBlockCreatedByLabel(block: MasterBlock): string | null {
  if (block.createdBySelf) return 'Создано вами'
  if (block.createdByRole === 'ADMIN') return 'Создано администратором'
  if (block.createdByRole === 'MASTER') return 'Создано мастером'
  return null
}
