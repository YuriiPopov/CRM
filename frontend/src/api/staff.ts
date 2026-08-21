import { apiClient } from './client'
import type { Master } from '../types/staff'

export async function listStaff(): Promise<Master[]> {
  const response = await apiClient.get<Master[]>('/staff')
  return response.data
}
