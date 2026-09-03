export type BookingStatus = 'CREATED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
export type BookingSource = 'ADMIN' | 'ONLINE'

export interface Booking {
  id: string
  salonId: string
  clientId: string
  masterId: string
  serviceId: string
  startTime: string
  endTime: string
  status: BookingStatus
  source: BookingSource
  createdAt: string
  rescheduledAt: string | null
  originalStartTime: string | null
  originalEndTime: string | null
}
