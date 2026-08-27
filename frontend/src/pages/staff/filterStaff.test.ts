import { filterStaff } from './filterStaff'
import type { Master } from '../../types/staff'

function makeMaster(overrides: Partial<Master>): Master {
  return {
    id: 'master-1',
    salonId: 'salon-1',
    name: 'Anna Kowalska',
    specializationCategoryIds: ['category-spa'],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('filterStaff', () => {
  const masters: Master[] = [
    makeMaster({ id: 'm-anna', name: 'Anna Kowalska' }),
    makeMaster({ id: 'm-boris', name: 'Boris Nowak', specializationCategoryIds: ['category-massage'] }),
  ]

  it('returns every master when the query is empty', () => {
    expect(filterStaff(masters, '')).toEqual(masters)
  })

  it('returns every master when the query is only whitespace', () => {
    expect(filterStaff(masters, '   ')).toEqual(masters)
  })

  it('matches by a case-insensitive substring of the name', () => {
    const result = filterStaff(masters, 'boris')
    expect(result.map((m) => m.id)).toEqual(['m-boris'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterStaff(masters, 'no-such-master')).toEqual([])
  })
})
