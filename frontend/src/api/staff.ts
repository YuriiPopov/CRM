import { apiClient } from './client'
import type { Master, MasterDetail, MasterServiceLink } from '../types/staff'

export interface CreateMasterInput {
  name: string
  specializationCategoryIds: string[]
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

// Нет отдельного bulk-эндпоинта, отдающего связки мастер↔услуга разом для всего салона —
// собираем их из уже существующего GET /staff/:id (MasterDetail.services) по каждому мастеру.
export async function listMasterServiceLinks(masterIds: string[]): Promise<MasterServiceLink[]> {
  const details = await Promise.all(masterIds.map((id) => getMaster(id)))
  return details.flatMap((detail) =>
    detail.services.map((service) => ({ masterId: detail.id, serviceId: service.id })),
  )
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
