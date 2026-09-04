import {
  filterMastersForService,
  filterServicesForMaster,
  isMasterServiceLinked,
} from './masterServiceFilter'
import type { Master, MasterServiceLink } from '../../types/staff'
import type { Service } from '../../types/service'

function makeMaster(overrides: Partial<Master>): Master {
  return {
    id: 'master-1',
    salonId: 'salon-1',
    name: 'Anna',
    specializationCategoryIds: ['category-spa'],
    isActive: true,
    photo: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeService(overrides: Partial<Service>): Service {
  return {
    id: 'service-1',
    salonId: 'salon-1',
    name: 'Massage',
    categoryId: 'category-massage',
    durationMin: 60,
    price: 150,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const masterOne = makeMaster({ id: 'master-1', name: 'Anna' })
const masterTwo = makeMaster({ id: 'master-2', name: 'Boris' })
const masters = [masterOne, masterTwo]

const serviceOne = makeService({ id: 'service-1', name: 'Massage' })
const serviceTwo = makeService({ id: 'service-2', name: 'Manicure' })
const services = [serviceOne, serviceTwo]

// master-1 offers only service-1, master-2 offers only service-2 — no overlap
const links: MasterServiceLink[] = [
  { masterId: 'master-1', serviceId: 'service-1' },
  { masterId: 'master-2', serviceId: 'service-2' },
]

describe('filterServicesForMaster', () => {
  it('returns every service when no master is selected', () => {
    expect(filterServicesForMaster(services, links, '')).toEqual(services)
  })

  it('narrows to only the services linked to the selected master', () => {
    expect(filterServicesForMaster(services, links, 'master-1')).toEqual([serviceOne])
  })

  it('returns an empty array (no crash) for a master with no linked services', () => {
    expect(filterServicesForMaster(services, [], 'master-1')).toEqual([])
  })

  it('returns an empty array for a masterId not present in the links at all', () => {
    expect(filterServicesForMaster(services, links, 'master-unknown')).toEqual([])
  })
})

describe('filterMastersForService', () => {
  it('returns every active master when no service is selected', () => {
    expect(filterMastersForService(masters, links, '')).toEqual(masters)
  })

  it('narrows to only the masters linked to the selected service', () => {
    expect(filterMastersForService(masters, links, 'service-2')).toEqual([masterTwo])
  })

  it('returns an empty array (no crash) for a service no master offers', () => {
    expect(filterMastersForService(masters, [], 'service-1')).toEqual([])
  })

  it('returns an empty array for a serviceId not present in the links at all', () => {
    expect(filterMastersForService(masters, links, 'service-unknown')).toEqual([])
  })

  it('excludes a deactivated master even when no service is selected', () => {
    const inactiveMaster = makeMaster({ id: 'master-3', name: 'Carla', isActive: false })
    expect(filterMastersForService([...masters, inactiveMaster], links, '')).toEqual(masters)
  })

  it('excludes a deactivated master even if they are linked to the selected service', () => {
    const inactiveMaster = makeMaster({ id: 'master-2', name: 'Boris', isActive: false })
    expect(filterMastersForService([masterOne, inactiveMaster], links, 'service-2')).toEqual([])
  })
})

describe('isMasterServiceLinked', () => {
  it('is true for a linked master/service pair', () => {
    expect(isMasterServiceLinked(links, 'master-1', 'service-1')).toBe(true)
  })

  it('is false for an incompatible master/service pair (used to reset the other selection)', () => {
    expect(isMasterServiceLinked(links, 'master-1', 'service-2')).toBe(false)
  })

  it('is false when the links list is empty', () => {
    expect(isMasterServiceLinked([], 'master-1', 'service-1')).toBe(false)
  })
})
