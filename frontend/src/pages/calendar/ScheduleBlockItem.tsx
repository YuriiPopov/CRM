import { formatTimeRange } from './dateUtils'
import { masterBlockCreatedByLabel } from './masterBlockCreatedBy'
import { MasterAvatar } from '../../components/MasterAvatar'
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
  // На экране "Моё расписание" (роль MASTER) полный список мастеров недоступен (Backlog п.5),
  // поэтому master здесь undefined — имя мастера не показываем вовсе (мастер и так знает,
  // чьё это расписание), а не подставляем "не найден" (см. ТЗ, диагностика).
  const createdByLabel = masterBlockCreatedByLabel(block)

  return (
    <li className="booking-item schedule-block-item">
      <div className="booking-item-time">{formatTimeRange(block.startTime, block.endTime)}</div>
      <div className="booking-item-details">
        <strong>Заблокировано</strong>
        {showMasterName && master && (
          <span className="schedule-block-master">
            <MasterAvatar master={master} className="schedule-block-master-avatar" />
            {master.name}
          </span>
        )}
        {createdByLabel && <span className="schedule-block-created-by">{createdByLabel}</span>}
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
