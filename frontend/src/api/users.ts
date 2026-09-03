import { apiClient } from './client'
import type { UserSummary } from '../types/user'

export async function listUsers(): Promise<UserSummary[]> {
  const response = await apiClient.get<UserSummary[]>('/users')
  return response.data
}
