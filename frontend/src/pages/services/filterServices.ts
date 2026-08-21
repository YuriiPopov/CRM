import type { Service } from '../../types/service'

// Backend не даёт параметра поиска в GET /services — тот же подход, что и в filterClients.ts.
export function filterServices(services: Service[], query: string): Service[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return services
  }

  return services.filter((service) => service.name.toLowerCase().includes(normalized))
}
