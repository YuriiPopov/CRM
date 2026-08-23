import { formatTimeRange } from './dateUtils'
import type { MasterBlock } from '../../types/masterBlock'
import type { Master } from '../../types/staff'

interface ScheduleBlockItemProps {
  block: MasterBlock
  master: Master | undefined
  // Скрыт для По-мастерам колонок (там мастер и так ясен из заголовка колонки)
  showMasterName: boolean
  canDelete: boolean
  onDelete: () => void
  busy: boolean
}

// Заблокированное время мастера (Backlog п.9) — визуально отличается от карточки записи
// (серая, без статуса/действий кроме удаления), но использует тот же контейнер .booking-item,
// чтобы аккуратно встраиваться и в плоский список, и в колонки "По мастерам".
export function ScheduleBlockItem({
  block,
  master,
  showMasterName,
  canDelete,
  onDelete,
  busy,
}: ScheduleBlockItemProps) {
  return (
    <li className="booking-item schedule-block-item">
      <div className="booking-item-time">{formatTimeRange(block.startTime, block.endTime)}</div>
      <div className="booking-item-details">
        <strong>Заблокировано</strong>
        {showMasterName && <span>{master?.name ?? 'Мастер не найден'}</span>}
        {block.reason && <span>{block.reason}</span>}
      </div>
      {canDelete && (
        <div className="booking-item-actions">
          <button type="button" disabled={busy} onClick={onDelete}>
            Снять блокировку
          </button>
        </div>
      )}
    </li>
  )
}
