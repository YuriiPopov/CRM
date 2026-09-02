import { filterBookingsForDay, filterBookingsForRange } from './filterBookings'
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

describe('filterBookingsForDay', () => {
  const bookings: Booking[] = [
    makeBooking({
      id: 'b-early',
      masterId: 'master-1',
      startTime: '2026-03-10T09:00:00.000Z',
      endTime: '2026-03-10T09:30:00.000Z',
    }),
    makeBooking({
      id: 'b-late',
      masterId: 'master-2',
      startTime: '2026-03-10T14:00:00.000Z',
      endTime: '2026-03-10T14:30:00.000Z',
    }),
    makeBooking({
      id: 'b-other-day',
      masterId: 'master-1',
      startTime: '2026-03-11T09:00:00.000Z',
      endTime: '2026-03-11T09:30:00.000Z',
    }),
  ]

  it('keeps only bookings on the requested day', () => {
    const result = filterBookingsForDay(bookings, '2026-03-10')
    expect(result.map((b) => b.id)).toEqual(['b-early', 'b-late'])
  })

  it('returns an empty list for a day with no bookings', () => {
    expect(filterBookingsForDay(bookings, '2026-03-15')).toEqual([])
  })

  it('sorts results chronologically by startTime', () => {
    const reversed = [bookings[1], bookings[0]]
    const result = filterBookingsForDay(reversed, '2026-03-10')
    expect(result.map((b) => b.id)).toEqual(['b-early', 'b-late'])
  })

  it('further narrows to a single master when masterId is given', () => {
    const result = filterBookingsForDay(bookings, '2026-03-10', 'master-2')
    expect(result.map((b) => b.id)).toEqual(['b-late'])
  })

  it('returns every master when masterId is "all" (default)', () => {
    const result = filterBookingsForDay(bookings, '2026-03-10', 'all')
    expect(result.map((b) => b.id)).toEqual(['b-early', 'b-late'])
  })
})

describe('filterBookingsForRange', () => {
  const bookings: Booking[] = [
    makeBooking({
      id: 'b-day1',
      masterId: 'master-1',
      startTime: '2026-03-09T09:00:00.000Z',
      endTime: '2026-03-09T09:30:00.000Z',
    }),
    makeBooking({
      id: 'b-day2-early',
      masterId: 'master-2',
      startTime: '2026-03-10T09:00:00.000Z',
      endTime: '2026-03-10T09:30:00.000Z',
    }),
    makeBooking({
      id: 'b-day2-late',
      masterId: 'master-1',
      startTime: '2026-03-10T14:00:00.000Z',
      endTime: '2026-03-10T14:30:00.000Z',
    }),
    makeBooking({
      id: 'b-outside-range',
      masterId: 'master-1',
      startTime: '2026-03-15T09:00:00.000Z',
      endTime: '2026-03-15T09:30:00.000Z',
    }),
  ]
  const dates = ['2026-03-09', '2026-03-10']

  it('keeps only bookings whose day is in the given range', () => {
    const result = filterBookingsForRange(bookings, dates)
    expect(result.map((b) => b.id)).toEqual(['b-day1', 'b-day2-early', 'b-day2-late'])
  })

  it('returns an empty list when the range has no bookings', () => {
    expect(filterBookingsForRange(bookings, ['2026-04-01', '2026-04-02'])).toEqual([])
  })

  it('sorts results chronologically across days', () => {
    const shuffled = [bookings[2], bookings[0], bookings[1]]
    const result = filterBookingsForRange(shuffled, dates)
    expect(result.map((b) => b.id)).toEqual(['b-day1', 'b-day2-early', 'b-day2-late'])
  })

  it('further narrows to a single master when masterId is given', () => {
    const result = filterBookingsForRange(bookings, dates, 'master-1')
    expect(result.map((b) => b.id)).toEqual(['b-day1', 'b-day2-late'])
  })
})
