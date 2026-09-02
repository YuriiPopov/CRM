import { countByStatus, currentMonthRange, upcomingBookings } from './dashboardUtils'
import type { Booking } from '../../types/booking'

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

describe('countByStatus', () => {
  it('returns zero counts for an empty list', () => {
    expect(countByStatus([])).toEqual({ CREATED: 0, CONFIRMED: 0, COMPLETED: 0, CANCELLED: 0 })
  })

  it('tallies each booking under its status', () => {
    const bookings = [
      makeBooking({ id: 'b1', status: 'CREATED' }),
      makeBooking({ id: 'b2', status: 'CREATED' }),
      makeBooking({ id: 'b3', status: 'CONFIRMED' }),
      makeBooking({ id: 'b4', status: 'CANCELLED' }),
    ]
    expect(countByStatus(bookings)).toEqual({ CREATED: 2, CONFIRMED: 1, COMPLETED: 0, CANCELLED: 1 })
  })
})

describe('upcomingBookings', () => {
  const now = '2026-03-10T12:00:00.000Z'

  it('excludes bookings that already started', () => {
    const bookings = [makeBooking({ id: 'past', startTime: '2026-03-10T09:00:00.000Z' })]
    expect(upcomingBookings(bookings, now)).toEqual([])
  })

  it('excludes bookings further out than tomorrow', () => {
    const bookings = [makeBooking({ id: 'later', startTime: '2026-03-12T09:00:00.000Z' })]
    expect(upcomingBookings(bookings, now)).toEqual([])
  })

  it('excludes cancelled and completed bookings', () => {
    const bookings = [
      makeBooking({ id: 'cancelled', startTime: '2026-03-10T14:00:00.000Z', status: 'CANCELLED' }),
      makeBooking({ id: 'completed', startTime: '2026-03-10T15:00:00.000Z', status: 'COMPLETED' }),
    ]
    expect(upcomingBookings(bookings, now)).toEqual([])
  })

  it('includes today and tomorrow, sorted chronologically', () => {
    const bookings = [
      makeBooking({ id: 'tomorrow', startTime: '2026-03-11T09:00:00.000Z' }),
      makeBooking({ id: 'today-late', startTime: '2026-03-10T18:00:00.000Z' }),
      makeBooking({ id: 'today-early', startTime: '2026-03-10T14:00:00.000Z' }),
    ]
    expect(upcomingBookings(bookings, now).map((b) => b.id)).toEqual([
      'today-early',
      'today-late',
      'tomorrow',
    ])
  })

  it('respects the limit', () => {
    const bookings = Array.from({ length: 7 }, (_, i) =>
      makeBooking({ id: `b${i}`, startTime: `2026-03-10T${13 + i}:00:00.000Z` }),
    )
    expect(upcomingBookings(bookings, now, 3)).toHaveLength(3)
  })
})

describe('currentMonthRange', () => {
  it('spans the full 31-day month', () => {
    expect(currentMonthRange('2026-03-15T08:00:00.000Z')).toEqual({
      from: '2026-03-01',
      to: '2026-03-31T23:59:59.999Z',
    })
  })

  it('spans a 30-day month', () => {
    expect(currentMonthRange('2026-04-01T00:00:00.000Z')).toEqual({
      from: '2026-04-01',
      to: '2026-04-30T23:59:59.999Z',
    })
  })

  it('handles February in a leap year', () => {
    expect(currentMonthRange('2028-02-10T00:00:00.000Z')).toEqual({
      from: '2028-02-01',
      to: '2028-02-29T23:59:59.999Z',
    })
  })

  it('handles February in a non-leap year', () => {
    expect(currentMonthRange('2026-02-10T00:00:00.000Z')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28T23:59:59.999Z',
    })
  })
})
