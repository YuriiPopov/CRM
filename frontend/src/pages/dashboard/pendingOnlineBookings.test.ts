import { pendingOnlineBookings } from './pendingOnlineBookings'
import type { Booking } from '../../types/booking'

const NOW = '2026-03-10T12:00:00.000Z'

function makeBooking(overrides: Partial<Booking>): Booking {
  return {
    id: 'booking-1',
    salonId: 'salon-1',
    clientId: 'client-1',
    masterId: 'master-1',
    serviceId: 'service-1',
    startTime: '2026-03-11T10:00:00.000Z',
    endTime: '2026-03-11T11:00:00.000Z',
    status: 'CREATED',
    source: 'ONLINE',
    createdAt: '2026-03-01T00:00:00.000Z',
    rescheduledAt: null,
    originalStartTime: null,
    originalEndTime: null,
    ...overrides,
  }
}

describe('pendingOnlineBookings', () => {
  it('keeps only future ONLINE bookings in CREATED status, nearest first', () => {
    const result = pendingOnlineBookings(
      [
        makeBooking({ id: 'later', startTime: '2026-03-12T10:00:00.000Z' }),
        makeBooking({ id: 'sooner', startTime: '2026-03-10T13:00:00.000Z' }),
        makeBooking({ id: 'crm', source: 'ADMIN' }),
        makeBooking({ id: 'confirmed', status: 'CONFIRMED' }),
        makeBooking({ id: 'cancelled', status: 'CANCELLED' }),
        makeBooking({ id: 'past', startTime: '2026-03-10T09:00:00.000Z' }),
      ],
      NOW,
    )

    expect(result.map((b) => b.id)).toEqual(['sooner', 'later'])
  })

  it('treats a booking starting exactly now as still pending', () => {
    expect(pendingOnlineBookings([makeBooking({ startTime: NOW })], NOW)).toHaveLength(1)
  })
})
