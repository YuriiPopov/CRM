import { apiClient } from './client'
import type { Booking } from '../types/booking'
import type { MasterScheduleRecord } from '../types/masterSchedule'

export interface MasterScheduleDayInput {
  date: string
  isWorking: boolean
  startTime?: string
  endTime?: string
}

export interface UpsertMasterScheduleInput {
  masterId: string
  year: number
  month: number
  days: MasterScheduleDayInput[]
}

export async function getMasterSchedule(
  masterId: string,
  year: number,
  month: number,
): Promise<MasterScheduleRecord[]> {
  const response = await apiClient.get<MasterScheduleRecord[]>('/master-schedules', {
    params: { masterId, year, month },
  })
  return response.data
}

export async function upsertMasterSchedule(
  input: UpsertMasterScheduleInput,
): Promise<MasterScheduleRecord[]> {
  const response = await apiClient.put<MasterScheduleRecord[]>('/master-schedules', input)
  return response.data
}

// Проверка "что сломается", если сохранить этот график — не сохраняет ничего сама, отдаёт
// список Booking, попадающих на дни, которые становятся нерабочими (см. MasterScheduleModal —
// вызывается перед PUT, чтобы не переносить графиком записи клиентов молча).
export async function findMasterScheduleConflicts(
  input: UpsertMasterScheduleInput,
): Promise<Booking[]> {
  const response = await apiClient.post<Booking[]>('/master-schedules/conflicts', input)
  return response.data
}
