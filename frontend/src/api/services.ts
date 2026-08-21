import { apiClient } from './client'
import type { Service, ServiceCategory } from '../types/service'

export interface CreateServiceInput {
  name: string
  category: ServiceCategory
  durationMin: number
  price: number
}

export type UpdateServiceInput = Partial<CreateServiceInput>

export async function listServices(): Promise<Service[]> {
  const response = await apiClient.get<Service[]>('/services')
  return response.data
}

export async function createService(input: CreateServiceInput): Promise<Service> {
  const response = await apiClient.post<Service>('/services', input)
  return response.data
}

export async function updateService(id: string, input: UpdateServiceInput): Promise<Service> {
  const response = await apiClient.patch<Service>(`/services/${id}`, input)
  return response.data
}

// 409, если услуга ещё используется мастерами/материалами/записями (см. api/errors.ts)
export async function deleteService(id: string): Promise<void> {
  await apiClient.delete(`/services/${id}`)
}
