// Резервирование/блокировка времени мастера (Backlog п.9) — выходной, отпуск, перерыв.
export interface MasterBlock {
  id: string
  salonId: string
  masterId: string
  startTime: string
  endTime: string
  reason: string | null
  createdAt: string
  createdById: string | null
  // Присутствуют только в ответе GET /master-blocks (список) — POST-ответ их не считает,
  // т.к. модалка создания блокировки не показывает подпись "кем создано" сразу же,
  // а полагается на reloadBlocks() (см. CalendarPage.tsx).
  createdByRole?: 'ADMIN' | 'MASTER' | null
  createdBySelf?: boolean
}
