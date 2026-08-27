import { apiClient } from './client'
import type { ServiceCategoryRef } from '../types/service'

export interface CreateServiceCategoryInput {
  name: string
  isDefault?: boolean
}

export type UpdateServiceCategoryInput = Partial<CreateServiceCategoryInput>

export async function listServiceCategories(): Promise<ServiceCategoryRef[]> {
  const response = await apiClient.get<ServiceCategoryRef[]>('/service-categories')
  return response.data
}

export async function createServiceCategory(
  input: CreateServiceCategoryInput,
): Promise<ServiceCategoryRef> {
  const response = await apiClient.post<ServiceCategoryRef>('/service-categories', input)
  return response.data
}

export async function updateServiceCategory(
  id: string,
  input: UpdateServiceCategoryInput,
): Promise<ServiceCategoryRef> {
  const response = await apiClient.patch<ServiceCategoryRef>(`/service-categories/${id}`, input)
  return response.data
}

// 409, если это дефолтная категория, или 400 при попытке снять флаг isDefault напрямую (см. api/errors.ts)
export async function deleteServiceCategory(id: string): Promise<void> {
  await apiClient.delete(`/service-categories/${id}`)
}
