import type { Master } from '../../types/staff'

// Backend не даёт параметра поиска в GET /staff — тот же подход, что и в filterClients.ts.
export function filterStaff(masters: Master[], query: string): Master[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return masters
  }

  return masters.filter((master) => master.name.toLowerCase().includes(normalized))
}
