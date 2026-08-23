// Резервирование/блокировка времени мастера (Backlog п.9) — выходной, отпуск, перерыв.
export interface MasterBlock {
  id: string
  salonId: string
  masterId: string
  startTime: string
  endTime: string
  reason: string | null
  createdAt: string
}
