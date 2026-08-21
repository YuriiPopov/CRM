import type { Client } from '../../types/client'

// Backend не даёт параметра поиска в GET /clients — список грузится целиком и фильтруется
// на клиенте (тот же подход, что и день/мастер-фильтр в CalendarPage/filterBookings.ts).
export function filterClients(clients: Client[], query: string): Client[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return clients
  }

  return clients.filter(
    (client) =>
      client.name.toLowerCase().includes(normalized) ||
      client.phone.toLowerCase().includes(normalized),
  )
}
