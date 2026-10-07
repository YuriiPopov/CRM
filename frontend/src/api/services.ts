import { apiClient } from './client'
import type { Service, ServicePhoto } from '../types/service'

export interface CreateServiceInput {
  name: string
  categoryId: string
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

export async function listServicePhotos(serviceId: string): Promise<ServicePhoto[]> {
  const response = await apiClient.get<ServicePhoto[]>(`/services/${serviceId}/photos`)
  return response.data
}

// image — base64 data URL после сжатия (см. compressServicePhoto); бэкенд проверяет сигнатуру
// файла, размер (до 1 МБ) и лимит в 5 фото — 400 с понятным message при нарушении (ADMIN-only, item84)
export async function addServicePhoto(serviceId: string, image: string): Promise<ServicePhoto> {
  const response = await apiClient.post<ServicePhoto>(`/services/${serviceId}/photos`, { image })
  return response.data
}

// Тело — массив id фото в новом порядке; в ответе уже упорядоченный список
export async function reorderServicePhotos(
  serviceId: string,
  photoIds: string[],
): Promise<ServicePhoto[]> {
  const response = await apiClient.put<ServicePhoto[]>(
    `/services/${serviceId}/photos/order`,
    photoIds,
  )
  return response.data
}

export async function deleteServicePhoto(serviceId: string, photoId: string): Promise<void> {
  await apiClient.delete(`/services/${serviceId}/photos/${photoId}`)
}
