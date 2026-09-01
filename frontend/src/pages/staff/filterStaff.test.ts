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

  describe('includeInactive', () => {
    const withInactive: Master[] = [
      ...masters,
      makeMaster({ id: 'm-inactive', name: 'Inactive Master', isActive: false }),
    ]

    it('hides inactive masters by default', () => {
      const result = filterStaff(withInactive, '')
      expect(result.map((m) => m.id).sort()).toEqual(['m-anna', 'm-boris'])
    })

    it('hides inactive masters when includeInactive is explicitly false', () => {
      const result = filterStaff(withInactive, '', new Set(), false)
      expect(result.map((m) => m.id).sort()).toEqual(['m-anna', 'm-boris'])
    })

    it('adds inactive masters to the active ones when includeInactive is true (not a switch)', () => {
      const result = filterStaff(withInactive, '', new Set(), true)
      expect(result.map((m) => m.id).sort()).toEqual(['m-anna', 'm-boris', 'm-inactive'])
    })

    it('still applies the name query and category filter together with includeInactive', () => {
      const result = filterStaff(withInactive, 'inactive', new Set(), true)
      expect(result.map((m) => m.id)).toEqual(['m-inactive'])
    })
  })

  describe('sorting active masters before inactive ones (item32)', () => {
    it('moves all inactive masters after all active ones, regardless of input order', () => {
      const mixed: Master[] = [
        makeMaster({ id: 'm-1-inactive', name: 'One', isActive: false }),
        makeMaster({ id: 'm-2-active', name: 'Two', isActive: true }),
        makeMaster({ id: 'm-3-inactive', name: 'Three', isActive: false }),
        makeMaster({ id: 'm-4-active', name: 'Four', isActive: true }),
      ]

      const result = filterStaff(mixed, '', new Set(), true)

      expect(result.map((m) => m.id)).toEqual([
        'm-2-active',
        'm-4-active',
        'm-1-inactive',
        'm-3-inactive',
      ])
    })

    it('preserves the relative order within the active group and within the inactive group', () => {
      const mixed: Master[] = [
        makeMaster({ id: 'm-inactive-first', name: 'Z', isActive: false }),
        makeMaster({ id: 'm-active-first', name: 'Y', isActive: true }),
        makeMaster({ id: 'm-inactive-second', name: 'X', isActive: false }),
        makeMaster({ id: 'm-active-second', name: 'W', isActive: true }),
      ]

      const result = filterStaff(mixed, '', new Set(), true)

      // Активные — в исходном относительном порядке, затем неактивные — тоже в исходном.
      expect(result.map((m) => m.id)).toEqual([
        'm-active-first',
        'm-active-second',
        'm-inactive-first',
        'm-inactive-second',
      ])
    })

    it('does not change order when includeInactive is false (no inactive masters left to move)', () => {
      const mixed: Master[] = [
        makeMaster({ id: 'm-b', name: 'B', isActive: true }),
        makeMaster({ id: 'm-a', name: 'A', isActive: true }),
      ]

      expect(filterStaff(mixed, '').map((m) => m.id)).toEqual(['m-b', 'm-a'])
      expect(filterStaff(mixed, '', new Set(), false).map((m) => m.id)).toEqual(['m-b', 'm-a'])
    })

    it('sorts active-before-inactive together with the name query filter', () => {
      const mixed: Master[] = [
        makeMaster({ id: 'm-anna-inactive', name: 'Anna Smith', isActive: false }),
        makeMaster({ id: 'm-anna-active', name: 'Anna Jones', isActive: true }),
        makeMaster({ id: 'm-other-active', name: 'Other', isActive: true }),
      ]

      const result = filterStaff(mixed, 'anna', new Set(), true)

      expect(result.map((m) => m.id)).toEqual(['m-anna-active', 'm-anna-inactive'])
    })

    it('sorts active-before-inactive together with the category filter', () => {
      const mixed: Master[] = [
        makeMaster({
          id: 'm-cat-inactive',
          name: 'X',
          isActive: false,
          specializationCategoryIds: ['category-spa'],
        }),
        makeMaster({
          id: 'm-cat-active',
          name: 'Y',
          isActive: true,
          specializationCategoryIds: ['category-spa'],
        }),
        makeMaster({
          id: 'm-other-category',
          name: 'Z',
          isActive: true,
          specializationCategoryIds: ['category-massage'],
        }),
      ]

      const result = filterStaff(mixed, '', new Set(['category-spa']), true)

      expect(result.map((m) => m.id)).toEqual(['m-cat-active', 'm-cat-inactive'])
    })
  })
})
