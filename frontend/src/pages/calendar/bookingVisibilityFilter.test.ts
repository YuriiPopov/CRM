import { ALL_BOOKING_STATUSES, filterBookingsByVisibility } from './bookingVisibilityFilter'
import type { Booking, BookingStatus } from '../../types/booking'

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
    ...overrides,
  }
}

const allStatuses = new Set(ALL_BOOKING_STATUSES)
const showBoth = { showPaid: true, showUnpaid: true }

const created = makeBooking({ id: 'b-created', status: 'CREATED' })
const confirmed = makeBooking({ id: 'b-confirmed', status: 'CONFIRMED' })
const completed = makeBooking({ id: 'b-completed', status: 'COMPLETED' })
const cancelled = makeBooking({ id: 'b-cancelled', status: 'CANCELLED' })
const bookings = [created, confirmed, completed, cancelled]

describe('filterBookingsByVisibility — status filter', () => {
  it('keeps every booking when all statuses are selected (default)', () => {
    expect(filterBookingsByVisibility(bookings, allStatuses, new Set(), showBoth).map((b) => b.id)).toEqual([
      'b-created',
      'b-confirmed',
      'b-completed',
      'b-cancelled',
    ])
  })

  it('excludes bookings whose status is not selected', () => {
    const onlyCompleted = new Set<BookingStatus>(['COMPLETED'])
    expect(filterBookingsByVisibility(bookings, onlyCompleted, new Set(), showBoth).map((b) => b.id)).toEqual([
      'b-completed',
    ])
  })

  it('returns nothing when every status checkbox is unchecked', () => {
    expect(filterBookingsByVisibility(bookings, new Set(), new Set(), showBoth)).toEqual([])
  })
})

describe('filterBookingsByVisibility — payment filter', () => {
  const paidBookingIds = new Set(['b-completed'])

  it('keeps both paid and unpaid bookings by default', () => {
    expect(filterBookingsByVisibility(bookings, allStatuses, paidBookingIds, showBoth).map((b) => b.id)).toEqual([
      'b-created',
      'b-confirmed',
      'b-completed',
      'b-cancelled',
    ])
  })

  it('keeps only paid bookings when showUnpaid is off', () => {
    const result = filterBookingsByVisibility(bookings, allStatuses, paidBookingIds, {
      showPaid: true,
      showUnpaid: false,
    })
    expect(result.map((b) => b.id)).toEqual(['b-completed'])
  })

  it('keeps only unpaid bookings when showPaid is off', () => {
    const result = filterBookingsByVisibility(bookings, allStatuses, paidBookingIds, {
      showPaid: false,
      showUnpaid: true,
    })
    expect(result.map((b) => b.id)).toEqual(['b-created', 'b-confirmed', 'b-cancelled'])
  })

  it('returns nothing when both showPaid and showUnpaid are off', () => {
    const result = filterBookingsByVisibility(bookings, allStatuses, paidBookingIds, {
      showPaid: false,
      showUnpaid: false,
    })
    expect(result).toEqual([])
  })
})

describe('filterBookingsByVisibility — combined', () => {
  it('applies status and payment filters together (AND, not OR)', () => {
    const paidBookingIds = new Set(['b-completed'])
    const onlyCompletedAndCancelled = new Set<BookingStatus>(['COMPLETED', 'CANCELLED'])

    // status matches COMPLETED/CANCELLED, but only unpaid should remain -> just CANCELLED
    const result = filterBookingsByVisibility(bookings, onlyCompletedAndCancelled, paidBookingIds, {
      showPaid: false,
      showUnpaid: true,
    })
    expect(result.map((b) => b.id)).toEqual(['b-cancelled'])
  })
})
