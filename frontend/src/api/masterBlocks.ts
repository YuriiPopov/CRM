import { apiClient } from './client'
import type { MasterBlock } from '../types/masterBlock'

export interface CreateMasterBlockInput {
  // Не указывается MASTER — бэкенд сам подставляет собственный masterId (см. MasterBlocksService)
  masterId?: string
  startTime: string
  endTime: string
  reason?: string
}

export interface ListMasterBlocksParams {
  from?: string
  to?: string
}

export async function listMasterBlocks(params?: ListMasterBlocksParams): Promise<MasterBlock[]> {
  const response = await apiClient.get<MasterBlock[]>('/master-blocks', { params })
  return response.data
}

export async function createMasterBlock(input: CreateMasterBlockInput): Promise<MasterBlock> {
  const response = await apiClient.post<MasterBlock>('/master-blocks', input)
  return response.data
}

export async function deleteMasterBlock(id: string): Promise<void> {
  await apiClient.delete(`/master-blocks/${id}`)
}
