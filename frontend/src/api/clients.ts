import { apiClient } from './client'
import type { Client } from '../types/client'

export async function listClients(): Promise<Client[]> {
  const response = await apiClient.get<Client[]>('/clients')
  return response.data
}
