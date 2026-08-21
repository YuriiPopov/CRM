import { apiClient } from './client'
import type { Client } from '../types/client'
import type { ClientExport } from '../types/clientExport'

export interface CreateClientInput {
  name: string
  phone: string
  email?: string
  notes?: string
  tags?: string[]
  consentGiven: boolean
}

export interface UpdateClientInput {
  name?: string
  phone?: string
  email?: string
  notes?: string
  tags?: string[]
}

export interface EraseClientResult {
  clientId: string
  status: string
  processedAt: string
}

export async function listClients(): Promise<Client[]> {
  const response = await apiClient.get<Client[]>('/clients')
  return response.data
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  const response = await apiClient.post<Client>('/clients', input)
  return response.data
}

export async function updateClient(id: string, input: UpdateClientInput): Promise<Client> {
  const response = await apiClient.patch<Client>(`/clients/${id}`, input)
  return response.data
}

// GDPR «право на переносимость» — карточка клиента + история визитов в одном ответе.
export async function exportClientData(id: string): Promise<ClientExport> {
  const response = await apiClient.get<ClientExport>(`/clients/${id}/export`)
  return response.data
}

// GDPR «право на удаление» — анонимизация карточки, не физическое удаление (см. backend README).
export async function eraseClientData(id: string): Promise<EraseClientResult> {
  const response = await apiClient.delete<EraseClientResult>(`/clients/${id}/gdpr-erasure`)
  return response.data
}
