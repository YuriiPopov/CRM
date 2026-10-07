import axios from 'axios'
import { useSyncExternalStore } from 'react'

// Версия клиентского API (item78): уходит в заголовке X-Client-Api. Backend отвечает 426
// CLIENT_UPDATE_REQUIRED, когда его MIN_CLIENT_API выше. Единственное место, где живёт номер.
export const CLIENT_API_VERSION = 2
export const CLIENT_API_HEADER = 'X-Client-Api'

let updateRequired = false
const listeners = new Set<() => void>()

export function isClientUpdateRequiredError(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 426) return false
  const body = error.response.data as { code?: string } | undefined
  return body?.code === 'CLIENT_UPDATE_REQUIRED'
}

export function markClientUpdateRequired(): void {
  if (updateRequired) return
  updateRequired = true
  listeners.forEach((listener) => listener())
}

// Только для тестов
export function resetClientUpdateRequired(): void {
  updateRequired = false
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useClientUpdateRequired(): boolean {
  return useSyncExternalStore(subscribe, () => updateRequired)
}
