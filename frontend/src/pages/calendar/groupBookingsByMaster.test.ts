import { groupBookingsByMaster } from './groupBookingsByMaster'
import type { Booking } from '../../types/booking'
import type { Master } from '../../types/staff'

function makeBooking(overrides: Partial<Booking>): Booking {
  return {
    id: 'booking-1',
    salonId: 'salon-1',
    clientId: 'client-1',
    masterId: 'master-1',
    serviceId: 'service-1',
    startTime: '2026-03-10T10:00:00.000Z',
    endTime: '2026-03-10T11:00:00.000Z',
    status: 'CREATED',
    source: 'ADMIN',
    createdAt: '2026-03-01T00:00:00.000Z',
    rescheduledAt: null,
    ...overrides,
  }
}

function makeMaster(overrides: Partial<Master>): Master {
  return {
    id: 'master-1',
    salonId: 'salon-1',
    name: 'Master One',
    specializationCategoryIds: ['category-spa'],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('groupBookingsByMaster', () => {
  const masterOne = makeMaster({ id: 'master-1', name: 'Anna' })
  const masterTwo = makeMaster({ id: 'master-2', name: 'Boris' })

  it('creates one column per active master, in the given order', () => {
    const columns = groupBookingsByMaster([], [masterOne, masterTwo])
    expect(columns.map((c) => c.master.id)).toEqual(['master-1', 'master-2'])
  })

  it('groups bookings into the column matching their masterId', () => {
    const bookingOne = makeBooking({ id: 'b-1', masterId: 'master-1' })
    const bookingTwo = makeBooking({ id: 'b-2', masterId: 'master-2' })

    const columns = groupBookingsByMaster([bookingOne, bookingTwo], [masterOne, masterTwo])

    expect(columns.find((c) => c.master.id === 'master-1')!.bookings.map((b) => b.id)).toEqual(['b-1'])
    expect(columns.find((c) => c.master.id === 'master-2')!.bookings.map((b) => b.id)).toEqual(['b-2'])
  })

  it('sorts bookings within a column chronologically, regardless of input order', () => {
    const early = makeBooking({ id: 'b-early', masterId: 'master-1', startTime: '2026-03-10T09:00:00.000Z' })
    const late = makeBooking({ id: 'b-late', masterId: 'master-1', startTime: '2026-03-10T14:00:00.000Z' })

    const columns = groupBookingsByMaster([late, early], [masterOne])

    expect(columns[0].bookings.map((b) => b.id)).toEqual(['b-early', 'b-late'])
  })

  it('returns an empty bookings array for a master with no bookings that day', () => {
    const columns = groupBookingsByMaster([], [masterOne, masterTwo])
    expect(columns.find((c) => c.master.id === 'master-1')!.bookings).toEqual([])
    expect(columns.find((c) => c.master.id === 'master-2')!.bookings).toEqual([])
  })

  it('excludes inactive masters entirely', () => {
    const inactiveMaster = makeMaster({ id: 'master-3', name: 'Retired', isActive: false })
    const columns = groupBookingsByMaster([], [masterOne, inactiveMaster])
    expect(columns.map((c) => c.master.id)).toEqual(['master-1'])
  })

  it('ignores bookings belonging to a master not in the (active) masters list', () => {
    const orphanBooking = makeBooking({ id: 'b-orphan', masterId: 'master-unknown' })
    const columns = groupBookingsByMaster([orphanBooking], [masterOne])
    expect(columns[0].bookings).toEqual([])
  })
})
