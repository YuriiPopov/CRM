import { groupBookingsByDay } from './groupBookingsByDay'
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

describe('groupBookingsByDay', () => {
  const dates = ['2026-03-09', '2026-03-10', '2026-03-11']

  it('creates a bucket for every date, even with no bookings', () => {
    const byDay = groupBookingsByDay([], dates)
    expect(Array.from(byDay.keys())).toEqual(dates)
    expect(byDay.get('2026-03-09')).toEqual([])
  })

  it('buckets bookings from different masters into the same day', () => {
    const fromMasterOne = makeBooking({ id: 'b-1', masterId: 'master-1', startTime: '2026-03-10T09:00:00.000Z' })
    const fromMasterTwo = makeBooking({ id: 'b-2', masterId: 'master-2', startTime: '2026-03-10T11:00:00.000Z' })
    const byDay = groupBookingsByDay([fromMasterOne, fromMasterTwo], dates)
    expect(byDay.get('2026-03-10')!.map((b) => b.id)).toEqual(['b-1', 'b-2'])
  })

  it('sorts bookings within a day by start time, regardless of input order or master', () => {
    const late = makeBooking({ id: 'b-late', startTime: '2026-03-10T14:00:00.000Z' })
    const early = makeBooking({ id: 'b-early', startTime: '2026-03-10T09:00:00.000Z' })
    const byDay = groupBookingsByDay([late, early], dates)
    expect(byDay.get('2026-03-10')!.map((b) => b.id)).toEqual(['b-early', 'b-late'])
  })

  it('drops bookings whose date falls outside the given range', () => {
    const outside = makeBooking({ id: 'b-outside', startTime: '2026-04-01T09:00:00.000Z' })
    const byDay = groupBookingsByDay([outside], dates)
    expect(Array.from(byDay.values()).flat()).toEqual([])
  })
})
