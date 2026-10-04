import type { Client } from '../../types/client'

export const UNRELIABLE_LABEL = 'Ненадёжный'

// Метку вычисляет backend (unreliable = noShowCount >= порога, item74) — фронтенд порог не дублирует.
export function isUnreliableClient(client: Pick<Client, 'unreliable'>): boolean {
  return client.unreliable === true
}

export function UnreliableBadge({ client }: { client: Pick<Client, 'unreliable' | 'noShowCount'> }) {
  if (!isUnreliableClient(client)) return null

  return (
    <span className="unreliable-badge" title={`Неявок: ${client.noShowCount ?? 0}`}>
      🚩 {UNRELIABLE_LABEL}
    </span>
  )
}
