import { apiClient } from './client'
import type { Master, MasterDetail } from '../types/staff'
import type { ServiceCategory } from '../types/service'

export interface CreateMasterInput {
  name: string
  specialization: ServiceCategory
  isActive?: boolean
}

export type UpdateMasterInput = Partial<CreateMasterInput>

export async function listStaff(): Promise<Master[]> {
  const response = await apiClient.get<Master[]>('/staff')
  return response.data
}

export async function getMaster(id: string): Promise<MasterDetail> {
  const response = await apiClient.get<MasterDetail>(`/staff/${id}`)
  return response.data
}

export async function createMaster(input: CreateMasterInput): Promise<Master> {
  const response = await apiClient.post<Master>('/staff', input)
  return response.data
}

export async function updateMaster(id: string, input: UpdateMasterInput): Promise<Master> {
  const response = await apiClient.patch<Master>(`/staff/${id}`, input)
  return response.data
}

// Идемпотентно на бэкенде (upsert) — повторный вызов для уже привязанной услуги не ошибка
export async function assignService(masterId: string, serviceId: string): Promise<void> {
  await apiClient.post(`/staff/${masterId}/services/${serviceId}`)
}

// 404, если связи уже нет (см. api/errors.ts)
export async function unassignService(masterId: string, serviceId: string): Promise<void> {
  await apiClient.delete(`/staff/${masterId}/services/${serviceId}`)
}
