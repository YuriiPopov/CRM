import { ALL_SOURCES, filterBookingsBySource } from './bookingSourceFilter'
import type { Booking } from '../../types/booking'

function makeBooking(id: string, source: Booking['source']): Booking {
  return {
    id,
    salonId: 'salon-1',
    clientId: 'client-1',
    masterId: 'master-1',
    serviceId: 'service-1',
    startTime: '2026-03-10T10:00:00.000Z',
    endTime: '2026-03-10T11:00:00.000Z',
    status: 'CREATED',
    source,
    createdAt: '2026-03-01T00:00:00.000Z',
    rescheduledAt: null,
    originalStartTime: null,
    originalEndTime: null,
  }
}

const bookings = [makeBooking('online', 'ONLINE'), makeBooking('crm', 'ADMIN')]

describe('filterBookingsBySource', () => {
  it('keeps every booking for "Все"', () => {
    expect(filterBookingsBySource(bookings, ALL_SOURCES)).toEqual(bookings)
  })

  it('keeps only app bookings for "Из приложения"', () => {
    expect(filterBookingsBySource(bookings, 'ONLINE').map((b) => b.id)).toEqual(['online'])
  })

  it('keeps only CRM bookings for "Созданные в CRM"', () => {
    expect(filterBookingsBySource(bookings, 'ADMIN').map((b) => b.id)).toEqual(['crm'])
  })
})
