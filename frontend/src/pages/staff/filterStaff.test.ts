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

  it('returns every master when no categories are selected', () => {
    expect(filterStaff(masters, '', new Set())).toEqual(masters)
  })

  it('matches masters having any of the selected categories (OR)', () => {
    const result = filterStaff(masters, '', new Set(['category-spa', 'category-massage']))
    expect(result.map((m) => m.id).sort()).toEqual(['m-anna', 'm-boris'])
  })

  it('excludes masters without any of the selected categories', () => {
    const result = filterStaff(masters, '', new Set(['category-nails']))
    expect(result).toEqual([])
  })

  it('combines the name query and the category filter', () => {
    const result = filterStaff(masters, 'boris', new Set(['category-massage']))
    expect(result.map((m) => m.id)).toEqual(['m-boris'])
  })

  it('matches a master with several categories against a single selected category', () => {
    const multi = makeMaster({
      id: 'm-carla',
      name: 'Carla Silva',
      specializationCategoryIds: ['category-spa', 'category-nails'],
    })
    const result = filterStaff([...masters, multi], '', new Set(['category-nails']))
    expect(result.map((m) => m.id)).toEqual(['m-carla'])
  })
})
