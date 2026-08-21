import { filterServices } from './filterServices'
import type { Service } from '../../types/service'

function makeService(overrides: Partial<Service>): Service {
  return {
    id: 'service-1',
    salonId: 'salon-1',
    name: 'Manicure',
    category: 'MANICURE_PEDICURE',
    durationMin: 60,
    price: 100,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('filterServices', () => {
  const services: Service[] = [
    makeService({ id: 's-manicure', name: 'Manicure' }),
    makeService({ id: 's-massage', name: 'Relax Massage', category: 'MASSAGE' }),
  ]

  it('returns every service when the query is empty', () => {
    expect(filterServices(services, '')).toEqual(services)
  })

  it('returns every service when the query is only whitespace', () => {
    expect(filterServices(services, '   ')).toEqual(services)
  })

  it('matches by a case-insensitive substring of the name', () => {
    const result = filterServices(services, 'MASSAGE')
    expect(result.map((s) => s.id)).toEqual(['s-massage'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterServices(services, 'no-such-service')).toEqual([])
  })
})
