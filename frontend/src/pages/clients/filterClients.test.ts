import { filterClients } from './filterClients'
import type { Client } from '../../types/client'

function makeClient(overrides: Partial<Client>): Client {
  return {
    id: 'client-1',
    salonId: 'salon-1',
    name: 'Anna Kowalska',
    phone: '+48123123123',
    email: null,
    notes: null,
    tags: [],
    consentGivenAt: '2026-01-01T00:00:00.000Z',
    consentWithdrawnAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('filterClients', () => {
  const clients: Client[] = [
    makeClient({ id: 'c-anna', name: 'Anna Kowalska', phone: '+48111111111' }),
    makeClient({ id: 'c-boris', name: 'Boris Nowak', phone: '+48222222222' }),
  ]

  it('returns every client when the query is empty', () => {
    expect(filterClients(clients, '')).toEqual(clients)
  })

  it('returns every client when the query is only whitespace', () => {
    expect(filterClients(clients, '   ')).toEqual(clients)
  })

  it('matches by a case-insensitive substring of the name', () => {
    const result = filterClients(clients, 'ANNA')
    expect(result.map((c) => c.id)).toEqual(['c-anna'])
  })

  it('matches by a substring of the phone number', () => {
    const result = filterClients(clients, '222222')
    expect(result.map((c) => c.id)).toEqual(['c-boris'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterClients(clients, 'no-such-client')).toEqual([])
  })
})
