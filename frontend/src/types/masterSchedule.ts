// Регулярный график работы мастера (Backlog item28, подзадача №33) — одна запись на КАЖДЫЙ
// день месяца, который администратор уже разметил (isWorking true ИЛИ false хранятся явно).
// Дата, для которой записи вообще нет — "ещё не размечена", а не выходной
// (см. MasterScheduleModal.tsx и backend/src/master-schedules/master-schedules.service.ts).
export interface MasterScheduleRecord {
  id: string
  salonId: string
  masterId: string
  date: string
  isWorking: boolean
  startTime: string | null
  endTime: string | null
  createdAt: string
}
