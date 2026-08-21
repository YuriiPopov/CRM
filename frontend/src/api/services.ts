import { apiClient } from './client'
import type { Service } from '../types/service'

export async function listServices(): Promise<Service[]> {
  const response = await apiClient.get<Service[]>('/services')
  return response.data
}
